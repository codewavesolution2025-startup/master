import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsUUID, IsNumber, IsOptional, IsString,
  IsEnum, Min, IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PlanControle } from '../../database/entities/qualite.entity';
import { CritereControle } from '../../database/entities/qualite.entity';
import { ControleReception } from '../../database/entities/qualite.entity';
import { MesureControle } from '../../database/entities/qualite.entity';
import { Lot } from '../../database/entities/stock.entity';
import { MouvementStock } from '../../database/entities/stock.entity';
import { NiveauControle, StatutLot, MouvementType } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreatePlanControleDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty({ required: false, description: 'null = s\'applique à tous les fournisseurs' })
  @IsOptional() @IsUUID()
  fournisseurId?: string;

  @ApiProperty({ enum: NiveauControle, default: NiveauControle.NORMAL })
  @IsOptional() @IsEnum(NiveauControle)
  niveau?: NiveauControle;

  @ApiProperty({ required: false, default: 100, description: 'Fréquence en %' })
  @IsOptional() @IsNumber() @Min(0)
  frequencePct?: number;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional() @IsNumber() @Min(1)
  tailleEchantillon?: number;
}

export class CreateCritereDto {
  @ApiProperty({ example: 'Diamètre extérieur' })
  @IsString()
  libelle: string;

  @ApiProperty({ enum: ['VISUEL', 'DIMENSIONNEL', 'MASSE', 'CHIMIQUE'], required: false })
  @IsOptional() @IsString()
  typeMesure?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  valeurNominale?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  tolerancePlus?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  toleranceMoins?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  unite?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  methode?: string;
}

export class CreateControleReceptionDto {
  @ApiProperty()
  @IsUUID()
  receptionId: string;

  @ApiProperty()
  @IsUUID()
  lotId: string;

  @ApiProperty()
  @IsUUID()
  planId: string;
}

