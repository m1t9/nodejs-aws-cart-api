import { Injectable } from '@nestjs/common';

import { DatabaseService } from 'src/database';
import { Order } from '../models';
import {
  Address,
  CreateOrderPayload,
  OrderStatus,
  PutOrderPayload,
} from '../type';

type DbOrderRow = {
  id: string;
  user_id: string;
  cart_id: string;
  payment: { items?: Order['items'] } | null;
  delivery: Address | null;
  comments: string | null;
  status: string;
  total: number;
};

@Injectable()
export class OrderService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getAll(): Promise<Order[]> {
    const { rows } = await this.databaseService.query<DbOrderRow>(
      `SELECT *
       FROM orders;
      `,
    );

    return rows.map((row) => this.mapDbRowToOrder(row));
  }

  async findById(orderId: string): Promise<Order | null> {
    const { rows } = await this.databaseService.query<DbOrderRow>(
      `SELECT *
       FROM orders
       WHERE id = $1
       LIMIT 1`,
      [orderId],
    );

    const row = rows[0];

    if (!row) {
      return null;
    }

    return this.mapDbRowToOrder(row);
  }

  async createWithTransaction(data: CreateOrderPayload): Promise<Order> {
    const client = await this.databaseService.connect();
    try {
      await client.query('BEGIN');

      const { rows: orderRows } = await client.query(
        `INSERT INTO orders (user_id, cart_id, payment, delivery, status, total)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [
          data.userId,
          data.cartId,
          JSON.stringify({ items: data.items }),
          JSON.stringify(data.address),
          OrderStatus.Open,
          data.total,
        ],
      );

      await client.query(
        `UPDATE carts 
          SET 
            status = 'ORDERED', 
            updated_at = NOW() 
          WHERE id = $1`,
        [data.cartId],
      );

      await client.query('COMMIT');

      const row = orderRows[0];

      return this.mapDbRowToOrder(row);
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async create(data: CreateOrderPayload): Promise<Order> {
    const { rows } = await this.databaseService.query<DbOrderRow>(
      `
       INSERT INTO orders (user_id, cart_id, payment, delivery, status, total)
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *
      `,
      [
        data.userId,
        data.cartId,
        JSON.stringify({ items: data.items }),
        JSON.stringify(data.address),
        OrderStatus.Open,
        data.total,
      ],
    );

    const row = rows[0];

    return this.mapDbRowToOrder(row);
  }

  async update(orderId: string, data: PutOrderPayload): Promise<Order | null> {
    const status = data.status ?? OrderStatus.Open;

    await this.databaseService.query(
      `
      UPDATE orders
      SET
        status = $2,
        comments = COALESCE($3::text, comments)
      WHERE id = $1::uuid 
    `,
      [orderId, status, data.comment ?? null],
    );

    return this.findById(orderId);
  }

  private mapDbRowToOrder(row: DbOrderRow): Order {
    const normalizedStatus = this.normalizeStatus(row.status);

    return {
      id: row.id,
      userId: row.user_id,
      cartId: row.cart_id,
      items: row.payment?.items ?? [],
      address: row.delivery ?? {
        address: '',
        firstName: '',
        lastName: '',
        comment: '',
      },
      statusHistory: [
        {
          status: normalizedStatus as OrderStatus.Open,
          comment: row.comments || '',
          timestamp: Date.now(),
        },
      ],
    };
  }

  private normalizeStatus(
    status: OrderStatus | string | undefined,
  ): OrderStatus {
    if (!status) {
      return OrderStatus.Open;
    }

    const upperCased = status.toUpperCase();

    if (Object.values(OrderStatus).includes(upperCased as OrderStatus)) {
      return upperCased as OrderStatus;
    }

    return OrderStatus.Open;
  }
}
