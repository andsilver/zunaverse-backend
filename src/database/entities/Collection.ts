import { Column, Entity, ManyToOne } from 'typeorm';
import { Ask } from './Ask';
import { Nft } from './Nft';
import { PrimaryEntity } from './primary-entity';
import { User } from './User';

@Entity('Collections')
export class Collection extends PrimaryEntity {
  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ nullable: true })
  image: string;

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

  @Column({ default: 0 })
  items: number;

  @Column({ default: 0 })
  owners: number;

  @Column({ type: 'json', default: {} })
  properties: { [key: string]: string[] };

  @Column({ default: false })
  featured: boolean;

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

    if (asks.length) {
      const askPrices = asks.map((ask) => +ask.amount);
      this.floorPrice = Math.min(...askPrices);
      await this.save();
    }
  }
}
