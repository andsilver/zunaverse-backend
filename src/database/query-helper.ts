import { SelectQueryBuilder } from 'typeorm';
import { User } from './entities/User';
import { Collection } from './entities/Collection';
import { Ask } from './entities/Ask';
import { Bid } from './entities/Bid';
import { Favorite } from './entities/Favorite';

export function selectNfts<T>(qb: SelectQueryBuilder<T>, currentUser?: User) {
  qb = qb
    .leftJoinAndMapOne('n.owner', User, 'u', 'u.id = n.ownerId')
    .leftJoinAndMapOne('n.collection', Collection, 'c', 'c.id = n.collectionId')
    .leftJoinAndMapOne('n.currentAsk', Ask, 'a', 'a.id = n.currentAskId')
    .leftJoinAndMapOne('n.highestBid', Bid, 'b', 'b.id = n.highestBidId')
    .addSelect(
      (sub) =>
        sub
          .select('COUNT(f.id)', 'favorites')
          .from(Favorite, 'f')
          .where('n.tokenId = f.tokenId AND n.tokenAddress = f.tokenAddress'),
      'favorites',
    );

  if (currentUser) {
    qb = qb.addSelect(
      (sub) =>
        sub
          .select('COUNT(f.id)', 'favorited')
          .from(Favorite, 'f')
          .where(
            'n.tokenId = f.tokenId AND n.tokenAddress = f.tokenAddress AND f.userAddress = :address',
            {
              address: currentUser.pubKey,
            },
          ),
      'favorited',
    );
  }
  return qb;
}
