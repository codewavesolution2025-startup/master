import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Charger le .env pour le CLI TypeORM (migrations)
dotenv.config({ path: join(__dirname, '../../.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'supplychain',
  database: process.env.DB_NAME || 'supply_chain',

  // Entities — chemin vers les fichiers compilés
  entities: [join(__dirname, 'entities/**/*.entity.{ts,js}')],

  // Migrations
  migrations: [join(__dirname, 'migrations/**/*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',

  // IMPORTANT : synchronize = false — on utilise les migrations
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
