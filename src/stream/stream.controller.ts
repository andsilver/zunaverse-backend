import {
  Body,
  Controller,
  Logger,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IWebhook } from '@moralisweb3/streams-typings';
import Moralis from 'moralis';
import Web3 from 'web3';

import { Nft } from 'src/database/entities/Nft';
import { ACTIVITY_EVENTS, ZERO_ADDRESS } from 'src/consts';
import { User } from 'src/database/entities/User';
import { Ask } from 'src/database/entities/Ask';
import { Activity } from 'src/database/entities/Activity';
import { Bid } from 'src/database/entities/Bid';

import { fromWei } from 'src/shared/utils/currency';
import { Transaction } from 'src/database/entities/Transaction';
import { Notification } from 'src/database/entities/Notification';
import { Collection } from 'src/database/entities/Collection';
import { Currency } from 'src/database/entities/Currency';
import { StreamService } from './stream.service';

@Controller('stream')
export class StreamController {
  logger = new Logger(StreamController.name);

  constructor(private stream: StreamService) {}

  @Post('market')
  async marketStream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    const data = Moralis.Streams.parsedLogs(body);
    this.logger.log(`Stream Market 2: ${body.streamId}`);
    console.log(data);

    const eventData = data[0] as any;
    const { seller, buyer, offer } = eventData;

    const log = body.logs[0];

    const tokenId = Web3.utils.toHex(eventData.tokenId);
    const tokenAddress = process.env.MEDIA_CONTRACT.toLowerCase();

    await this.stream.handleOffer(
      tokenId,
      tokenAddress,
      log,
      offer,
      seller,
      buyer,
    );

    this.logger.log(`Stream Market Success: ${body.streamId}`);
  }

  @Post('market2')
  async market2Stream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    const data = Moralis.Streams.parsedLogs(body);
    this.logger.log(`Stream Market 2: ${body.streamId}`);
    console.log(data);
    const eventData = data[0] as any;
    const { tokenAddress, seller, buyer, offer } = eventData;
    const log = body.logs[0];

    const tokenId = Web3.utils.toNumber(eventData.tokenId).toString();

    await this.stream.handleOffer(
      tokenId,
      tokenAddress,
      log,
      offer,
      seller,
      buyer,
    );

    this.logger.log(`Stream Market 2 Success: ${body.streamId}`);
  }

  @Post('nfts')
  async nftsStream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }

    const {
      contract: tokenAddress,
      from,
      to,
      tokenId,
      transactionHash,
      logIndex,
    } = body.nftTransfers[0];

    this.logger.log(`Stream NFTs: ${body.streamId}`);
    this.logger.log(body.nftTransfers[0]);

    const nft = await Nft.findOne({
      where: [
        { tokenId, tokenAddress },
        { tokenId: Web3.utils.toHex(tokenId), tokenAddress },
      ],
    });
    const isZunaNFT =
      tokenAddress.toLowerCase() === process.env.MEDIA_CONTRACT.toLowerCase();

    if (!nft) {
      if (isZunaNFT) {
        this.logger.error(`None existing NFT`);
        throw new UnprocessableEntityException('Nft doesnt exist');
      } else {
        return;
      }
    }

    if (to === ZERO_ADDRESS) {
      await nft.burn();
      return;
    }

    const fromUser =
      from === ZERO_ADDRESS ? null : await User.findOrCreate(from);
    const toUser = await User.findOrCreate(to);

    if (!nft.minted) {
      nft.minted = true;
      nft.txHash = transactionHash;
    }

    nft.owner = toUser;
    nft.currentAskId = null;

    await Ask.delete(nft.tokenIdentity);

    if (fromUser.pubKey !== ZERO_ADDRESS) {
      await Bid.delete({ bidder: toUser.pubKey, ...nft.tokenIdentity });

      const activity = Activity.create({
        txHash: transactionHash,
        logIndex: +logIndex,
        event: ACTIVITY_EVENTS.TRANSFERS,
        userAddress: from,
        receiver: to,
        createdAt: `${+body.block.timestamp * 1000}`,
        ...nft.tokenIdentity,
      });
      await activity.save();
    }

    await nft.save();

    if (nft.collectionId) {
      const collection = await Collection.findOneBy({ id: nft.collectionId });

      if (!collection) {
        throw new Error(`Collection ${nft.collectionId} does not exist`);
      }
      await collection.calculateFloorPrice();
    }
    this.logger.log(`Stream NFTs success: ${body.streamId}`);
  }
}
