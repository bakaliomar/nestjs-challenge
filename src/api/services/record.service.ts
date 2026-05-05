import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { RECORD_COLLATION, Record, TrackEntry } from '../schemas/record.schema';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import {
  FindRecordsQueryDTO,
  PaginatedRecords,
} from '../dtos/find-records.query.dto';
import { MusicBrainzService } from '../../musicbrainz/musicbrainz.service';

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class RecordService {
  constructor(
    @InjectModel('Record') private readonly recordModel: Model<Record>,
    private readonly musicBrainz: MusicBrainzService,
  ) {}

  async create(dto: CreateRecordRequestDTO): Promise<Record> {
    const tracklist = dto.mbid ? await this.tracklistFor(dto.mbid) : [];
    try {
      return await this.recordModel.create({
        ...dto,
        tracklist,
        lastModified: new Date(),
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(
          'A record with this artist, album and format already exists.',
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateRecordRequestDTO): Promise<Record> {
    const existing = await this.recordModel.findById(id);
    if (!existing) throw new NotFoundException(`Record ${id} not found`);

    const update: Partial<Record> & UpdateRecordRequestDTO = {
      ...dto,
      lastModified: new Date(),
    };

    if (dto.mbid !== undefined && dto.mbid !== existing.mbid) {
      update.tracklist = dto.mbid ? await this.tracklistFor(dto.mbid) : [];
    }

    try {
      const updated = await this.recordModel.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      });
      if (!updated) throw new NotFoundException(`Record ${id} not found`);
      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException(
          'A record with this artist, album and format already exists.',
        );
      }
      throw err;
    }
  }

  async findById(id: string): Promise<Record> {
    const record = await this.recordModel.findById(id).exec();
    if (!record) throw new NotFoundException(`Record ${id} not found`);
    return record;
  }

  async find(query: FindRecordsQueryDTO): Promise<PaginatedRecords<Record>> {
    const { q, artist, album, format, category, page, limit } = query;

    const filter: FilterQuery<Record> = {};
    let sort: { [key: string]: unknown } = { _id: 1 };
    let useCollation = false;

    if (q) {
      filter.$text = { $search: q };
      sort = { score: { $meta: 'textScore' } };
    }

    if (artist) {
      filter.artist = { $regex: `^${escapeRegex(artist)}` };
      useCollation = true;
    }
    if (album) {
      filter.album = { $regex: `^${escapeRegex(album)}` };
      useCollation = true;
    }
    if (format) filter.format = format;
    if (category) filter.category = category;

    const skip = (page - 1) * limit;

    const dataQuery = this.recordModel
      .find(filter)
      .sort(sort as any)
      .skip(skip)
      .limit(limit)
      .lean();

    const countQuery = this.recordModel.countDocuments(filter);

    if (useCollation) {
      dataQuery.collation(RECORD_COLLATION);
      countQuery.collation(RECORD_COLLATION);
    }

    const [data, total] = await Promise.all([
      dataQuery.exec() as unknown as Promise<Record[]>,
      countQuery.exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  private async tracklistFor(mbid: string): Promise<TrackEntry[]> {
    try {
      return (await this.musicBrainz.fetchTracklist(mbid)) ?? [];
    } catch {
      return [];
    }
  }
}
