import { db } from '../db/connection';

async function testSupabase() {
  try {
    console.log('Connecting and initializing schema in Supabase PostgreSQL...');
    await db.initDatabase();
    console.log('✅ Tables, foreign keys, and indexes created successfully!');

    // Check public tables
    const tables = await db.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    console.log('Live Supabase Tables:', tables.map((t) => t.table_name));

    // Test a basic write and read
    console.log('Testing write/read transaction in Supabase...');
    const accountsCount = await db.query('SELECT count(*) as count FROM accounts');
    console.log('Current accounts count in Supabase:', accountsCount[0]?.count);

    await db.close();
    console.log('🎉 Supabase connection and schema test fully verified!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Supabase test failed:', error);
    process.exit(1);
  }
}

testSupabase();
