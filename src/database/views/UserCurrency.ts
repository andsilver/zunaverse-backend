import { BaseEntity, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'UserCurrencies',
  expression: `
        SELECT
            "Users"."id",
            ARRAY_AGG(DISTINCT("Asks"."currency")) as "currency"
        FROM "Users"
        LEFT JOIN "Asks"
        ON "Users"."pubKey" = "Asks"."owner"
        GROUP BY "Users"."id"
    `,
})
export class UserCurrencyView extends BaseEntity {
  @ViewColumn()
  id: number;

  @ViewColumn()
  currency: string[];
}
