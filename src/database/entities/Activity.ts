import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { LowercaseAddressEntityAbstract } from '../abstracts/LowercaseAddress';

@Entity('Activities')
export class Activity extends LowercaseAddressEntityAbstract {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  txHash: string;

  @Column({ nullable: true })
  logIndex: number;

  @Column()
  event: string;

  @Column()
  userAddress: string;

  @Column({ nullable: true })
  receiver: string;

  @Column({ nullable: true })
  nft: number;

  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column({ nullable: true })
  collectionId: number;

  @Column({ nullable: true })
  amount: string;

  @Column({ nullable: true })
  currency: string;

  @Column()
  createdAt: string;
}
