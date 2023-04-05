import { BaseEntity, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'UserCategories',
  expression: `
        SELECT
            "Users"."id",
            ARRAY_AGG(DISTINCT(LOWER("Nfts"."category"))) as "categories"
        FROM "Users"
        LEFT JOIN "Nfts"
        ON "Nfts"."ownerId" = "Users"."id"
        GROUP BY "Users"."id"
    `,
})
export class UserCategoryView extends BaseEntity {
  @ViewColumn()
  id: number;

  @ViewColumn()
  categories: string[];
}
