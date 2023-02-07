import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';
import { ContractType, EventAbi } from 'src/shared/types';

@Entity('StreamEvents')
@Index(['blockNumber', 'logIndex'])
export class StreamEvent extends PrimaryEntity {
  @Column()
  blockNumber: number;

  @Column()
  logIndex: number;

  @Column()
  txHash: string;

  @Column({ type: 'json' })
  data: any;

  @Column({
    type: 'enum',
    enum: [ContractType.ERC721, ContractType.Market, ContractType.Market2],
  })
  contractType: ContractType;

  @Column({ type: 'json' })
  event: EventAbi;

  @Column()
  address: string;

  @Column()
  processed: boolean;

  @Column()
  blockTimestamp: string;
}
