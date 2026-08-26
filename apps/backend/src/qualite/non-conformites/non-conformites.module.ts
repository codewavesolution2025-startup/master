import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  IsUUID, IsOptional, IsString, IsEnum,
  IsNumber, IsArray, IsBoolean, Min, IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { NonConformite } from '../../database/entities/qualite.entity';
import { StatutNC, DecisionNC } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateNonConformiteDto {
  @ApiProperty({ enum: ['RECEPTION', 'PRODUCTION', 'CLIENT'] })
  @IsString()
  typeDetection: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  controleId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  ofId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  fournisseurId?: string;

  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray()
  lotsConcernes?: string[];

  @ApiProperty({ enum: ['CRITIQUE', 'MAJEURE', 'MINEURE'] })
  @IsString()
  severite: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional() @IsArray()
  photosUrls?: string[];
}

export class PrendreDecisionDto {
  @ApiProperty({ enum: DecisionNC })
  @IsEnum(DecisionNC)
  decision: DecisionNC;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;

  @ApiProperty({ description: 'Action corrective à mener' })
  @IsString()
  actionCorrective: string;

  @ApiProperty({ description: 'UUID du responsable de l\'action corrective' })
  @IsUUID()
  responsableAc: string;

  @ApiProperty({ description: 'Date limite pour l\'action corrective' })
  @IsDateString()
  delaiAc: string;
}

