import { BaseEntity, ViewColumn, ViewEntity } from 'typeorm';

@ViewEntity({
  name: 'UserSellAmounts',
  expression: `
        SELECT
            seller,
            SUM(usd) AS amount
        FROM
            "Transactions"
        GROUP BY
            seller
        ORDER BY
            amount
        DESC
    `,
})
export class UserSellAmountView extends BaseEntity {
  @ViewColumn()
  amount: number;

  @ViewColumn()
  seller: string;
}
