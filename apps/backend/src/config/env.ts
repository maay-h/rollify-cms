import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.string().default('5000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CLIENT_URL: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long').default('rollify_pos_dev_jwt_secret_key_restaurant_2026_phase1'),
  JWT_EXPIRES_IN: z.string().default('24h'),
  DATABASE_URL: z.string().optional().default(''),
  DATABASE_DATA_DIR: z.string().default('./data/postgres'),
  TAX_RATE_DEFAULT: z.string().default('5.00').transform(Number),
  CURRENCY_CODE: z.string().default('INR'),
  CURRENCY_SYMBOL: z.string().default('₹'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
