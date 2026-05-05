import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { MusicBrainzService } from './musicbrainz.service';

@Module({
  imports: [HttpModule],
  providers: [MusicBrainzService],
  exports: [MusicBrainzService],
})
export class MusicBrainzModule {}
