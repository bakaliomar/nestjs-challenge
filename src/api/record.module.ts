import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordController } from './controllers/record.controller';
import { RecordService } from './services/record.service';
import { RecordSchema } from './schemas/record.schema';
import { MusicBrainzModule } from '../musicbrainz/musicbrainz.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: 'Record', schema: RecordSchema }]),
    MusicBrainzModule,
  ],
  controllers: [RecordController],
  providers: [RecordService],
})
export class RecordModule {}
