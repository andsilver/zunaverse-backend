import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('TempNfts')
export class TempNft extends PrimaryEntity {
  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  category: string;

  @Column()
  royaltyFee: number;

  @Column({ type: 'json' })
  properties: any;

  @Column()
  erc20Address: string;

  @Column()
  amount: string;

  @Column()
  tokenId: string;

  @Column({ nullable: true })
  tokenUri: string;

  @Column({ nullable: true })
  filePath: string;

  @Index()
  @Column({ nullable: true })
  imageIpfsHash: string;

  @Column()
  userId: number;

  @Column()
  collectionId: number;

  @Column()
  requestId: number;

  @Column({ default: false })
  processed: boolean;
}
