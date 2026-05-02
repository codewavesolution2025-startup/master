import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

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

  // ── Start ──────────────────────────────────────────────────────────────────
  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`🚀 Backend démarré sur http://localhost:${port}`);
  logger.log(`📚 Swagger disponible sur http://localhost:${port}/api/docs`);
}

bootstrap();
