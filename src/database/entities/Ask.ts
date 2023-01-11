import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Asks')
@Index(['tokenId', 'tokenAddress'])
export class Ask extends PrimaryEntity {
  @Column()
  currency: string;

  @Column()
  amount: string;

  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column()
  owner: string;

  @Column({ type: 'json' })
  typedData: any;

  @Column({ nullable: true })
  collectionId: number;
}
