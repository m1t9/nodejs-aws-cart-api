import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database';
import { OrderController } from './order.controller';
import { OrderService } from './services';

@Module({
  imports: [DatabaseModule],
  providers: [OrderService],
  controllers: [OrderController],
  exports: [OrderService],
})
export class OrderModule {}
