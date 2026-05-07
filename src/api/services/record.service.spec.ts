import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { RecordService } from './record.service';
import { MusicBrainzService } from '../../musicbrainz/musicbrainz.service';
import { RecordCategory, RecordFormat } from '../schemas/record.enum';

const tracks = [
  { position: 1, title: 'Come Together', length: 259000 },
  { position: 2, title: 'Something', length: 183000 },
];

const baseDto = {
  artist: 'The Beatles',
  album: 'Abbey Road',
  price: 30,
  qty: 10,
  format: RecordFormat.VINYL,
  category: RecordCategory.ROCK,
};

describe('RecordService', () => {
  let service: RecordService;
  let model: any;
  let mb: { fetchTracklist: jest.Mock };

  beforeEach(async () => {
    model = {
      create: jest.fn().mockImplementation(async (doc) => ({ _id: 'rec1', ...doc })),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    };
    mb = { fetchTracklist: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RecordService,
        { provide: getModelToken('Record'), useValue: model },
        { provide: MusicBrainzService, useValue: mb },
      ],
    }).compile();

    service = moduleRef.get(RecordService);
  });

  const stubFind = (data: any[], total: number) => {
    const dataChain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      collation: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(data),
    };
    const countChain = {
      collation: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(total),
    };
    model.find.mockReturnValue(dataChain);
    model.countDocuments.mockReturnValue(countChain);
    return { dataChain, countChain };
  };

  it('creates a record and pulls the tracklist when an mbid is given', async () => {
    mb.fetchTracklist.mockResolvedValueOnce(tracks);
    const mbid = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d';

    await service.create({ ...baseDto, mbid });

    expect(mb.fetchTracklist).toHaveBeenCalledWith(mbid);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ mbid, tracklist: tracks }),
    );
  });

  it('does not call MusicBrainz when no mbid is given', async () => {
    await service.create(baseDto);
    expect(mb.fetchTracklist).not.toHaveBeenCalled();
  });

  it('refetches the tracklist on update only when the mbid changes', async () => {
    const existing = { _id: 'rec1', mbid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' };
    model.findById.mockResolvedValue(existing);
    model.findByIdAndUpdate.mockResolvedValue({ ...existing });
    mb.fetchTracklist.mockResolvedValueOnce(tracks);

    await service.update('rec1', { price: 40 });
    expect(mb.fetchTracklist).not.toHaveBeenCalled();

    const newMbid = 'b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d';
    await service.update('rec1', { mbid: newMbid });
    expect(mb.fetchTracklist).toHaveBeenCalledWith(newMbid);
  });

  it('wraps duplicate-key errors as ConflictException on create', async () => {
    model.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(service.create(baseDto)).rejects.toBeInstanceOf(ConflictException);
  });

  it('re-throws non-duplicate errors on create', async () => {
    const boom = new Error('something else');
    model.create.mockRejectedValueOnce(boom);
    await expect(service.create(baseDto)).rejects.toBe(boom);
  });

  it('throws NotFoundException on update when the record does not exist', async () => {
    model.findById.mockResolvedValue(null);
    await expect(service.update('missing', { price: 40 })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(model.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('wraps duplicate-key errors as ConflictException on update', async () => {
    model.findById.mockResolvedValue({ _id: 'rec1', mbid: undefined });
    model.findByIdAndUpdate.mockRejectedValueOnce(
      Object.assign(new Error('dup'), { code: 11000 }),
    );
    await expect(service.update('rec1', { artist: 'X' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('throws NotFoundException on findById when not found', async () => {
    model.findById.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });
    await expect(service.findById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('find computes skip and totalPages from page/limit', async () => {
    const { dataChain } = stubFind([], 25);

    const result = await service.find({ page: 2, limit: 10 } as any);

    expect(dataChain.skip).toHaveBeenCalledWith(10);
    expect(dataChain.limit).toHaveBeenCalledWith(10);
    expect(result.totalPages).toBe(3);
    expect(result.total).toBe(25);
    expect(result.page).toBe(2);
  });

  it('find returns totalPages=0 when there are no results', async () => {
    stubFind([], 0);
    const result = await service.find({ page: 1, limit: 20 } as any);
    expect(result.totalPages).toBe(0);
  });

  it('find uses $text search and orders by textScore when q is given', async () => {
    const { dataChain } = stubFind([], 0);

    await service.find({ q: 'beatles', page: 1, limit: 20 } as any);

    expect(model.find).toHaveBeenCalledWith(
      expect.objectContaining({ $text: { $search: 'beatles' } }),
    );
    expect(dataChain.sort).toHaveBeenCalledWith({ score: { $meta: 'textScore' } });
  });

  it('find anchors the artist regex and escapes metacharacters', async () => {
    stubFind([], 0);

    await service.find({ artist: 'A.C/D*C', page: 1, limit: 20 } as any);

    const filter = model.find.mock.calls[0][0];
    expect(filter.artist.$regex).toBe('^A\\.C/D\\*C');
  });

  it('find enables collation only when artist or album filter is present', async () => {
    const first = stubFind([], 0);
    await service.find({ format: RecordFormat.VINYL, page: 1, limit: 20 } as any);
    expect(first.dataChain.collation).not.toHaveBeenCalled();
    expect(first.countChain.collation).not.toHaveBeenCalled();

    const second = stubFind([], 0);
    await service.find({ artist: 'foo', page: 1, limit: 20 } as any);
    expect(second.dataChain.collation).toHaveBeenCalled();
    expect(second.countChain.collation).toHaveBeenCalled();
  });
});
