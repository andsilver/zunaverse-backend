import { Column, Entity } from 'typeorm';
import { PrimaryEntity } from './primary-entity';
import { ShortLink } from './ShortLink';

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

  async saveShortLink() {
    let shortLink = await ShortLink.findOneBy({ blogId: this.id });

    if (!shortLink) {
      shortLink = ShortLink.create({
        blogId: this.id,
      });
    }
    await shortLink.saveWithId(this.title);
  }

  shortLinkId?: string;
}
