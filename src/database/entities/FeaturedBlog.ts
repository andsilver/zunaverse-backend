import {
  BaseEntity,
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Blog } from './Blog';

@Entity('FeaturedBlogs')
export class FeaturedBlog extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index({ unique: true })
  blogId: number;

  @Column({ default: 0 })
  order: number;

  blog: Blog;
}
