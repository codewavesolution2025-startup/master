import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from './app.module';

// ── Instance Express partagée ──────────────────────────────────────────────
// Sur Vercel, le code tourne en fonction serverless : chaque invocation
// (re)charge ce module, qui doit exporter soit une fonction (req, res),
// soit un serveur (instance Express). On construit donc l'app Nest par
// dessus une instance Express que l'on exporte, au lieu d'appeler
// uniquement `app.listen()` (qui ne fonctionne que pour un process
// long-vivant, pas pour une fonction serverless).
const server = express();

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));

  // ── Global prefix ──────────────────────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ── Validation pipe ────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,          // strip properties not in DTO
      forbidNonWhitelisted: true,
      transform: true,          // auto-transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ── CORS ───────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // ── Swagger ────────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Supply Chain Industrielle — API')
    .setDescription('API complète de gestion de la supply chain industrielle')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addTag('auth', 'Authentification et gestion des sessions')
    .addTag('articles', 'Référentiel articles (MP, SF, PF, Consommable)')
    .addTag('fournisseurs', 'Gestion des fournisseurs')
    .addTag('clients', 'Gestion des clients')
    .addTag('sites', 'Sites et emplacements')
    .addTag('stock', 'Mouvements et stocks')
    .addTag('lots', 'Traçabilité des lots')
    .addTag('achats', 'Commandes achat et réceptions')
    .addTag('production', 'Ordres de fabrication et déclarations')
    .addTag('qualite', 'Contrôles et non-conformités')
    .addTag('expeditions', 'Commandes clients et bons de livraison')
    .addTag('reporting', 'KPIs et tableaux de bord')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  if (process.env.VERCEL) {
    // ── Serverless (Vercel) ───────────────────────────────────────────────
    // Pas de `listen()` : on initialise juste les modules/routes Nest par
    // dessus l'instance Express déjà exportée plus bas.
    await app.init();
    logger.log('🚀 Backend initialisé (fonction serverless Vercel)');
  } else {
    // ── Local / serveur classique ─────────────────────────────────────────
    const port = process.env.PORT || 3000;
    await app.listen(port);
    logger.log(`🚀 Backend démarré sur http://localhost:${port}`);
    logger.log(`📚 Swagger disponible sur http://localhost:${port}/api/docs`);
  }
}

// Démarré une seule fois par instance de fonction (cold start) ; les
// invocations suivantes réutilisent le module déjà initialisé.
const bootstrapPromise = bootstrap().catch((err) => {
  Logger.error('Échec du démarrage de Nest', err, 'Bootstrap');
  throw err;
});

// Export attendu par le runtime Node de Vercel : une fonction (req, res)
// qui attend que Nest ait fini de s'initialiser avant de déléguer à Express.
export default async function handler(req: Request, res: Response) {
  await bootstrapPromise;
  server(req, res);
}
