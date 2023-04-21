import { Column, Entity, Index } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('FavCollections')
@Index(['collectionId', 'userAddress'], { unique: true })
export class FavCollection extends PrimaryEntity {
  @Column()
  collectionId: number;

  @Column()
  userAddress: string;
}
