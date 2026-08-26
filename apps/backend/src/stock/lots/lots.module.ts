import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import {
  IsString, IsOptional, IsNumber, IsEnum,
  IsDateString, IsUUID, Min, IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Lot } from '../../database/entities/stock.entity';
import { StatutLot } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateLotDto {
  @ApiProperty({ example: 'LOT-2026-001234' })
  @IsOptional() @IsString()
  numero?: string;

  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  emplacementId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  lotFournisseur?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  fournisseurId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  commandeAchatId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateFabrication?: string;

  @ApiProperty({ required: false, description: 'DLUO — immuable après création (RG06)' })
  @IsOptional() @IsDateString()
  dateDluo?: string;

  @ApiProperty()
  @IsNumber() @Min(0.001)
  quantiteInitiale: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  certificatUrl?: string;
}

export class UpdateStatutLotDto {
  @ApiProperty({ enum: StatutLot })
  @IsEnum(StatutLot)
  statut: StatutLot;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class LotsService {
  constructor(
    @InjectRepository(Lot)
    private readonly repo: Repository<Lot>,
  ) {}

  // ── Générer numéro de lot automatique ────────────────────────────────────
  private async genererNumero(): Promise<string> {
    const annee = new Date().getFullYear();
    const count = await this.repo.count({
      where: { numero: undefined },
    });
    const seq = String(count + 1).padStart(6, '0');
    return `LOT-${annee}-${seq}`;
  }

  // ── Créer un lot ─────────────────────────────────────────────────────────
  async create(dto: CreateLotDto): Promise<Lot> {
    const numero = dto.numero || await this.genererNumero();

    // Vérifier unicité
    const exists = await this.repo.findOne({ where: { numero } });
    if (exists) throw new BadRequestException(`Numéro de lot ${numero} déjà utilisé`);

    const lot = this.repo.create({
      ...dto,
      numero,
      dateReception: new Date(),
      statut: StatutLot.DISPONIBLE,
    });

    return this.repo.save(lot) as unknown as Promise<Lot>;
  }

  // ── Lister les lots ───────────────────────────────────────────────────────
  findAll(filters: {
    articleId?: string;
    siteId?: string;
    statut?: StatutLot;
    dluoAvant?: string;
    fournisseurId?: string;
    page?: number;
    limit?: number;
  }) {
    const { articleId, siteId, statut, dluoAvant, fournisseurId, page = 1, limit = 20 } = filters;

    const qb = this.repo.createQueryBuilder('l')
      .leftJoinAndSelect('l.article', 'article')
      .leftJoinAndSelect('l.site', 'site')
      .leftJoinAndSelect('l.fournisseur', 'fournisseur')
      .where('1=1');

    if (articleId) qb.andWhere('l.article_id = :articleId', { articleId });
    if (siteId) qb.andWhere('l.site_id = :siteId', { siteId });
    if (statut) qb.andWhere('l.statut = :statut', { statut });
    if (fournisseurId) qb.andWhere('l.fournisseur_id = :fournisseurId', { fournisseurId });
    if (dluoAvant) qb.andWhere('l.date_dluo <= :dluoAvant', { dluoAvant });

    // Alerte DLUO dans 30 jours
    qb.addSelect(
      `l.date_dluo IS NOT NULL AND l.date_dluo < NOW() + INTERVAL '30 days' AND l.statut = 'DISPONIBLE'`,
      'alerte_dluo',
    );

    return qb
      .orderBy('l.createdAt', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount()
      .then(([data, total]) => ({
        data, total, page, limit,
        pages: Math.ceil(total / limit),
      }));
  }

  // ── Détail d'un lot ────────────────────────────────────────────────────────
  async findOne(id: string) {
    const lot = await this.repo.findOne({
      where: { id },
      relations: ['article', 'site', 'emplacement', 'fournisseur'],
    });
    if (!lot) throw new NotFoundException(`Lot ${id} introuvable`);
    return lot;
  }

  async findByNumero(numero: string) {
    const lot = await this.repo.findOne({
      where: { numero },
      relations: ['article', 'site', 'fournisseur'],
    });
    if (!lot) throw new NotFoundException(`Lot ${numero} introuvable`);
    return lot;
  }

  // ── Mettre à jour le statut ────────────────────────────────────────────────
  async updateStatut(id: string, dto: UpdateStatutLotDto) {
    const lot = await this.findOne(id);

    // Transitions valides
    const transitions: Record<StatutLot, StatutLot[]> = {
      [StatutLot.DISPONIBLE]:  [StatutLot.RESERVE, StatutLot.QUARANTAINE, StatutLot.CONSOMME, StatutLot.PERIME],
      [StatutLot.RESERVE]:     [StatutLot.DISPONIBLE, StatutLot.CONSOMME, StatutLot.QUARANTAINE],
      [StatutLot.QUARANTAINE]: [StatutLot.LIBERE, StatutLot.PERIME],
      [StatutLot.LIBERE]:      [StatutLot.DISPONIBLE, StatutLot.PERIME],
      [StatutLot.CONSOMME]:    [],
      [StatutLot.PERIME]:      [],
    };

    const allowed = transitions[lot.statut] || [];
    if (!allowed.includes(dto.statut)) {
      throw new BadRequestException(
        `Transition ${lot.statut} → ${dto.statut} non autorisée`,
      );
    }

    await this.repo.update(id, { statut: dto.statut });
    return this.findOne(id);
  }

  // ── US-034 : Lots disponibles FIFO ou FEFO ────────────────────────────────
  async lotsDisponibles(articleId: string, siteId: string, mode: 'FIFO' | 'FEFO' = 'FIFO') {
    const qb = this.repo.createQueryBuilder('l')
      .leftJoinAndSelect('l.fournisseur', 'fournisseur')
      .where('l.article_id = :articleId', { articleId })
      .andWhere('l.site_id = :siteId', { siteId })
      .andWhere('l.statut = :statut', { statut: StatutLot.DISPONIBLE })
      .andWhere('(l.date_dluo IS NULL OR l.date_dluo >= NOW())'); // exclut périmés

    // FIFO : par date réception | FEFO : par date DLUO
    if (mode === 'FEFO') {
      qb.orderBy('l.date_dluo', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('l.date_reception', 'ASC');
    }

    const lots = await qb.getMany();

    return lots.map(l => ({
      lotId: l.id,
      lotNumero: l.numero,
      quantiteInitiale: l.quantiteInitiale,
      dateReception: l.dateReception,
      dateDluo: l.dateDluo,
      fournisseur: l.fournisseur?.raisonSociale,
      alerteDluo: l.dateDluo
        ? new Date(l.dateDluo) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : false,
    }));
  }

  // ── Lots avec alerte DLUO ─────────────────────────────────────────────────
  async alertesDluo() {
    const dans30Jours = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return this.repo.find({
      where: {
        statut: StatutLot.DISPONIBLE,
        dateDluo: LessThan(dans30Jours),
      },
      relations: ['article', 'site'],
      order: { dateDluo: 'ASC' },
    });
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('lots')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lots')
export class LotsController {
  constructor(private readonly service: LotsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les lots avec filtres' })
  @ApiQuery({ name: 'articleId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: StatutLot })
  @ApiQuery({ name: 'dluoAvant', required: false })
  @ApiQuery({ name: 'fournisseurId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('articleId') articleId?: string,
    @Query('siteId') siteId?: string,
    @Query('statut') statut?: StatutLot,
    @Query('dluoAvant') dluoAvant?: string,
    @Query('fournisseurId') fournisseurId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({ articleId, siteId, statut, dluoAvant, fournisseurId, page, limit });
  }

  @Get('alertes-dluo')
  @ApiOperation({ summary: 'Lots avec DLUO dans moins de 30 jours' })
  alertesDluo() {
    return this.service.alertesDluo();
  }

  @Get('disponibles')
  @ApiOperation({ summary: 'Lots disponibles FIFO ou FEFO pour consommation — US-034' })
  @ApiQuery({ name: 'articleId', required: true })
  @ApiQuery({ name: 'siteId', required: true })
  @ApiQuery({ name: 'mode', required: false, enum: ['FIFO', 'FEFO'] })
  lotsDisponibles(
    @Query('articleId') articleId: string,
    @Query('siteId') siteId: string,
    @Query('mode') mode: 'FIFO' | 'FEFO' = 'FIFO',
  ) {
    return this.service.lotsDisponibles(articleId, siteId, mode);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un lot par UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get('numero/:numero')
  @ApiOperation({ summary: 'Détail d\'un lot par numéro' })
  findByNumero(@Param('numero') numero: string) {
    return this.service.findByNumero(numero);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GEST_STOCK, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Créer un lot — numéro auto-généré si non fourni' })
  create(@Body() dto: CreateLotDto) {
    return this.service.create(dto);
  }

  @Put(':id/statut')
  @Roles(UserRole.ADMIN, UserRole.GEST_STOCK, UserRole.QUALITE)
  @ApiOperation({ summary: 'Changer le statut d\'un lot (transitions contrôlées)' })
  updateStatut(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatutLotDto,
  ) {
    return this.service.updateStatut(id, dto);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([Lot])],
  controllers: [LotsController],
  providers: [LotsService],
  exports: [LotsService],
})
export class LotsModule {}