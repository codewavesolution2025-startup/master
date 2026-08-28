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
// Sprint 2 — M2 Stocks
import { LotsModule } from './stock/lots/lots.module';
import { MouvementsModule } from './stock/mouvements/mouvements.module';
import { InventairesModule } from './stock/inventaires/inventaires.module';
// Sprint 3 — M3 Achats
import { DemandesAchatModule } from './achats/demandes/demandes-achat.module';
import { CommandesAchatModule } from './achats/commandes/commandes-achat.module';
import { ReceptionsModule } from './achats/receptions/receptions.module';
// Sprint 4 — M4 Production
import { NomenclaturesModule } from './production/nomenclatures/nomenclatures.module';
import { GammesModule } from './production/gammes/gammes.module';
import { OrdresFabricationModule } from './production/ordres-fabrication/of.module';
// Sprint 5 — M5 Qualité
import { QualiteModule } from './qualite/plans-controle/qualite.module';
import { NonConformitesModule } from './qualite/non-conformites/non-conformites.module';
// Sprint 6 — M6 Expéditions
import { ExpeditionsModule } from './expeditions/expeditions.module';
// Sprint 7 — M8 Reporting
import { AiModule } from './ai/ai.module';
import { ReportingModule } from './reporting/reporting.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RhModule } from './rh/rh.module';
import { DeploiementsModule } from './admin/deploiements.module';


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
        // Render (et la plupart des Postgres hébergés) exigent SSL sur les
        // connexions externes. Activer avec DB_SSL=true dans les variables
        // d'environnement de production. rejectUnauthorized: false car ces
        // fournisseurs utilisent des certificats auto-signés.
        ssl:
          config.get<string>('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
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
    // Sprint 2 — M2 Stocks
    LotsModule,
    MouvementsModule,
    InventairesModule,
    // Sprint 3 — M3 Achats
    DemandesAchatModule,
    CommandesAchatModule,
    ReceptionsModule,
    // Sprint 4 — M4 Production
    NomenclaturesModule,
    GammesModule,
    OrdresFabricationModule,
    // Sprint 5 — M5 Qualité
    QualiteModule,
    NonConformitesModule,
    // Sprint 6 — M6 Expéditions
    ExpeditionsModule,
    // Sprint 7 — M8 Reporting
    ReportingModule,
    AiModule,
    DashboardModule,
    RhModule,
    DeploiementsModule,
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
