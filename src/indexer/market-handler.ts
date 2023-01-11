import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';
import { Log } from 'web3-core';

import MarketAbi from './abis/Market.json';
import { getEventAbi } from './utils';
import { Nft } from '../database/entities/Nft';
import { Activity } from '../database/entities/Activity';
import { Notification } from 'src/database/entities/Notification';
import { User } from 'src/database/entities/User';
import { Transaction } from 'src/database/entities/Transaction';
import { Bid } from 'src/database/entities/Bid';
import { Collection } from 'src/database/entities/Collection';
import { fetchCoins } from 'src/shared/utils/coingecko';
import {
  currencyAddressToSymbol,
  fromWei,
  getCurrency,
} from 'src/shared/utils/currency';

export class MarketHandler {
  contract: Contract;
  EVENTS: any[] = [
    {
      name: 'Bought',
    },
    {
      name: 'OfferAccepted',
    },
  ];

  constructor(public web3: Web3) {
    /** Contract instances */
    this.contract = new web3.eth.Contract(
      MarketAbi as any,
      process.env.MARKET_CONTRACT,
    );
    for (const event of this.EVENTS) {
      const abi = getEventAbi(MarketAbi, event.name);
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

  async handleBought(log: Log, eventData: any) {
    console.log(`Market: Bought at Block ${log.blockNumber}\n`, log, eventData);

    try {
      const { offer, seller, buyer } = eventData;

      const tokenId = Web3.utils.toHex(eventData.tokenId).toString();

      const nft = await Nft.findOne({
        where: {
          tokenId,
          tokenAddress: process.env.MEDIA_CONTRACT.toLowerCase(),
        },
        relations: ['owner'],
      });

      if (!nft) {
        throw new Error(`media is null for tokenId: ${tokenId}`);
      }

      const activity = await Activity.findOne({
        where: {
          txHash: log.transactionHash,
          logIndex: log.logIndex - 1,
        },
      });

      if (!activity) {
        throw new Error(`Transfer activity missing`);
      }
      const currencies = await fetchCoins();
      const symbol = currencyAddressToSymbol(offer.erc20Address);
      const currency = getCurrency(symbol);

      activity.event = 'Sale';
      activity.amount = fromWei(offer.amount, currency.decimals);
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

      const notification = Notification.create({
        user,
        text: 'One of your nfts has been sold.',
        metadata: {
          activityId: activity.id,
          from: buyer.toLowerCase(),
          offer: {
            amount: activity.amount,
            currency: activity.currency,
          },
          txHash: log.transactionIndex,
        },
        ...nft.tokenIdentity,
      });
      await notification.save();

      await Bid.delete({
        bidder: (buyer as string).toLowerCase(),
        ...nft.tokenIdentity,
      });

      const collection = await Collection.findOneBy({ id: nft.collectionId });

      if (!collection) {
        console.log('Collection doesnt exist', nft.collectionId);
      } else {
        collection.totalVolume += usd;
        await collection.calculateMetrics();
        await collection.calculateFloorPrice();
      }
    } catch (err) {
      console.error('ERROR Market Bought:\n', err);
      throw err;
    }
  }

  async handleOfferAccepted(log: Log, eventData: any) {
    console.log(
      `Market: OfferAccepted at Block ${log.blockNumber}\n`,
      log,
      eventData,
    );

    try {
      const { offer, seller, buyer } = eventData;

      const tokenId = Web3.utils.toHex(eventData.tokenId).toString();

      const nft = await Nft.findOne({
        where: {
          tokenId,
          tokenAddress: process.env.MEDIA_CONTRACT.toLowerCase(),
        },
        relations: ['owner'],
      });

      if (!nft) {
        throw new Error(`media is null for tokenId: ${tokenId}`);
      }

      const activity = await Activity.findOne({
        where: {
          txHash: log.transactionHash,
          logIndex: log.logIndex - 1,
        },
      });

      if (!activity) {
        throw new Error(`Transfer activity missing`);
      }
      const currencies = await fetchCoins();
      const symbol = currencyAddressToSymbol(offer.erc20Address);
      const currency = getCurrency(symbol);

      activity.event = 'Sale';
      activity.amount = fromWei(offer.amount, currency.decimals);
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

      const user = await User.findByPubKey(buyer);

      const notification = Notification.create({
        user,
        text: 'One of your offers has been accepted.',
        metadata: {
          activityId: activity.id,
          from: seller.toLowerCase(),
          offer: {
            amount: activity.amount,
            currency: activity.currency,
          },
          txHash: log.transactionIndex,
        },
        ...nft.tokenIdentity,
      });
      await notification.save();

      await Bid.delete({
        bidder: (buyer as string).toLowerCase(),
        ...nft.tokenIdentity,
      });
      const collection = await Collection.findOneBy({ id: nft.collectionId });

      if (!collection) {
        console.log('Collection doesnt exist', nft.collectionId);
      } else {
        collection.totalVolume += usd;
        await collection.calculateMetrics();
        await collection.calculateFloorPrice();
      }
    } catch (err) {
      console.error('ERROR Market OfferAccepted:\n', err);
      throw err;
    }
  }
}
