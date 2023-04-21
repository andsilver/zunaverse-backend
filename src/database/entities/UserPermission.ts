import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('UserPermissions')
export class UserPermission extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'boolean', default: false })
  admin = false;

  @Column({ type: 'boolean', default: false })
  writer = false;
}
