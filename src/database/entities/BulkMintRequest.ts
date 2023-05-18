import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TempNft } from './TempNft';
import { Collection } from './Collection';

@Entity('BulkMintRequests')
export class BulkMintRequest extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  collectionId: number;

  @Column()
  totalNfts: number;

  @Column({ default: 'init' })
  status:
    | 'init'
    | 'uploading'
    | 'queued'
    | 'processing'
    | 'failed'
    | 'success'
    | 'minted'
    | 'completed';

  @CreateDateColumn()
  createdAt: Date;

  @Column({ default: 0 })
  progress: number;

  @Column({ nullable: true })
  errorMessage: string;

  uploadedNfts: number;
  processedNfts: number;
  collection: Collection;

  async removeRequest() {
    await TempNft.delete({ requestId: this.id });
    await this.remove();
  }
}
