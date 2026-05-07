import { Test, TestingModule } from '@nestjs/testing';
import { RecordController } from './record.controller';
import { RecordService } from '../services/record.service';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';
import { FindRecordsQueryDTO } from '../dtos/find-records.query.dto';

describe('RecordController', () => {
  let recordController: RecordController;
  let recordService: jest.Mocked<RecordService>;

  beforeEach(async () => {
    const serviceMock: Partial<jest.Mocked<RecordService>> = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecordController],
      providers: [{ provide: RecordService, useValue: serviceMock }],
    }).compile();

    recordController = module.get<RecordController>(RecordController);
    recordService = module.get(RecordService) as jest.Mocked<RecordService>;
  });

  it('delegates create to the service', async () => {
    const dto: CreateRecordRequestDTO = {
      artist: 'Test',
      album: 'Test Record',
      price: 100,
      qty: 10,
      format: RecordFormat.VINYL,
      category: RecordCategory.ALTERNATIVE,
    };
    const saved = { _id: '1', ...dto } as any;
    recordService.create.mockResolvedValue(saved);

    const result = await recordController.create(dto);
    expect(result).toEqual(saved);
    expect(recordService.create).toHaveBeenCalledWith(dto);
  });

  it('delegates update to the service', async () => {
    const id = '507f1f77bcf86cd799439011';
    const dto: UpdateRecordRequestDTO = { price: 150, qty: 5 };
    const updated = { _id: id, ...dto } as any;
    recordService.update.mockResolvedValue(updated);

    const result = await recordController.update(id, dto);
    expect(result).toEqual(updated);
    expect(recordService.update).toHaveBeenCalledWith(id, dto);
  });

  it('delegates findOne to the service', async () => {
    const id = '507f1f77bcf86cd799439011';
    const record = { _id: id, artist: 'Test', album: 'Test Record' } as any;
    recordService.findById.mockResolvedValue(record);

    const result = await recordController.findOne(id);
    expect(result).toEqual(record);
    expect(recordService.findById).toHaveBeenCalledWith(id);
  });

  it('delegates findAll to the service with query', async () => {
    const query: FindRecordsQueryDTO = { page: 1, limit: 20 };
    const paginated = {
      data: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    recordService.find.mockResolvedValue(paginated as any);

    const result = await recordController.findAll(query);
    expect(result).toEqual(paginated);
    expect(recordService.find).toHaveBeenCalledWith(query);
  });
});
