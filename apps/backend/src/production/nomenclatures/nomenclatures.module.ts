import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  IsUUID, IsNumber, IsOptional, IsString,
  IsDateString, IsEnum, Min, IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Nomenclature } from '../../database/entities/production.entity';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateNomenclatureDto {
  @ApiProperty({ description: 'Article parent (produit fini ou semi-fini)' })
  @IsUUID()
  articleParent: string;

  @ApiProperty({ description: 'Composant (matière première ou sous-composant)' })
  @IsUUID()
  composantId: string;

  @ApiProperty({ example: 2.5 })
  @IsNumber() @Min(0.0001)
  quantite: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  unite?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional() @IsNumber() @Min(1)
  niveau?: number;

  @ApiProperty({ required: false, enum: ['FIXE', 'VARIABLE', 'OPTION'], default: 'FIXE' })
  @IsOptional() @IsString()
  typeLien?: string;

  @ApiProperty({ required: false, default: 0, description: 'Taux de perte en %' })
  @IsOptional() @IsNumber() @Min(0)
  tauxPertePct?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  operationId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  substitutId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateDebut?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateFin?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class NomenclaturesService {
  constructor(
    @InjectRepository(Nomenclature)
    private readonly repo: Repository<Nomenclature>,
    private readonly dataSource: DataSource,
  ) {}

  async findByArticle(articleId: string, niveaux: number = 1) {
    if (niveaux > 1) {
      // Requête récursive pour arbre complet
      return this.dataSource.query(`
        WITH RECURSIVE bom AS (
          SELECT
            n.id, n.article_parent, n.composant_id, n.quantite,
            n.qte_avec_perte, n.taux_perte_pct, n.type_lien,
            n.unite, n.niveau,
            a.reference AS composant_ref,
            a.designation AS composant_nom,
            a.unite_mesure,
            a.type AS article_type,
            1 AS profondeur
          FROM nomenclatures n
          JOIN articles a ON a.id = n.composant_id
          WHERE n.article_parent = $1
            AND n.actif = true
            AND (n.date_fin IS NULL OR n.date_fin >= CURRENT_DATE)

          UNION ALL

          SELECT
            n.id, n.article_parent, n.composant_id, n.quantite,
            n.qte_avec_perte, n.taux_perte_pct, n.type_lien,
            n.unite, n.niveau,
            a.reference, a.designation, a.unite_mesure, a.type,
            bom.profondeur + 1
          FROM nomenclatures n
          JOIN articles a ON a.id = n.composant_id
          JOIN bom ON bom.composant_id = n.article_parent
          WHERE n.actif = true
            AND (n.date_fin IS NULL OR n.date_fin >= CURRENT_DATE)
            AND bom.profondeur < 5
        )
        SELECT * FROM bom ORDER BY profondeur, composant_ref
      `, [articleId]);
    }

    return this.repo.find({
      where: { articleParent: articleId, actif: true },
      relations: ['composant', 'substitut', 'operation'],
      order: { niveau: 'ASC' },
    });
  }

  async create(dto: CreateNomenclatureDto) {
    // RG01 : Anti-cycle
    if (dto.articleParent === dto.composantId) {
      throw new BadRequestException('RG01 : Un article ne peut pas être son propre composant');
    }

    // Vérifier cycle indirect
    const cycleCheck = await this.dataSource.query(`
      WITH RECURSIVE chemin AS (
        SELECT composant_id FROM nomenclatures
        WHERE article_parent = $1 AND actif = true
        UNION ALL
        SELECT n.composant_id FROM nomenclatures n
        JOIN chemin c ON c.composant_id = n.article_parent
        WHERE n.actif = true
      )
      SELECT 1 FROM chemin WHERE composant_id = $2 LIMIT 1
    `, [dto.composantId, dto.articleParent]);

    if (cycleCheck.length > 0) {
      throw new BadRequestException('RG01 : Cette nomenclature créerait un cycle circulaire');
    }

    const nomenclature = this.repo.create({
      ...dto,
      dateDebut: dto.dateDebut ? new Date(dto.dateDebut) : new Date(),
      dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
      actif: true,
    });

    return this.repo.save(nomenclature) as unknown as Promise<Nomenclature>;
  }

  async update(id: string, dto: Partial<CreateNomenclatureDto>) {
    await this.repo.update(id, {
      ...dto,
      dateFin: dto.dateFin ? new Date(dto.dateFin) : undefined,
    });
    return this.repo.findOne({ where: { id }, relations: ['composant'] });
  }

  async desactiver(id: string) {
    await this.repo.update(id, { actif: false, dateFin: new Date() });
  }

  // Calcul besoins total pour une quantité d'OF
  async calculerBesoins(articleId: string, quantite: number) {
    const composants = await this.dataSource.query(`
      SELECT
        n.composant_id,
        a.reference,
        a.designation,
        a.unite_mesure,
        a.type,
        n.qte_avec_perte,
        n.qte_avec_perte * $2 AS qte_necessaire,
        COALESCE(s.stock_disponible, 0) AS stock_disponible,
        GREATEST(0, n.qte_avec_perte * $2 - COALESCE(s.stock_disponible, 0)) AS manquant
      FROM nomenclatures n
      JOIN articles a ON a.id = n.composant_id
      LEFT JOIN mv_stock_actuel s ON s.article_id = n.composant_id
      WHERE n.article_parent = $1
        AND n.actif = true
        AND (n.date_fin IS NULL OR n.date_fin >= CURRENT_DATE)
      ORDER BY a.reference
    `, [articleId, quantite]);

    return {
      articleId,
      quantite,
      composants,
      estFaisable: composants.every((c: any) => parseFloat(c.manquant) === 0),
    };
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('production')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nomenclatures')
export class NomenclaturesController {
  constructor(private readonly service: NomenclaturesService) {}

  @Get()
  @ApiOperation({ summary: 'Nomenclature d\'un article (BOM multi-niveaux) — US-050' })
  @ApiQuery({ name: 'articleId', required: true })
  @ApiQuery({ name: 'niveaux', required: false, type: Number, description: 'Profondeur (1=direct, 5=complet)' })
  findByArticle(
    @Query('articleId') articleId: string,
    @Query('niveaux') niveaux?: number,
  ) {
    return this.service.findByArticle(articleId, niveaux ? Number(niveaux) : 1);
  }

  @Get('besoins')
  @ApiOperation({ summary: 'Calcul des besoins MP pour une quantité donnée' })
  @ApiQuery({ name: 'articleId', required: true })
  @ApiQuery({ name: 'quantite', required: true, type: Number })
  calculerBesoins(
    @Query('articleId') articleId: string,
    @Query('quantite') quantite: number,
  ) {
    return this.service.calculerBesoins(articleId, Number(quantite));
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Créer une ligne de nomenclature — RG01 anti-cycle' })
  create(@Body() dto: CreateNomenclatureDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Modifier une ligne de nomenclature' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateNomenclatureDto,
  ) {
    return this.service.update(id, dto);
  }

  @Put(':id/desactiver')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Désactiver une ligne de nomenclature' })
  desactiver(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.desactiver(id);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([Nomenclature])],
  controllers: [NomenclaturesController],
  providers: [NomenclaturesService],
  exports: [NomenclaturesService],
})
export class NomenclaturesModule {}
