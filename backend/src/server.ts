import { createApp } from './app';
import { config } from './config';
import { db } from './db/connection';

async function bootstrap() {
  try {
    console.log('Connecting to database...');
    await db.initDatabase();
    console.log('Database initialized successfully with schemas and constraints.');

    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log(`===============================================`);
      console.log(`🚀 Transaction Ledger API is running!`);
      console.log(`📡 URL: http://localhost:${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`💾 Database: ${config.databaseUrl.includes('supabase') ? 'Supabase PostgreSQL' : config.databaseUrl}`);
      console.log(`===============================================`);
    });

    const shutdown = async () => {
      console.log('\nShutting down gracefully...');
      server.close(async () => {
        await db.close();
        console.log('Server and database connections closed.');
        process.exit(0);
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Fatal error during startup:', error);
    process.exit(1);
  }
}

bootstrap();
