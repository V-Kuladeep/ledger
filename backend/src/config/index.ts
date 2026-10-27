import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'file:./ledger.db',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  isTest: process.env.NODE_ENV === 'test',
};
