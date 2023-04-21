import {
  Controller,
  Delete,
  Param,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ACTIVITY_EVENTS } from 'src/consts';
import { Activity } from 'src/database/entities/Activity';
import { Bid } from 'src/database/entities/Bid';
import { Nft } from 'src/database/entities/Nft';
import { User } from 'src/database/entities/User';
import { CurrentUser } from 'src/shared/decorators/current-user.decorator';
import { AuthGuard } from 'src/shared/guards/auth.guard';

@Controller('bids')
export class BidController {
  @Delete(':id')
  @UseGuards(AuthGuard)
  async removeBid(@Param('id') id: string, @CurrentUser() user: User) {
    const bid = await Bid.findOne({
      where: {
        id: +id,
        bidder: user.pubKey,
      },
    });

    if (!bid) {
      throw new UnprocessableEntityException('The bid does not exist');
    }

    await bid.remove();

    const nft = await Nft.findOneBy({
      tokenId: bid.tokenId,
      tokenAddress: bid.tokenAddress,
    });

    const activity = new Activity();
    activity.amount = bid.amount;
    activity.currency = bid.currency;
    activity.createdAt = Date.now().toString();
    activity.event = ACTIVITY_EVENTS.BIDS.CANCEL_BID;
    activity.userAddress = user.pubKey;
    activity.tokenId = bid.tokenId;
    activity.tokenAddress = bid.tokenAddress;
    activity.collectionId = nft.id;

    await nft.setHighestBidId();
    await activity.save();
  }
}
