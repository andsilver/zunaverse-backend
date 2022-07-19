import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Asks')
export class Ask extends PrimaryEntity {
  @Column()
  currency: string;

  @Column()
  amount: string;

  @Column()
  nftId: number;

  @Column()
  owner: string;

  @Column({ type: 'json' })
  typedData: any;

  @Column({ nullable: true })
  collectionId: number;
}
