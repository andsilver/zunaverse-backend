import {
  BaseEntity,
  Index,
  PrimaryColumn,
  ViewColumn,
  ViewEntity,
} from 'typeorm';

@ViewEntity({
  name: 'Search',
  expression: `
        SELECT
            CONCAT(category, '_', id) AS id,
            id as "originId",
            name,
            description,
            address,
            "tokenId",
            image,
            category
        FROM
            (
                (
                    SELECT
                        "id",
                        "name",
                        "description",
                        "tokenAddress" as address,
                        "tokenId",
                        "thumbnail" as image,
                        'nft' AS category
                    FROM
                        "Nfts"
                )
                UNION
                (
                    SELECT
                        u.id,
                        u.name,
                        u.bio,
                        "pubKey" as address,
                        '' AS "tokenId",
                        u.avatar as image,
                        'user' AS category
                    FROM
                        "Users" u
                )
                UNION
                (
                    SELECT
                        c.id,
                        c.name,
                        c.description,
                        '' AS address,
                        '' AS "tokenId",
                        c.image,
                        'collection' AS category
                    FROM
                        "Collections" c
                )
            ) Search
    `,
})
export class SearchView extends BaseEntity {
  @PrimaryColumn()
  id: string;

  @ViewColumn()
  originId: number;

  @ViewColumn()
  @Index({ fulltext: true })
  name: string;

  @ViewColumn()
  @Index({ fulltext: true })
  description: string;

  @ViewColumn()
  @Index({ fulltext: true })
  address: string;

  @ViewColumn()
  tokenId: string;

  @ViewColumn()
  image: string;

  @ViewColumn()
  category: string;
}
