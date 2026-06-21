import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    const dbHost = this.configService.get<string>('DB_HOST', 'localhost');
    const dbUser = this.configService.get<string>('DB_USER');
    const dbPassword = this.configService.get<string>('DB_PASSWORD');
    const dbName = this.configService.get<string>('DB_NAME', 'postgres');
    const useSsl = this.toBoolean(
      this.configService.get<string>('DB_SSL'),
      dbHost.includes('rds.amazonaws.com'),
    );
    const rejectUnauthorized = this.toBoolean(
      this.configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED'),
      false,
    );
    const maxPoolSize = Number(
      this.configService.get<string>('DB_POOL_MAX', '10'),
    );
    const idleTimeoutMs = Number(
      this.configService.get<string>('DB_IDLE_TIMEOUT_MS', '10000'),
    );
    const connectionTimeoutMs = Number(
      this.configService.get<string>('DB_CONNECTION_TIMEOUT_MS', '10000'),
    );

    this.pool = new Pool(
      connectionString
        ? {
            connectionString,
            ssl: useSsl ? { rejectUnauthorized } : undefined,
            max: maxPoolSize,
            idleTimeoutMillis: idleTimeoutMs,
            connectionTimeoutMillis: connectionTimeoutMs,
          }
        : {
            host: dbHost,
            port: Number(this.configService.get<string>('DB_PORT', '5432')),
            user: dbUser,
            password: dbPassword,
            database: dbName,
            ssl: useSsl ? { rejectUnauthorized } : undefined,
            max: maxPoolSize,
            idleTimeoutMillis: idleTimeoutMs,
            connectionTimeoutMillis: connectionTimeoutMs,
          },
    );

    await this.pool.query('SELECT 1');
    await this.bootstrapSchema();
    this.logger.log(
      `PostgreSQL connection initialized (host=${dbHost}, ssl=${useSsl})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }

  query<T = unknown>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect();
  }

  private toBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined) {
      return fallback;
    }

    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
  }

  private async bootstrapSchema(): Promise<void> {
    await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          name     VARCHAR(255) UNIQUE NOT NULL,
          email    VARCHAR(255),
          password VARCHAR(255) NOT NULL
        );
    `);

    await this.pool.query(`
        DO $$ BEGIN
          CREATE TYPE cart_status AS ENUM ('OPEN', 'ORDERED');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        CREATE TABLE IF NOT EXISTS carts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL,
          created_at DATE NOT NULL DEFAULT CURRENT_DATE,
          updated_at DATE NOT NULL DEFAULT CURRENT_DATE,
          status cart_status NOT NULL DEFAULT 'OPEN'
        );

        CREATE TABLE IF NOT EXISTS cart_items (
          cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
          product_id UUID NOT NULL,
          count INTEGER NOT NULL DEFAULT 1,
          price NUMERIC(10, 2),
          PRIMARY KEY (cart_id, product_id)
        );
    `);

    await this.pool.query(`
      DO $$ BEGIN
        CREATE TYPE order_status AS ENUM ('OPEN', 'APPROVED', 'CONFIRMED', 'SENT', 'COMPLETED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      CREATE TABLE IF NOT EXISTS orders (
          id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id  UUID NOT NULL,
          cart_id  UUID NOT NULL REFERENCES carts(id),
          payment  JSONB,
          delivery JSONB,
          comments TEXT,
          status   order_status NOT NULL DEFAULT 'OPEN',
          total    NUMERIC(10, 2)
      );
    `);
  }
}
