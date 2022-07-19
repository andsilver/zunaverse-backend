import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Follows')
@Index(['user', 'followee'], { unique: true })
export class Follow extends PrimaryEntity {
  @Column()
  user: string;

  @Column()
  followee: string;
}
