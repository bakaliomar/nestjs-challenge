import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let recordModel: any;
  let orderModel: any;

  const recordId = '507f1f77bcf86cd799439011';

  beforeEach(async () => {
    recordModel = {
      findOneAndUpdate: jest.fn(),
      exists: jest.fn(),
    };
    orderModel = {
      create: jest.fn().mockImplementation(async (doc) => ({ _id: 'o1', ...doc })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getModelToken('Order'), useValue: orderModel },
        { provide: getModelToken('Record'), useValue: recordModel },
      ],
    }).compile();

    service = moduleRef.get(OrdersService);
  });

  it('decrements stock atomically and creates an order', async () => {
    recordModel.findOneAndUpdate.mockResolvedValueOnce({
      _id: recordId,
      price: 25,
      qty: 8,
    });

    const order = await service.create({ recordId, quantity: 2 });

    expect(recordModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: recordId, qty: { $gte: 2 } },
      { $inc: { qty: -2 } },
      { new: true },
    );
    expect(orderModel.create).toHaveBeenCalledWith({
      recordId,
      quantity: 2,
      unitPrice: 25,
      total: 50,
    });
    expect(order).toMatchObject({ quantity: 2, unitPrice: 25, total: 50 });
  });

  it('throws 404 when the record does not exist', async () => {
    recordModel.findOneAndUpdate.mockResolvedValueOnce(null);
    recordModel.exists.mockResolvedValueOnce(null);

    await expect(
      service.create({ recordId, quantity: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(orderModel.create).not.toHaveBeenCalled();
  });

  it('throws 409 when there is not enough stock', async () => {
    recordModel.findOneAndUpdate.mockResolvedValueOnce(null);
    recordModel.exists.mockResolvedValueOnce({ _id: recordId });

    await expect(
      service.create({ recordId, quantity: 100 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orderModel.create).not.toHaveBeenCalled();
  });
});
