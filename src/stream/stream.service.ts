import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Log } from '@moralisweb3/streams-typings';

import { Activity } from 'src/database/entities/Activity';
import { Nft } from 'src/database/entities/Nft';
import { Ask } from 'src/database/entities/Ask';
import { Currency } from 'src/database/entities/Currency';
import { fromWei } from 'src/shared/utils/currency';
import Web3 from 'web3';
import { Transaction } from 'src/database/entities/Transaction';
import { User } from 'src/database/entities/User';
import { Notification } from 'src/database/entities/Notification';
import { Bid } from 'src/database/entities/Bid';

@Injectable()
export class StreamService {
  //   async getStream() {
  //     const stream = await Moralis.Streams.getById({
  //       id: '61ce1156-58c4-4cc9-a32f-d676681c12dd',
  //       network: 'evm',
  //     });
  //     const streamData = stream.toJSON();
  //   }
  //   async addAddressToNftStream() {}

  async handleOffer(
    tokenId: string,
    tokenAddress: string,
    log: Log,
    offer: any,
    seller: string,
    buyer: string,
  ) {
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

    const currency = await Currency.findOneBy({
      address: offer.erc20Address.toLowerCase(),
    });
    activity.event = 'Sale';
    activity.amount = fromWei(Web3.utils.toBN(offer.amount), currency.decimals);
    activity.currency = offer.erc20Address;

    await activity.save();

    const usd = +currency.usd * +activity.amount;

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
}
