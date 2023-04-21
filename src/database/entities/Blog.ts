import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';

@Entity('Blogs')
export class Blog extends PrimaryEntity {
  @Column()
  title: string;

  @Column({
    type: 'varchar',
    array: true,
    default: [],
  })
  tags: string[];

  @Column()
  author: number;

  @Column({
    type: 'text',
  })
  content: string;

  @Column({
    type: 'boolean',
  })
  isDraft: boolean;

  @Column()
  postImage: string;

  @Column()
  thumbnail: string;

  shortLinkId?: string;
}
