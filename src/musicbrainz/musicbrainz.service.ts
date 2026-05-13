import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { firstValueFrom } from 'rxjs';
import type Redis from 'ioredis';
import { TrackEntry } from '../api/schemas/record.schema';
import { REDIS_CLIENT } from '../redis/redis.module';

const ONE_DAY_SECONDS = 24 * 60 * 60;

@Injectable()
export class MusicBrainzService {
  private readonly logger = new Logger(MusicBrainzService.name);
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === 'medium' || name === 'track',
  });

  constructor(
    private readonly http: HttpService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async fetchTracklist(mbid: string): Promise<TrackEntry[] | null> {
    const key = `mb:tracklist:${mbid}`;
    const cached = await this.redis.get(key);
    if (cached !== null) {
      this.logger.log(`cache HIT for ${mbid}`);
      return JSON.parse(cached);
    }
    this.logger.log(`cache MISS for ${mbid} — fetching from MusicBrainz`);

    let xml: string;
    try {
      const res = await firstValueFrom(
        this.http.get<string>(`https://musicbrainz.org/ws/2/release/${mbid}`, {
          params: { inc: 'recordings' },
          headers: {
            'User-Agent': 'BrokenRecordStoreAPI/0.1 (contact@brokenrecord.example)',
            Accept: 'application/xml',
          },
          timeout: 5000,
          responseType: 'text',
          transformResponse: (raw) => raw,
        }),
      );
      xml = res.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        await this.redis.set(key, 'null', 'EX', ONE_DAY_SECONDS);
        return null;
      }
      throw err;
    }

    const tracks = this.parseTracks(xml);
    await this.redis.set(key, JSON.stringify(tracks), 'EX', ONE_DAY_SECONDS);
    return tracks;
  }

  private parseTracks(xml: string): TrackEntry[] {
    const release = this.parser.parse(xml)?.metadata?.release;
    const media = release?.['medium-list']?.medium ?? [];

    const tracks: TrackEntry[] = [];
    for (const medium of media) {
      for (const t of medium['track-list']?.track ?? []) {
        const title = t.recording?.title;
        if (!title) continue;
        tracks.push({
          title: String(title),
          length: t.length ? Number(t.length) : undefined,
        });
      }
    }
    return tracks;
  }
}
