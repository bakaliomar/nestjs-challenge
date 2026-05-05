import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order } from './schemas/order.schema';
import { Record } from '../api/schemas/record.schema';
import { CreateOrderRequestDTO } from './dto/create-order.request.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel('Order') private readonly orderModel: Model<Order>,
    @InjectModel('Record') private readonly recordModel: Model<Record>,
  ) {}

  async create(dto: CreateOrderRequestDTO): Promise<Order> {
    // Atomic decrement: only matches if there is enough stock left, so two
    // concurrent orders can't oversell the same record.
    const updated = await this.recordModel.findOneAndUpdate(
      { _id: dto.recordId, qty: { $gte: dto.quantity } },
      { $inc: { qty: -dto.quantity } },
      { new: true },
    );

    if (!updated) {
      const exists = await this.recordModel.exists({ _id: dto.recordId });
      if (!exists) throw new NotFoundException(`Record ${dto.recordId} not found`);
      throw new ConflictException('Not enough stock for this record');
    }

    return this.orderModel.create({
      recordId: updated._id,
      quantity: dto.quantity,
      unitPrice: updated.price,
      total: updated.price * dto.quantity,
    });
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }
}
