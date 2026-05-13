import * as dotenv from 'dotenv';

dotenv.config();

export const AppConfig = {
  mongoUrl: process.env.MONGO_URL,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  port: process.env.PORT || 3000,
};
