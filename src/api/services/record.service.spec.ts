import { Test } from '@nestjs/testing';
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
});
