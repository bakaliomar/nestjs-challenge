import { Module, ValidationPipe } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { RecordModule } from './api/record.module';
import { AppConfig } from './app.config';

@Module({
  imports: [MongooseModule.forRoot(AppConfig.mongoUrl), RecordModule],
  controllers: [],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ transform: true, whitelist: true }),
    },
  ],
})
export class AppModule {}
