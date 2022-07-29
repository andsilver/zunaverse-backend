import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { Log } from 'web3-core';

import MediaAbi from './abis/Zuna.json';
import { getEventAbi } from './utils';
import { Nft } from '../database/entities/Nft';
import { User } from '../database/entities/User';
import { Ask } from '../database/entities/Ask';
import { ACTIVITY_EVENTS, ZERO_ADDRESS } from '../consts';
import { Activity } from '../database/entities/Activity';
import { Bid } from 'src/database/entities/Bid';
import { Collection } from 'src/database/entities/Collection';
import { Favorite } from 'src/database/entities/Favorite';
import { Notification } from 'src/database/entities/Notification';

export class MediaHandler {
  contract: Contract;
  EVENTS: any[] = [
    {
      name: 'Transfer',
      abi: {},
      signature: '',
    },
  ];

  constructor(public web3: Web3) {
    /** Contract instances */
    this.contract = new web3.eth.Contract(
      MediaAbi as any,
      process.env.MEDIA_CONTRACT,
    );
    for (const event of this.EVENTS) {
      const abi = getEventAbi(MediaAbi, event.name);
      event.abi = abi;
      event.signature = abi.signature;
    }
  }

  async eventHandler(log: Log) {
    const eventSignature = log.topics[0];

    const event = this.EVENTS.find((e) => e.signature === eventSignature);

    if (!event) {
      return;
    }

    const handlerName = `handle${event.name}`;

    const decoded = this.web3.eth.abi.decodeLog(
      event.abi.inputs as any,
      log.data,
      log.topics.slice(1),
    );

    if (this[handlerName]) {
      await this[handlerName](log, decoded);
    }
  }

  async handleTransfer(log: Log, eventData: any) {
    console.log(
      `Media: Transfer at Block ${log.blockNumber}\n`,
      log,
      eventData,
    );

    try {
      const block = await this.web3.eth.getBlock(log.blockNumber);
      const { from, to } = eventData;

      const tokenId = Web3.utils.toHex(eventData.tokenId).toString();

      const fromUser =
        from !== ZERO_ADDRESS ? await User.findOrCreate(from) : null;

      const nft = await Nft.findOneBy({ tokenId });

      if (to === ZERO_ADDRESS) {
        await Bid.delete({ nftId: nft.id });
        await Activity.delete({ nft: nft.id });
        await Ask.delete({ nftId: nft.id });
        await Favorite.delete({ nftId: nft.id });
        await Notification.delete({ nftId: nft.id });

        if (nft.collectionId) {
          const collection = await Collection.findOneBy({
            id: nft.collectionId,
          });
          await collection.calculateMetrics();
          await collection.calculateFloorPrice();
        }
        await nft.remove();
        return;
      }

      const toUser = await User.findOrCreate(to);

      if (!nft) {
        throw new Error(`None existing NFT: ${tokenId}`);
      } else {
        nft.currentAskId = null;

        if (!nft.minted) {
          nft.minted = true;
          nft.txHash = log.transactionHash;
        }
        await Ask.delete({ nftId: nft.id });
      }

      if (from !== ZERO_ADDRESS) {
        nft.owner = toUser;

        const activity = new Activity();
        activity.txHash = log.transactionHash;
        activity.logIndex = log.logIndex;
        activity.event = ACTIVITY_EVENTS.TRANSFERS;
        activity.userAddress = fromUser.pubKey;
        activity.receiver = toUser.pubKey;
        activity.nft = nft.id;
        activity.createdAt = `${+block.timestamp * 1000}`;
        activity.collectionId = nft.collectionId;

        await activity.save();
        await Bid.delete({ bidder: toUser.pubKey });
      }
      await nft.save();

      if (nft.collectionId) {
        const collection = await Collection.findOneBy({ id: nft.collectionId });

        if (!collection) {
          throw new Error(`Collection ${nft.collectionId} does not exist`);
        }
        await collection.calculateFloorPrice();
      }
    } catch (err) {
      console.error('ERROR Media: Transfer', err);
      throw err;
    }
  }
}
