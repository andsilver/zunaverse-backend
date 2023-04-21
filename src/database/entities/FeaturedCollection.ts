import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Collection } from './Collection';

@Entity('FeaturedCollections')
export class FeaturedCollection extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  collectionId: number;

  @Column({ default: 0 })
  order: number;

  collection: Collection;
}
