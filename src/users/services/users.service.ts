import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { DatabaseService } from '../../database';
import { User } from '../models';

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findOne(name: string): Promise<User | undefined> {
    const { rows } = await this.databaseService.query<User>(
      'SELECT id, name, password FROM users WHERE name = $1 LIMIT 1',
      [name],
    );

    return rows[0];
  }

  async createOne({ name, password }: User): Promise<User> {
    const id = randomUUID();
    const newUser = { id, name, password };

    await this.databaseService.query(
      'INSERT INTO users(id, name, password) VALUES ($1, $2, $3)',
      [newUser.id, newUser.name, newUser.password],
    );

    return newUser;
  }
}
