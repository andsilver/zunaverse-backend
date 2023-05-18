import { Column, Entity, In, ManyToOne } from 'typeorm';
import { Ask } from './Ask';
import { Currency } from './Currency';
import { Nft } from './Nft';
import { PrimaryEntity } from './primary-entity';
import { ShortLink } from './ShortLink';
import { User } from './User';
import { CollectionAffiliate, NftCategory } from 'src/shared/types';

@Entity('Collections')
export class Collection extends PrimaryEntity {
  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  image: string;

  @Column({ nullable: true })
  featuredImage: string;

  @Column({ nullable: true })
  banner: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  discord: string;

  @Column({ nullable: true })
  twitter: string;

  @Column({ nullable: true })
  instagram: string;

  @Column({ nullable: true })
  telegram: string;

  @Column({ nullable: true })
  reddit: string;

  @Column({ nullable: true })
  medium: string;

  @ManyToOne(() => User, (user) => user.collections)
  owner: User;

  @Column({ default: 0, type: 'real' })
  totalVolume: number;

  @Column({ default: 0, type: 'real' })
  floorPrice: number;

  @Column({ default: 'wbnb', nullable: true })
  floorPriceCurrency: string;

  @Column({ default: 0 })
  items: number;

  @Column({ default: 0 })
  owners: number;

  @Column({ type: 'json', default: {} })
  properties: { [key: string]: string[] };

  @Column({ nullable: true })
  category: NftCategory;

  @Column({ default: false })
  affiliate: boolean;

  @Column({ type: 'json', nullable: true })
  affiliation: CollectionAffiliate;

  postImages: string[] = [];
  shortLink: ShortLink;
  favorites: number;
  favorited: boolean;

  async calculateMetrics() {
    this.items = await Nft.count({ where: { collectionId: this.id } });
    const ownersQuery = await Nft.createQueryBuilder('n')
      .select('count(DISTINCT "ownerId")')
      .where('n.collectionId = :id', { id: this.id })
      .getRawOne();
    this.owners = +ownersQuery.count;
    await this.save();
  }

  async calculateFloorPrice() {
    const asks = await Ask.find({ where: { collectionId: this.id } });
    const currencies = await Currency.findBy({
      address: In(asks.map((ask) => ask.currency)),
    });

    if (asks.length) {
      let min = 0;

      for (const ask of asks) {
        const currency = currencies.find((c) => c.address === ask.currency);
        const usdPrice = currency.usd;
        const price = +usdPrice * +ask.amount;

        if (!min || price < min) {
          min = price;
          this.floorPrice = +ask.amount;
          this.floorPriceCurrency = currency.symbol;
        }
      }
    } else {
      this.floorPrice = 0;
      this.floorPriceCurrency = null;
    }
    await this.save();
  }

  async loadPostImages() {
    const nfts = await Nft.find({
      where: { collectionId: this.id },
      take: 3,
    });
    this.postImages = nfts.map((nft) => nft.thumbnail);
  }

  async saveShortLink() {
    let shortLink = await ShortLink.findOneBy({ collectionId: this.id });

    if (!shortLink) {
      shortLink = ShortLink.create({
        collectionId: this.id,
      });
    }
    await shortLink.saveWithId(this.name);
  }
}
