import { BaseEntity, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'CollectionCurrencies',
  expression: `
        SELECT
            "Collections"."id",
            ARRAY_AGG(DISTINCT("All"."currency")) as "currency"
        FROM "Collections"
        LEFT JOIN (
            (
                SELECT
                    "currency",
                    "collectionId"
                FROM
                    "Asks"
            )
            UNION
            (
                SELECT
                    "currency",
                    "collectionId"
                FROM
                    "Bids"
            )
        ) "All"
        ON "Collections"."id" = "All"."collectionId"
        GROUP BY "Collections"."id"
    `,
})
export class CollectionCurrencyView extends BaseEntity {
  @ViewColumn()
  id: number;

  @ViewColumn()
  currency: string[];
}
