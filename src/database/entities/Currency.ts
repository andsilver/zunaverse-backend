import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Currencies')
export class Currency extends PrimaryEntity {
  @Column()
  name: string;

  @Column()
  symbol: string;

  @Column()
  coinId: string;

  @Column()
  @Index({ unique: true })
  address: string;

  @Column({ type: 'real', nullable: true })
  usd: number;

  @Column()
  decimals: number;

  @Column({ nullable: true })
  image: string;
}
