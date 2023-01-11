import {
  CreateDateColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LowercaseAddressEntityAbstract } from '../abstracts/LowercaseAddress';

export class PrimaryEntity extends LowercaseAddressEntityAbstract {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
