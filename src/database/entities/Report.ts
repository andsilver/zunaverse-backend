import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Entities')
export class Report extends PrimaryEntity {
  @Column({ nullable: true })
  userAddress: string;

  @Column({ nullable: true })
  tokenId: number;

  @Column()
  message: string;

  @Column()
  reporter: string;
}
