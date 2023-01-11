import { Column, Entity, ManyToOne } from 'typeorm';
import { PrimaryEntity } from './primary-entity';
import { User } from './User';

@Entity('Notifications')
export class Notification extends PrimaryEntity {
  @ManyToOne(() => User)
  user: User;

  @Column()
  text: string;

  @Column({ nullable: true })
  nftId: number;

  @Column({ nullable: true })
  tokenId: string;

  @Column({ nullable: true })
  tokenAddress: string;

  @Column({ type: 'boolean', default: true })
  unread = true;

  @Column({ type: 'json', nullable: true })
  metadata: any;
}
