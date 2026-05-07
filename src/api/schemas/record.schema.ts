import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { RecordFormat, RecordCategory } from './record.enum';

// strength: 2 = case-insensitive, accent-sensitive.
export const RECORD_COLLATION = { locale: 'en', strength: 2 } as const;

export interface TrackEntry {
  position: number;
  title: string;
  length?: number;
}

@Schema({ timestamps: true })
export class Record extends Document {
  @Prop({ required: true })
  artist: string;

  @Prop({ required: true })
  album: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  qty: number;

  @Prop({ enum: RecordFormat, required: true, index: true })
  format: RecordFormat;

  @Prop({ enum: RecordCategory, required: true, index: true })
  category: RecordCategory;

  @Prop({ required: false, index: true, sparse: true })
  mbid?: string;

  @Prop({
    type: [{ position: Number, title: String, length: Number }],
    default: [],
    _id: false,
  })
  tracklist: TrackEntry[];
}

export const RecordSchema = SchemaFactory.createForClass(Record);

RecordSchema.index(
  { artist: 1, album: 1, format: 1 },
  {
    unique: true,
    name: 'uniq_artist_album_format',
    collation: RECORD_COLLATION,
  },
);

RecordSchema.index(
  { artist: 'text', album: 'text', category: 'text' },
  {
    name: 'text_artist_album_category',
    weights: { artist: 3, album: 3, category: 1 },
  },
);

RecordSchema.index(
  { album: 1 },
  { name: 'album_ci', collation: RECORD_COLLATION },
);
