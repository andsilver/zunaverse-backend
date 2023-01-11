import {
  Body,
  Controller,
  Logger,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IWebhook } from '@moralisweb3/streams-typings';
import Moralis from 'moralis';
import { Nft } from 'src/database/entities/Nft';
import { ACTIVITY_EVENTS, ZERO_ADDRESS } from 'src/consts';
import { User } from 'src/database/entities/User';
import { Ask } from 'src/database/entities/Ask';
import { Activity } from 'src/database/entities/Activity';
import { Bid } from 'src/database/entities/Bid';
import Web3 from 'web3';
import { fetchCoins } from 'src/shared/utils/coingecko';
import {
  currencyAddressToSymbol,
  fromWei,
  getCurrency,
} from 'src/shared/utils/currency';
import { Transaction } from 'src/database/entities/Transaction';
import { Notification } from 'src/database/entities/Notification';

@Controller('stream')
export class StreamController {
  logger = new Logger(StreamController.name);

  @Post('market2')
  async market2Stream(@Body() body: IWebhook) {
    if (!body.streamId || !body.confirmed) {
      return;
    }
    const data = Moralis.Streams.parsedLogs(body);
    this.logger.log('Stream Market 2:');
    console.log(data);
    const eventData = data[0] as any;
    const { tokenAddress, seller, buyer, offer } = eventData;
    const log = body.logs[0];

    const tokenId = Web3.utils.toNumber(eventData.tokenId);

    const nft = await Nft.findOne({
      where: {
        tokenId: `${tokenId}`,
        tokenAddress: tokenAddress.toLowerCase(),
      },
      relations: ['owner'],
    });

    if (!nft) {
      throw new UnprocessableEntityException(
        `Nft does not exist for tokenId: ${tokenId}`,
      );
    }

    const activity = await Activity.findOne({
      where: {
        txHash: log.transactionHash,
        logIndex: +log.logIndex - 1,
      },
    });

    if (!activity) {
      throw new UnprocessableEntityException(`Transfer activity missing`);
    }

    const ask =
      nft.currentAskId && (await Ask.findOneBy({ id: nft.currentAskId }));

    const currencies = await fetchCoins();
    const symbol = currencyAddressToSymbol(offer.erc20Address);
    const currency = getCurrency(symbol);

    activity.event = 'Sale';
    activity.amount = fromWei(Web3.utils.toBN(offer.amount), currency.decimals);
    activity.currency = offer.erc20Address;

    await activity.save();

    const usd = currencies[symbol].current_price * +activity.amount;

    await Transaction.create({
      amount: +activity.amount,
      currency: activity.currency,
      txHash: activity.txHash,
      collectionId: nft.collectionId,
      buyer,
      seller,
      usd,
      ...nft.tokenIdentity,
    }).save();

    const user = await User.findByPubKey(seller);

    const isBuying = ask && ask.typedData.signature === offer.signature;

    const notification = Notification.create({
      user,
      text: isBuying
        ? 'One of your nfts has been sold.'
        : 'One of your offers has been accepted.',
      metadata: {
        activityId: activity.id,
        from: (isBuying ? buyer : seller).toLowerCase(),
        offer: {
          amount: activity.amount,
          currency: activity.currency,
        },
        txHash: log.transactionHash,
      },
      ...nft.tokenIdentity,
    });
    await notification.save();

    await Bid.delete({
      bidder: (buyer as string).toLowerCase(),
      ...nft.tokenIdentity,
    });
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

    this.logger.log('Stream NFTs:');
    this.logger.log(body.nftTransfers[0]);

    const nft = await Nft.findOneBy({ tokenId, tokenAddress });

    if (!nft || from === ZERO_ADDRESS) {
      return;
    }

    if (to === ZERO_ADDRESS) {
      await nft.burn();
      return;
    }
    await User.findOrCreate(from);
    const toUser = await User.findOrCreate(to);

    nft.currentAskId = null;
    nft.owner = toUser;

    const activity = Activity.create({
      txHash: transactionHash,
      logIndex: +logIndex,
      event: ACTIVITY_EVENTS.TRANSFERS,
      userAddress: from,
      receiver: to,
      createdAt: `${+body.block.timestamp * 1000}`,
      ...nft.tokenIdentity,
    });
    await Ask.delete(nft.tokenIdentity);
    await Bid.delete({ bidder: toUser.pubKey, ...nft.tokenIdentity });
    await nft.save();
    await activity.save();
  }
}
