import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log(`[Migration] Starting database migration on engine: ${db.getEngineType()}...`);
  try {
    let schemaPath = path.resolve(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve(process.cwd(), 'apps/backend/src/db/schema.sql');
    }
    const sql = fs.readFileSync(schemaPath, 'utf-8');

    // Execute multi-statement schema DDL
    await db.exec(sql);

    // Verify key tables were created
    const tablesCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`[Migration] Database migration successful! Total tables created: ${tablesCheck.rows.length}`);
    const tableNames = tablesCheck.rows.map((r: any) => r.table_name).join(', ');
    console.log(`[Migration] Tables: ${tableNames}`);
    return true;
  } catch (error) {
    console.error('[Migration] Migration failed:', error);
    throw error;
  }
}

if (process.argv[1]?.endsWith('migrate.ts') || process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(async () => {
      await db.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
