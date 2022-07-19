import {
  BaseEntity,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  ViewColumn,
  ViewEntity,
} from 'typeorm';

@ViewEntity({
  name: 'TopSellers',
  expression: `
        SELECT
            seller,
            SUM(amount) AS amount
        FROM
            Transactions
        GROUP BY
            seller
        ORDER BY
            amount
        DESC
    `,
})
export class TopSeller extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ViewColumn()
  amount: number;

  @ViewColumn()
  seller: string;
}
