import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { firstValueFrom } from 'rxjs';
import { TrackEntry } from '../api/schemas/record.schema';

const ONE_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class MusicBrainzService {
  private readonly cache = new Map<string, { tracks: TrackEntry[] | null; expires: number }>();
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    isArray: (name) => name === 'medium' || name === 'track',
  });

  constructor(private readonly http: HttpService) {}

  async fetchTracklist(mbid: string): Promise<TrackEntry[] | null> {
    const hit = this.cache.get(mbid);
    if (hit && hit.expires > Date.now()) return hit.tracks;

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
        this.cache.set(mbid, { tracks: null, expires: Date.now() + ONE_DAY });
        return null;
      }
      throw err;
    }

    const tracks = this.parseTracks(xml);
    this.cache.set(mbid, { tracks, expires: Date.now() + ONE_DAY });
    return tracks;
  }

  private parseTracks(xml: string): TrackEntry[] {
    const release = this.parser.parse(xml)?.metadata?.release;
    const media = release?.['medium-list']?.medium ?? [];

    const tracks: TrackEntry[] = [];
    let position = 1;
    for (const medium of media) {
      for (const t of medium['track-list']?.track ?? []) {
        const title = t.recording?.title;
        if (!title) continue;
        tracks.push({
          position: position++,
          title: String(title),
          length: t.length ? Number(t.length) : undefined,
        });
      }
    }
    return tracks;
  }
}