export class CreateMesureDto {
  @ApiProperty()
  @IsUUID()
  critereId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  valeurMesuree?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class PlansControleService {
  constructor(
    @InjectRepository(PlanControle) private readonly planRepo: Repository<PlanControle>,
    @InjectRepository(CritereControle) private readonly critereRepo: Repository<CritereControle>,
    @InjectRepository(ControleReception) private readonly controleRepo: Repository<ControleReception>,
    @InjectRepository(MesureControle) private readonly mesureRepo: Repository<MesureControle>,
    @InjectRepository(Lot) private readonly lotRepo: Repository<Lot>,
    @InjectRepository(MouvementStock) private readonly mouvRepo: Repository<MouvementStock>,
  ) {}

  // ── Plans de contrôle ──────────────────────────────────────────────────────
  findAllPlans(articleId?: string) {
    const qb = this.planRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.article', 'article')
      .leftJoinAndSelect('p.fournisseur', 'fournisseur')
      .leftJoinAndSelect('p.criteres', 'criteres')
      .where('p.actif = true');
    if (articleId) qb.andWhere('p.article_id = :articleId', { articleId });
    return qb.getMany();
  }

  async createPlan(dto: CreatePlanControleDto) {
    const plan = this.planRepo.create({ ...dto, actif: true });
    return this.planRepo.save(plan) as unknown as Promise<PlanControle>;
  }

  async addCritere(planId: string, dto: CreateCritereDto) {
    const plan = await this.planRepo.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Plan ${planId} introuvable`);
    const critere = this.critereRepo.create({ ...dto, planId });
    return this.critereRepo.save(critere) as unknown as Promise<CritereControle>;
  }

  // ── Contrôles réception ────────────────────────────────────────────────────
  async createControle(dto: CreateControleReceptionDto, userId: string) {
    const controle = this.controleRepo.create({
      ...dto,
      controleurId: userId,
      resultat: 'ENCOURS',
    });
    return this.controleRepo.save(controle) as unknown as Promise<ControleReception>;
  }

  async findControles(receptionId?: string) {
    const qb = this.controleRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.lot', 'lot')
      .leftJoinAndSelect('c.plan', 'plan')
      .leftJoinAndSelect('c.mesures', 'mesures')
      .where('1=1');
    if (receptionId) qb.andWhere('c.reception_id = :receptionId', { receptionId });
    return qb.orderBy('c.date_controle', 'DESC').getMany();
  }

  // ── US-063 : Ajouter une mesure + calculer conformité ─────────────────────
  async addMesure(controleId: string, dto: CreateMesureDto, userId: string) {
    const critere = await this.critereRepo.findOne({ where: { id: dto.critereId } });
    if (!critere) throw new NotFoundException(`Critère ${dto.critereId} introuvable`);

    // Calculer conformité automatiquement
    let conforme: boolean | undefined;
    if (dto.valeurMesuree !== undefined && critere.valeurNominale !== null) {
      const min = (critere.valeurNominale || 0) - (critere.toleranceMoins || 0);
      const max = (critere.valeurNominale || 0) + (critere.tolerancePlus || 0);
      conforme = dto.valeurMesuree >= min && dto.valeurMesuree <= max;
    }

    const mesure = this.mesureRepo.create({
      controleId,
      critereId: dto.critereId,
      valeurMesuree: dto.valeurMesuree,
      conforme,
    });
    await this.mesureRepo.save(mesure);

    // Si non conforme → mettre le contrôle en NOK
    if (conforme === false) {
      await this.controleRepo.update(controleId, { resultat: 'NOK' });
    }

    return mesure;
  }

  // ── Finaliser contrôle : OK → DISPONIBLE / NOK → QUARANTAINE ──────────────
  async finaliserControle(controleId: string, resultat: 'OK' | 'NOK', userId: string) {
    const controle = await this.controleRepo.findOne({
      where: { id: controleId },
      relations: ['lot'],
    });
    if (!controle) throw new NotFoundException(`Contrôle ${controleId} introuvable`);

    await this.controleRepo.update(controleId, { resultat });

    if (resultat === 'OK') {
      // RG03 : Libérer le lot
      await this.lotRepo.update(controle.lotId, { statut: StatutLot.DISPONIBLE });
      await this.mouvRepo.save(this.mouvRepo.create({
        articleId: controle.lot.articleId,
        lotId: controle.lotId,
        siteId: controle.lot.siteId,
        typeMouvement: MouvementType.LIBERATION_QUARANTAINE,
        quantite: controle.lot.quantiteInitiale,
        sens: 1,
        origineType: 'CONTROLE',
        origineId: controleId,
        createdBy: userId,
      }));
    } else {
      // RG03 : Mettre en quarantaine
      await this.lotRepo.update(controle.lotId, { statut: StatutLot.QUARANTAINE });
      await this.mouvRepo.save(this.mouvRepo.create({
        articleId: controle.lot.articleId,
        lotId: controle.lotId,
        siteId: controle.lot.siteId,
        typeMouvement: MouvementType.MISE_QUARANTAINE,
        quantite: controle.lot.quantiteInitiale,
        sens: -1,
        origineType: 'CONTROLE',
        origineId: controleId,
        createdBy: userId,
      }));
    }

    return this.controleRepo.findOne({
      where: { id: controleId },
      relations: ['lot', 'mesures'],
    });
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────
@ApiTags('qualite')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('plans-controle')
export class PlansControleController {
  constructor(private readonly service: PlansControleService) {}

  @Get()
  @ApiOperation({ summary: 'Plans de contrôle — US-060' })
  @ApiQuery({ name: 'articleId', required: false })
  findAll(@Query('articleId') articleId?: string) {
    return this.service.findAllPlans(articleId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.QUALITE)
  @ApiOperation({ summary: 'Créer un plan de contrôle — US-060' })
  createPlan(@Body() dto: CreatePlanControleDto) {
    return this.service.createPlan(dto);
  }

  @Post(':id/criteres')
  @Roles(UserRole.ADMIN, UserRole.QUALITE)
  @ApiOperation({ summary: 'Ajouter un critère de contrôle — US-061' })
  addCritere(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCritereDto,
  ) {
    return this.service.addCritere(id, dto);
  }
}

@ApiTags('qualite')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('controles-reception')
export class ControlesReceptionController {
  constructor(private readonly service: PlansControleService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les contrôles réception — US-062' })
  @ApiQuery({ name: 'receptionId', required: false })
  findAll(@Query('receptionId') receptionId?: string) {
    return this.service.findControles(receptionId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.QUALITE)
  @ApiOperation({ summary: 'Créer un contrôle réception — US-062' })
  create(@Body() dto: CreateControleReceptionDto, @CurrentUser() user: JwtUser) {
    return this.service.createControle(dto, user.id);
  }

  @Post(':id/mesures')
  @Roles(UserRole.ADMIN, UserRole.QUALITE)
  @ApiOperation({ summary: 'Saisir une mesure — conformité auto calculée — US-063' })
  addMesure(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMesureDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.addMesure(id, dto, user.id);
  }

  @Put(':id/finaliser')
  @Roles(UserRole.ADMIN, UserRole.QUALITE)
  @ApiOperation({ summary: 'Finaliser contrôle OK/NOK → lot DISPONIBLE ou QUARANTAINE — RG03' })
  finaliser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('resultat') resultat: 'OK' | 'NOK',
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.finaliserControle(id, resultat, user.id);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([
    PlanControle, CritereControle, ControleReception, MesureControle, Lot, MouvementStock,
  ])],
  controllers: [PlansControleController, ControlesReceptionController],
  providers: [PlansControleService],
  exports: [PlansControleService],
})
export class QualiteModule {}
