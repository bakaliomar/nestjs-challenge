import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderRequestDTO } from './dto/create-order.request.dto';
import { Order } from './schemas/order.schema';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({ status: 201, description: 'Order created' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiResponse({ status: 409, description: 'Not enough stock' })
  create(@Body() dto: CreateOrderRequestDTO): Promise<Order> {
    return this.orders.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an order by id' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  findOne(@Param('id', ParseMongoIdPipe) id: string): Promise<Order> {
    return this.orders.findById(id);
  }
}
