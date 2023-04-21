import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Nft } from './Nft';

@Entity('Showcases')
export class Showcase extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  nftId: number;

  @Column()
  userId: number;

  @Column()
  order: number;

  nft: Nft;
}
