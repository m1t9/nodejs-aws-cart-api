import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database';

import { UsersService } from './services';

@Module({
  imports: [DatabaseModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
