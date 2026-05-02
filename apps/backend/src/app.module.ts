import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UtilisateursModule } from './utilisateurs/utilisateurs.module';
import { JwtAuthGuard, RolesGuard } from './auth/guards/auth.guard';
import { SitesModule } from './referentiels/sites/sites.module';
import { ArticlesModule } from './referentiels/articles/articles.module';
import { FournisseursModule } from './referentiels/fournisseurs/fournisseurs.module';
import { ClientsModule, PostesChargeModule } from './referentiels/clients-postes.module';

@Module({
  imports: [
    // ── Configuration (.env) ─────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ── TypeORM + PostgreSQL ─────────────────────────────────────────────────
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'supplychain'),
        password: config.get<string>('DB_PASS', 'supplychain'),
        database: config.get<string>('DB_NAME', 'supply_chain'),
        // Entities will be auto-loaded from all modules
        autoLoadEntities: true,
        // IMPORTANT: synchronize = false en production — on utilise les migrations
        synchronize: false,
        logging: config.get<string>('NODE_ENV') === 'development',
        // PostgreSQL session variable pour les triggers d'audit
        // Injecté dans chaque requête via middleware JWT (US-011)
        extra: {
          options: '-c timezone=UTC',
        },
      }),
    }),

    // ── Modules Sprint 1 ───────────────────────────────────────────────────
    AuthModule,
    UtilisateursModule,
    // M1 Référentiels
    SitesModule,
    ArticlesModule,
    FournisseursModule,
    ClientsModule,
    PostesChargeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards globaux — toutes les routes protégées par défaut
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
