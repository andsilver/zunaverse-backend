import { Cron } from '@nestjs/schedule';
import { Injectable, Logger } from '@nestjs/common';
import { Contract } from 'web3-eth-contract';
import Provider from '@truffle/hdwallet-provider';
import Web3 from 'web3';

import { Nft } from './database/entities/Nft';
import { User } from './database/entities/User';
import RewardsABI from './indexer/abis/Rewards.json';
import { Reward } from './database/entities/Reward';
import { Collection } from './database/entities/Collection';
import { RewardDetail } from './database/entities/RewardDetail';

@Injectable()
export class RewardsService {
  rewardsContract: Contract;
  controllerAddress: string;

  constructor() {
    this.initContract();
  }

  async initContract() {
    const provider = new Provider(
      process.env.REWARDS_PRIVATE_KEY,
      process.env.RPC_URL,
    );
    const web3 = new Web3(provider);
    this.rewardsContract = new web3.eth.Contract(
      RewardsABI as any,
      process.env.REWARDS_CONTRACT,
    );
    this.controllerAddress = (await web3.eth.getAccounts())[0];
  }

  @Cron('0 0 1 * *')
  async releaseStaticRewards() {
    const collection = await Collection.findOne({
      where: { id: 1 },
      relations: ['owner'],
    });
    const zunaNFTs = await Nft.createQueryBuilder('Nfts')
      .where('Nfts.collectionId = 1')
      .andWhere('Nfts.rewardsMonths < 12')
      .leftJoinAndMapOne('Nfts.owner', User, 'Users', 'Users.id = Nfts.ownerId')
      .getMany();

    if (!zunaNFTs.length) {
      Logger.log('Static Rewards Ended.');
      return;
    }

    const tierFilterFn = (tier: number) =>
      zunaNFTs
        .filter(
          (nft) =>
            nft.properties.some(
              (p) => p.name.toLowerCase() === 'tier' && +p.value === tier,
            ) && nft.owner.id !== collection.owner.id,
        )
        .map((nft) => nft.owner.pubKey);

    const tier1Owners = tierFilterFn(1);
    const tier2Owners = tierFilterFn(2);
    const tier3Owners = tierFilterFn(3);
    const tier4Owners = tierFilterFn(4);
    const tier5Owners = tierFilterFn(5);
    const tier6Owners = tierFilterFn(6);

    const result = await this.rewardsContract.methods
      .releaseStaticRewards([
        tier1Owners,
        tier2Owners,
        tier3Owners,
        tier4Owners,
        tier5Owners,
        tier6Owners,
      ])
      .send({
        from: this.controllerAddress,
      });

    const reward = Reward.create({
      tier1Holders: tier1Owners,
      tier2Holders: tier2Owners,
      tier3Holders: tier3Owners,
      tier4Holders: tier4Owners,
      tier5Holders: tier5Owners,
      tier6Holders: tier6Owners,
      rewardType: 'static',
      txHash: result.transactionHash,
    });
    await reward.save();

    const nftsTobeUpdated: Nft[] = [];
    const rewardDetailsTobeCreated: RewardDetail[] = [];

    for (const nft of zunaNFTs) {
      if (nft.owner.id === collection.owner.id) {
        continue;
      }
      const property = nft.properties.find(
        (p) => p.name.toLowerCase() === 'tier',
      );
      if (!property) {
        Logger.error('Tier property error:');
        console.log(nft);
        continue;
      }
      const rewardDetail = RewardDetail.create({
        nftId: nft.id,
        userPubKey: nft.owner.pubKey,
        rewardId: reward.id,
        rewardTier: +nft.properties.find((p) => p.name.toLowerCase() === 'tier')
          .value,
        rewardType: 'static',
        txHash: reward.txHash,
      });
      nft.rewardsMonths += 1;
      await nft.save();
      rewardDetailsTobeCreated.push(rewardDetail);
    }
    await RewardDetail.save(rewardDetailsTobeCreated);
  }

  @Cron('0 0 * * MON')
  async releaseBuybackRewards() {}
}
