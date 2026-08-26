import {
  Controller, Get, Post, Param, Body,
  UseGuards, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  IsUUID, IsEnum, IsNumber, IsOptional,
  IsString, Min, IsIn,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, BadRequestException } from '@nestjs/common';
import { MouvementStock } from '../../database/entities/stock.entity';
import { Lot } from '../../database/entities/stock.entity';
import { MouvementType, StatutLot } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateMouvementDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  lotId?: string;

  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  emplacementId?: string;

  @ApiProperty({ enum: MouvementType })
  @IsEnum(MouvementType)
  typeMouvement: MouvementType;

  @ApiProperty({ description: 'Quantité positive (le sens détermine entrée/sortie)' })
  @IsNumber() @Min(0.001)
  quantite: number;

  @ApiProperty({ description: '+1 = entrée, -1 = sortie', enum: [1, -1] })
  @IsIn([1, -1])
  sens: 1 | -1;

  @ApiProperty({ required: false, description: 'Type de l\'origine: OF/COMMANDE_ACHAT/COMMANDE_CLIENT/INVENTAIRE' })
  @IsOptional() @IsString()
  origineType?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  origineId?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  prixUnitaire?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class MouvementsService {
  constructor(
    @InjectRepository(MouvementStock)
    private readonly repo: Repository<MouvementStock>,
    @InjectRepository(Lot)
    private readonly lotRepo: Repository<Lot>,
    private readonly dataSource: DataSource,
  ) {}

  // ── US-031 : Créer un mouvement ───────────────────────────────────────────
  async create(dto: CreateMouvementDto, userId: string): Promise<MouvementStock> {
    // RG02 : Vérifier que le stock ne devient pas négatif pour les sorties
    if (dto.sens === -1 && dto.typeMouvement !== MouvementType.RESERVATION) {
      const stockActuel = await this.getStockActuelArticle(dto.articleId, dto.siteId);
      if (stockActuel.stockDisponible < dto.quantite) {
        throw new BadRequestException(
          `RG02 : Stock insuffisant. Disponible: ${stockActuel.stockDisponible}, Demandé: ${dto.quantite}`,
        );
      }
    }

    // RG03 : Lot en QUARANTAINE non consommable
    if (dto.lotId && dto.sens === -1) {
      const lot = await this.lotRepo.findOne({ where: { id: dto.lotId } });
      if (lot?.statut === StatutLot.QUARANTAINE) {
        throw new BadRequestException(
          `RG03 : Le lot ${lot.numero} est en QUARANTAINE — consommation interdite`,
        );
      }
    }

    const mouvement = this.repo.create({
      ...dto,
      createdBy: userId,
    });

    return this.repo.save(mouvement) as unknown as Promise<MouvementStock>;
  }

  // ── US-032 : Stock actuel depuis vue matérialisée ─────────────────────────
  async getStockActuel(filters: {
    articleId?: string;
    siteId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { articleId, siteId, search } = filters;
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;

    let query = `
      SELECT
        s.*,
        CASE
          WHEN s.stock_disponible <= 0 THEN 'RUPTURE'
          WHEN s.stock_disponible <= s.stock_mini THEN 'CRITIQUE'
          WHEN s.stock_disponible <= s.stock_mini * 1.20 THEN 'ALERTE'
          WHEN s.stock_maxi IS NOT NULL AND s.stock_actuel > s.stock_maxi THEN 'SURSTOCK'
          ELSE 'OK'
        END AS statut_alerte
      FROM mv_stock_actuel s
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIdx = 1;

    if (articleId) {
      query += ` AND s.article_id = $${paramIdx++}`;
      params.push(articleId);
    }
    if (siteId) {
      query += ` AND s.site_id = $${paramIdx++}`;
      params.push(siteId);
    }
    if (search) {
      query += ` AND (s.reference ILIKE $${paramIdx} OR s.designation ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    const countQuery = `SELECT COUNT(*) FROM (${query}) t`;
    const countResult = await this.dataSource.query(countQuery, params);
    const total = parseInt(countResult[0].count);

    query += ` ORDER BY statut_alerte DESC, s.reference ASC`;
    query += ` LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, (page - 1) * limit);

    const data = await this.dataSource.query(query, params);

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── US-033 : Alertes stock ─────────────────────────────────────────────────
  async getAlertes() {
    const result = await this.dataSource.query(`
      SELECT
        s.article_id,
        s.site_id,
        s.reference,
        s.designation,
        s.unite_mesure,
        s.stock_actuel,
        s.stock_disponible,
        s.stock_reserve,
        s.stock_mini,
        s.valeur_stock,
        CASE
          WHEN s.stock_disponible <= 0 THEN 'RUPTURE'
          WHEN s.stock_disponible <= s.stock_mini THEN 'CRITIQUE'
          WHEN s.stock_disponible <= s.stock_mini * 1.20 THEN 'ALERTE'
          WHEN s.stock_maxi IS NOT NULL AND s.stock_actuel > s.stock_maxi THEN 'SURSTOCK'
          ELSE 'OK'
        END AS statut_alerte,
        -- Couverture en jours (basée sur consommation 30 derniers jours)
        CASE
          WHEN s.stock_disponible <= 0 THEN 0
          ELSE ROUND(
            s.stock_disponible / NULLIF(
              (SELECT COALESCE(SUM(m.quantite), 0) / 30
               FROM mouvements_stock m
               WHERE m.article_id = s.article_id
                 AND m.site_id = s.site_id
                 AND m.sens = -1
                 AND m.type_mouvement = 'SORTIE_CONSOMMATION'
                 AND m.created_at >= NOW() - INTERVAL '30 days'),
              0
            )
          , 1)
        END AS couverture_jours
      FROM mv_stock_actuel s
      WHERE s.stock_disponible <= s.stock_mini * 1.20
         OR (s.stock_maxi IS NOT NULL AND s.stock_actuel > s.stock_maxi)
      ORDER BY
        CASE
          WHEN s.stock_disponible <= 0 THEN 1
          WHEN s.stock_disponible <= s.stock_mini THEN 2
          WHEN s.stock_disponible <= s.stock_mini * 1.20 THEN 3
          ELSE 4
        END ASC,
        s.reference ASC
    `);

    return result;
  }

  // ── Stock actuel d'un article pour vérification interne ──────────────────
  async getStockActuelArticle(articleId: string, siteId: string) {
    const result = await this.dataSource.query(`
      SELECT
        COALESCE(stock_actuel, 0) as stock_actuel,
        COALESCE(stock_disponible, 0) as stock_disponible,
        COALESCE(stock_reserve, 0) as stock_reserve
      FROM mv_stock_actuel
      WHERE article_id = $1 AND site_id = $2
    `, [articleId, siteId]);

    return result[0] || { stock_actuel: 0, stock_disponible: 0, stock_reserve: 0 };
  }

  // ── Historique mouvements ─────────────────────────────────────────────────
  findAll(filters: {
    articleId?: string;
    lotId?: string;
    siteId?: string;
    typeMouvement?: MouvementType;
    page?: number;
    limit?: number;
  }) {
    const { articleId, lotId, siteId, typeMouvement, page = 1, limit = 50 } = filters;

    const qb = this.repo.createQueryBuilder('m')
      .leftJoinAndSelect('m.article', 'article')
      .leftJoinAndSelect('m.lot', 'lot')
      .leftJoinAndSelect('m.site', 'site')
      .where('1=1');

    if (articleId) qb.andWhere('m.article_id = :articleId', { articleId });
    if (lotId) qb.andWhere('m.lot_id = :lotId', { lotId });
    if (siteId) qb.andWhere('m.site_id = :siteId', { siteId });
    if (typeMouvement) qb.andWhere('m.type_mouvement = :typeMouvement', { typeMouvement });

    return qb
      .orderBy('m.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
      .then(([data, total]) => ({ data, total, page, limit }));
  }

  // ── Traçabilité d'un lot ──────────────────────────────────────────────────
  async tracabiliteLot(numero: string) {
    const result = await this.dataSource.query(`
      WITH RECURSIVE tracabilite AS (
        SELECT
          l.id AS lot_id,
          l.numero AS lot_numero,
          a.reference AS article_ref,
          a.designation AS article_nom,
          0 AS profondeur
        FROM lots l
        JOIN articles a ON a.id = l.article_id
        WHERE l.numero = $1

        UNION ALL

        SELECT
          l2.id,
          l2.numero,
          a2.reference,
          a2.designation,
          t.profondeur + 1
        FROM lots l2
        JOIN articles a2 ON a2.id = l2.article_id
        JOIN consommations_mp c ON c.lot_id = l2.id
        JOIN ordres_fabrication of2 ON of2.id = c.of_id
        JOIN lots l3 ON l3.id = of2.lot_pf_id
        JOIN tracabilite t ON t.lot_id = l3.id
        WHERE t.profondeur < 5
      )
      SELECT DISTINCT profondeur, lot_numero, article_ref, article_nom
      FROM tracabilite
      ORDER BY profondeur, lot_numero
    `, [numero]);

    return result;
  }
}

// ── Controller Mouvements ─────────────────────────────────────────────────────
@ApiTags('stock')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mouvements')
export class MouvementsController {
  constructor(private readonly service: MouvementsService) {}

  @Get()
  @ApiOperation({ summary: 'Historique des mouvements de stock' })
  @ApiQuery({ name: 'articleId', required: false })
  @ApiQuery({ name: 'lotId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'typeMouvement', required: false, enum: MouvementType })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(
    @Query('articleId') articleId?: string,
    @Query('lotId') lotId?: string,
    @Query('siteId') siteId?: string,
    @Query('typeMouvement') typeMouvement?: MouvementType,
    @Query('page') page?: number,
  ) {
    return this.service.findAll({ articleId, lotId, siteId, typeMouvement, page });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GEST_STOCK, UserRole.RESP_PROD, UserRole.OPERATEUR)
  @ApiOperation({ summary: 'Créer un mouvement de stock — RG02 (stock négatif) + RG03 (quarantaine)' })
  create(@Body() dto: CreateMouvementDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user.id);
  }
}

// ── Controller Stock ──────────────────────────────────────────────────────────
@ApiTags('stock')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stock')
export class StockController {
  constructor(private readonly service: MouvementsService) {}

  @Get('actuel')
  @ApiOperation({ summary: 'Stock actuel temps réel (mv_stock_actuel) — US-032' })
  @ApiQuery({ name: 'articleId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  getStockActuel(
    @Query('articleId') articleId?: string,
    @Query('siteId') siteId?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
  ) {
    return this.service.getStockActuel({ articleId, siteId, search, page });
  }

  @Get('alertes')
  @ApiOperation({ summary: 'Articles en rupture, critique ou surstock — US-033' })
  getAlertes() {
    return this.service.getAlertes();
  }

  @Get('tracabilite/:numero')
  @ApiOperation({ summary: 'Traçabilité ascendante d\'un lot — US-082' })
  tracabilite(@Param('numero') numero: string) {
    return this.service.tracabiliteLot(numero);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([MouvementStock, Lot])],
  controllers: [MouvementsController, StockController],
  providers: [MouvementsService],
  exports: [MouvementsService],
})
export class MouvementsModule {}