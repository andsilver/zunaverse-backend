import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

@Entity('FeaturedUsers')
export class FeaturedUser extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  userId: number;

  @Column({ default: 0 })
  order: number;

  user: User;
}