export class CloturerNcDto {
  @ApiProperty({ description: 'Confirme que l\'efficacité a été vérifiée' })
  @IsBoolean()
  efficaciteVerifiee: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class NonConformitesService {
  constructor(
    @InjectRepository(NonConformite)
    private readonly repo: Repository<NonConformite>,
    private readonly dataSource: DataSource,
  ) {}

  private async genererReference(): Promise<string> {
    const annee = new Date().getFullYear();
    const count = await this.repo.count();
    return `NC-${annee}-${String(count + 1).padStart(5, '0')}`;
  }

  async findAll(filters: {
    statut?: StatutNC;
    fournisseurId?: string;
    articleId?: string;
    typeDetection?: string;
    page?: number;
  }) {
    const { statut, fournisseurId, articleId, typeDetection } = filters;
    const page = Number(filters.page) || 1;
    const qb = this.repo.createQueryBuilder('nc')
      .leftJoinAndSelect('nc.article', 'article')
      .leftJoinAndSelect('nc.fournisseur', 'fournisseur')
      .where('1=1');

    if (statut) qb.andWhere('nc.statut = :statut', { statut });
    if (fournisseurId) qb.andWhere('nc.fournisseur_id = :fournisseurId', { fournisseurId });
    if (articleId) qb.andWhere('nc.article_id = :articleId', { articleId });
    if (typeDetection) qb.andWhere('nc.type_detection = :typeDetection', { typeDetection });

    const [data, total] = await qb
      .orderBy('nc.createdAt', 'DESC')
      .skip((page - 1) * 20)
      .take(20)
      .getManyAndCount();

    return { data, total, page };
  }

  async findOne(id: string) {
    const nc = await this.repo.findOne({
      where: { id },
      relations: ['article', 'fournisseur', 'controle', 'of'],
    });
    if (!nc) throw new NotFoundException(`NC ${id} introuvable`);
    return nc;
  }

  async create(dto: CreateNonConformiteDto, userId: string) {
    const reference = await this.genererReference();
    const nc = this.repo.create({
      ...dto,
      reference,
      statut: StatutNC.OUVERTE,
      createdBy: userId,
    });
    const saved = await this.repo.save(nc);

    // US-065 : Recalculer score fournisseur si NC de réception
    if (dto.fournisseurId && dto.typeDetection === 'RECEPTION') {
      await this.recalculerScoreFournisseur(dto.fournisseurId);
    }

    return saved;
  }

  // ── Workflow NC ────────────────────────────────────────────────────────────
  async analyser(id: string) {
    const nc = await this.findOne(id);
    if (nc.statut !== StatutNC.OUVERTE) {
      throw new BadRequestException(`NC en statut ${nc.statut}`);
    }
    await this.repo.update(id, { statut: StatutNC.EN_ANALYSE });
    return this.findOne(id);
  }

  async prendreDecision(id: string, dto: PrendreDecisionDto, userId: string) {
    const nc = await this.findOne(id);
    if (![StatutNC.OUVERTE, StatutNC.EN_ANALYSE].includes(nc.statut)) {
      throw new BadRequestException(`NC en statut ${nc.statut} — décision impossible`);
    }
    await this.repo.update(id, {
      statut: StatutNC.EN_ATTENTE_DECISION,
      decision: dto.decision,
      decisionPar: userId,
      dateDecision: new Date(),
      commentaireDec: dto.commentaire,
      actionCorrective: dto.actionCorrective,
      responsableAc: dto.responsableAc,
      delaiAc: new Date(dto.delaiAc),
    });
    return this.findOne(id);
  }

  async cloturer(id: string, dto: CloturerNcDto) {
    const nc = await this.findOne(id);

    if (!nc.actionCorrective || !nc.responsableAc || !nc.delaiAc) {
      throw new BadRequestException(
        'Action corrective, responsable et délai obligatoires avant clôture'
      );
    }

    if (!dto.efficaciteVerifiee) {
      throw new BadRequestException(
        'L\'efficacité de l\'action corrective doit être vérifiée avant clôture'
      );
    }

    await this.repo.update(id, {
      statut: StatutNC.CLOTUREE,
      efficaciteVerifiee: true,
    });

    return this.findOne(id);
  }

  // ── US-065 : Recalcul score fournisseur ───────────────────────────────────
  private async recalculerScoreFournisseur(fournisseurId: string) {
    const otdResult = await this.dataSource.query(`
      SELECT
        COUNT(*) FILTER (WHERE r.date_reception <= lca.date_livr_souhaitee) AS a_temps,
        COUNT(*) AS total
      FROM receptions r
      JOIN commandes_achat ca ON ca.id = r.commande_achat_id
      JOIN lignes_commande_achat lca ON lca.commande_id = ca.id
      WHERE ca.fournisseur_id = $1
        AND r.date_reception >= NOW() - INTERVAL '12 months'
    `, [fournisseurId]);

    const total = parseInt(otdResult[0]?.total || '0');
    const otd = total > 0 ? (parseInt(otdResult[0].a_temps) / total) * 100 : 100;

    const ncResult = await this.dataSource.query(`
      SELECT COUNT(*) AS nb FROM non_conformites
      WHERE fournisseur_id = $1
        AND type_detection = 'RECEPTION'
        AND created_at >= NOW() - INTERVAL '12 months'
    `, [fournisseurId]);

    const nbNc = parseInt(ncResult[0]?.nb || '0');
    const tauxQualite = total > 0 ? Math.max(0, 100 - (nbNc / total) * 100) : 100;
    const score = Math.round((otd * 0.30 + tauxQualite * 0.70) * 100) / 100;

    await this.dataSource.query(
      `UPDATE fournisseurs SET score_qualite = $1 WHERE id = $2`,
      [score, fournisseurId],
    );
  }

  // Stats NC
  async getStats() {
    return this.dataSource.query(`
      SELECT
        statut,
        severite,
        type_detection,
        COUNT(*) AS nb,
        COALESCE(SUM(cout_estime), 0) AS cout_total
      FROM non_conformites
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY statut, severite, type_detection
      ORDER BY statut, severite
    `);
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('qualite')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('non-conformites')
export class NonConformitesController {
  constructor(private readonly service: NonConformitesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les non-conformités — US-064' })
  @ApiQuery({ name: 'statut', required: false, enum: StatutNC })
  @ApiQuery({ name: 'fournisseurId', required: false })
  @ApiQuery({ name: 'articleId', required: false })
  @ApiQuery({ name: 'typeDetection', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(
    @Query('statut') statut?: StatutNC,
    @Query('fournisseurId') fournisseurId?: string,
    @Query('articleId') articleId?: string,
    @Query('typeDetection') typeDetection?: string,
    @Query('page') page?: number,
  ) {
    return this.service.findAll({ statut, fournisseurId, articleId, typeDetection, page });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques NC sur 12 mois' })
  getStats() {
    return this.service.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une non-conformité' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.QUALITE, UserRole.RESP_PROD, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Ouvrir une non-conformité — US-064' })
  create(@Body() dto: CreateNonConformiteDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user.id);
  }

  @Put(':id/analyser')
  @Roles(UserRole.ADMIN, UserRole.QUALITE)
  @ApiOperation({ summary: 'Passer en analyse (OUVERTE → EN_ANALYSE)' })
  analyser(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.analyser(id);
  }

  @Put(':id/decision')
  @Roles(UserRole.ADMIN, UserRole.QUALITE, UserRole.DIRECTEUR)
  @ApiOperation({ summary: 'Prendre une décision + définir action corrective' })
  prendreDecision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrendreDecisionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.prendreDecision(id, dto, user.id);
  }

  @Put(':id/cloturer')
  @Roles(UserRole.ADMIN, UserRole.QUALITE)
  @ApiOperation({ summary: 'Clôturer la NC — efficacité vérifiée requise — US-064' })
  cloturer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloturerNcDto,
  ) {
    return this.service.cloturer(id, dto);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([NonConformite])],
  controllers: [NonConformitesController],
  providers: [NonConformitesService],
  exports: [NonConformitesService],
})
export class NonConformitesModule {}
