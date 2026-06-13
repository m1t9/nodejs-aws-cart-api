import { Injectable } from '@nestjs/common';

import { DatabaseService } from 'src/database';
import { Cart, CartStatuses } from '../models';
import { PutCartPayload } from 'src/order/type';

@Injectable()
export class CartService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findByUserId(userId: string): Promise<Cart | null> {
    const { rows } = await this.databaseService.query<Cart>(
      `SELECT * FROM carts 
       WHERE user_id = $1 AND status = '${CartStatuses.OPEN}' 
       LIMIT 1`,
      [userId],
    );

    if (rows.length === 0) return null;

    const cart = rows[0];

    const { rows: items } = await this.databaseService.query<any>(
      `SELECT * FROM cart_items 
       WHERE cart_id = $1`,
      [cart.id],
    );

    return {
      ...cart,
      items: items.map((row) => ({
        product: {
          id: row.product_id,
          title: '',
          description: '',
          price: Number(row.price),
        },
        count: row.count,
      })),
    };
  }

  async createByUserId(user_id: string): Promise<Cart> {
    const { rows } = await this.databaseService.query<any>(
      `
        INSERT INTO carts (id, user_id, created_at, updated_at, status)
        VALUES (
          uuid_generate_v4(),
          $1::uuid,
          NOW(),
          NOW(),
          '${CartStatuses.OPEN}'
        )
        RETURNING *
      `,
      [user_id],
    );
    const cart = rows[0];
    return { ...cart, items: [] };
  }

  async findOrCreateByUserId(userId: string): Promise<Cart> {
    const userCart = await this.findByUserId(userId);

    if (userCart) {
      return userCart;
    }

    return this.createByUserId(userId);
  }

  async updateByUserId(userId: string, payload: PutCartPayload): Promise<Cart> {
    const cart = await this.findOrCreateByUserId(userId);

    const cartItem = await this.databaseService.query(
      ` SELECT 1 FROM cart_items
       WHERE cart_id = $1::uuid
        AND product_id = $2::uuid
    `,
      [cart.id, payload.product.id],
    );

    if (payload.count === 0) {
      await this.databaseService.query(
        `
        DELETE FROM cart_items
        WHERE cart_id = $1::uuid
          AND product_id = $2::uuid
      `,
        [cart.id, payload.product.id],
      );
    } else if (cartItem.rowCount) {
      await this.databaseService.query(
        `
        UPDATE cart_items
        SET count = $3
        WHERE cart_id = $1::uuid
          AND product_id = $2::uuid
      `,
        [cart.id, payload.product.id, payload.count],
      );
    } else {
      await this.databaseService.query(
        `
        INSERT INTO cart_items (
          cart_id,
          product_id,
          count,
          price
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4
        )
      `,
        [cart.id, payload.product.id, payload.count, payload.product.price],
      );
    }

    const updatedCart = await this.findByUserId(userId);

    if (!updatedCart) {
      throw new Error('Cart not found after update');
    }

    return updatedCart;
  }

  async removeByUserId(userId: string): Promise<void> {
    await this.databaseService.query(
      `DELETE FROM cart_items 
        WHERE cart_id = (
        SELECT id FROM carts WHERE user_id = $1 AND status = '${CartStatuses.OPEN}' LIMIT 1
      )`,
      [userId],
    );
  }
}
