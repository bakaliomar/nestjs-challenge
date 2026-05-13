import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { MusicBrainzService } from './musicbrainz.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const ABBEY_ROAD_XML = `<?xml version="1.0" encoding="UTF-8"?>
<metadata>
  <release id="b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d">
    <title>Abbey Road</title>
    <medium-list count="1">
      <medium>
        <position>1</position>
        <track-list count="2">
          <track>
            <position>1</position>
            <length>259000</length>
            <recording><title>Come Together</title></recording>
          </track>
          <track>
            <position>2</position>
            <length>183000</length>
            <recording><title>Something</title></recording>
          </track>
        </track-list>
      </medium>
    </medium-list>
  </release>
</metadata>`;

// Tiny in-memory stand-in for ioredis: get/set are all the service uses.
const fakeRedis = () => {
  const store = new Map<string, string>();
  return {
    get: jest.fn(async (key: string) => store.get(key) ?? null),
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
  };
};

describe('MusicBrainzService', () => {
  let service: MusicBrainzService;
  let http: { get: jest.Mock };
  let redis: ReturnType<typeof fakeRedis>;

  beforeEach(async () => {
    http = { get: jest.fn() };
    redis = fakeRedis();
    const module = await Test.createTestingModule({
      providers: [
        MusicBrainzService,
        { provide: HttpService, useValue: http },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = module.get(MusicBrainzService);
  });

  it('parses a tracklist from MusicBrainz XML', async () => {
    http.get.mockReturnValueOnce(of({ data: ABBEY_ROAD_XML }));

    const tracks = await service.fetchTracklist('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');

    expect(tracks).toEqual([
      { title: 'Come Together', length: 259000 },
      { title: 'Something', length: 183000 },
    ]);
  });

  it('caches results for the same mbid', async () => {
    http.get.mockReturnValueOnce(of({ data: ABBEY_ROAD_XML }));

    await service.fetchTracklist('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');
    await service.fetchTracklist('b10bbbfc-cf9e-42e0-be17-e2c3e1d2600d');

    expect(http.get).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);
  });

  it('returns null on a 404 and caches it', async () => {
    http.get.mockReturnValueOnce(throwError(() => ({ response: { status: 404 } })));

    const result = await service.fetchTracklist('00000000-0000-0000-0000-000000000000');

    expect(result).toBeNull();
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('00000000'),
      'null',
      'EX',
      expect.any(Number),
    );
  });
});
