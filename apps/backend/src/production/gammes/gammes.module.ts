import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsUUID, IsNumber, IsOptional, IsString,
  IsBoolean, Min, IsArray,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Gamme } from '../../database/entities/production.entity';
import { OperationGamme } from '../../database/entities/production.entity';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateGammeDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty({ example: 'GME-CHASSIS-001' })
  @IsString()
  code: string;

  @ApiProperty({ required: false, default: '1.0' })
  @IsOptional() @IsString()
  version?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  notes?: string;
}

export class CreateOperationDto {
  @ApiProperty({ example: 10, description: 'Numéro opération (10, 20, 30...)' })
  @IsNumber() @Min(1)
  numeroOp: number;

  @ApiProperty({ example: 'Découpe laser' })
  @IsString()
  libelle: string;

  @ApiProperty()
  @IsUUID()
  posteChargeId: string;

  @ApiProperty({ required: false, default: 0, description: 'Temps préparation en minutes' })
  @IsOptional() @IsNumber() @Min(0)
  tempsPreparation?: number;

  @ApiProperty({ required: false, default: 0, description: 'Temps unitaire en minutes/pièce' })
  @IsOptional() @IsNumber() @Min(0)
  tempsUnitaire?: number;

  @ApiProperty({ required: false, default: 0, description: 'Temps nettoyage en minutes' })
  @IsOptional() @IsNumber() @Min(0)
  tempsNettoyage?: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional() @IsNumber() @Min(1)
  nbOperateurs?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional() @IsBoolean()
  pointDeControle?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  documentUrl?: string;

  @ApiProperty({ required: false, type: [Number], description: 'Numéros des opérations prédécesseurs' })
  @IsOptional() @IsArray()
  predecesseurs?: number[];
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class GammesService {
  constructor(
    @InjectRepository(Gamme) private readonly repo: Repository<Gamme>,
    @InjectRepository(OperationGamme) private readonly opRepo: Repository<OperationGamme>,
  ) {}

  async findAll(articleId?: string) {
    const qb = this.repo.createQueryBuilder('g')
      .leftJoinAndSelect('g.article', 'article')
      .leftJoinAndSelect('g.operations', 'operations')
      .where('1=1');

    if (articleId) qb.andWhere('g.article_id = :articleId', { articleId });
    return qb.orderBy('g.article_id', 'ASC').addOrderBy('g.version', 'DESC').getMany();
  }

  async findOne(id: string) {
    const g = await this.repo.findOne({
      where: { id },
      relations: ['article', 'operations', 'operations.posteCharge'],
    });
    if (!g) throw new NotFoundException(`Gamme ${id} introuvable`);
    return g;
  }

  async findActive(articleId: string) {
    return this.repo.findOne({
      where: { articleId, statut: 'ACTIF' },
      relations: ['operations', 'operations.posteCharge'],
    });
  }

  async create(dto: CreateGammeDto) {
    // Vérifier unicité article+version
    const exists = await this.repo.findOne({
      where: { articleId: dto.articleId, version: dto.version || '1.0' },
    });
    if (exists) throw new ConflictException(`Gamme version ${dto.version || '1.0'} existe déjà pour cet article`);

    // Désactiver l'ancienne gamme active si elle existe
    await this.repo.update(
      { articleId: dto.articleId, statut: 'ACTIF' },
      { statut: 'REVISE' },
    );

    const gamme = this.repo.create({
      ...dto,
      version: dto.version || '1.0',
      statut: 'ACTIF',
    });
    return this.repo.save(gamme) as unknown as Promise<Gamme>;
  }

  async update(id: string, dto: Partial<CreateGammeDto>) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async obsolete(id: string) {
    await this.repo.update(id, { statut: 'OBSOLETE' });
  }

  // ── Opérations ─────────────────────────────────────────────────────────────
  async addOperation(gammeId: string, dto: CreateOperationDto) {
    const gamme = await this.findOne(gammeId);

    // Vérifier unicité numéro opération
    const exists = await this.opRepo.findOne({
      where: { gammeId, numeroOp: dto.numeroOp },
    });
    if (exists) throw new ConflictException(`Opération ${dto.numeroOp} existe déjà dans cette gamme`);

    const op = this.opRepo.create({ ...dto, gammeId });
    return this.opRepo.save(op) as unknown as Promise<OperationGamme>;
  }

  async updateOperation(id: string, dto: Partial<CreateOperationDto>) {
    await this.opRepo.update(id, dto);
    return this.opRepo.findOne({ where: { id }, relations: ['posteCharge'] });
  }

  async deleteOperation(id: string) {
    await this.opRepo.delete(id);
  }

  // Calcul temps total de la gamme pour une quantité
  async calculerTemps(gammeId: string, quantite: number) {
    const gamme = await this.findOne(gammeId);
    const temps = gamme.operations.map(op => ({
      numeroOp: op.numeroOp,
      libelle: op.libelle,
      poste: op.posteCharge?.libelle,
      tempsPreparation: op.tempsPreparation,
      tempsProduction: op.tempsUnitaire * quantite,
      tempsNettoyage: op.tempsNettoyage,
      tempsTotal: op.tempsPreparation + (op.tempsUnitaire * quantite) + op.tempsNettoyage,
    }));

    const totalMinutes = temps.reduce((acc, t) => acc + t.tempsTotal, 0);
    return {
      gammeId,
      quantite,
      operations: temps,
      totalMinutes,
      totalHeures: Math.round(totalMinutes / 60 * 100) / 100,
    };
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('production')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('gammes')
export class GammesController {
  constructor(private readonly service: GammesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les gammes' })
  @ApiQuery({ name: 'articleId', required: false })
  findAll(@Query('articleId') articleId?: string) {
    return this.service.findAll(articleId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une gamme avec opérations' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/temps')
  @ApiOperation({ summary: 'Calcul temps total de la gamme pour une quantité' })
  @ApiQuery({ name: 'quantite', required: true, type: Number })
  calculerTemps(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('quantite') quantite: number,
  ) {
    return this.service.calculerTemps(id, Number(quantite));
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Créer une gamme — désactive automatiquement l\'ancienne version' })
  create(@Body() dto: CreateGammeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Modifier une gamme' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateGammeDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/obsolete')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mettre une gamme en OBSOLETE' })
  obsolete(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.obsolete(id);
  }

  @Post(':id/operations')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Ajouter une opération à la gamme — US-052' })
  addOperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateOperationDto,
  ) {
    return this.service.addOperation(id, dto);
  }

  @Put('operations/:opId')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Modifier une opération' })
  updateOperation(
    @Param('opId', ParseUUIDPipe) opId: string,
    @Body() dto: CreateOperationDto,
  ) {
    return this.service.updateOperation(opId, dto);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Put('operations/:opId/supprimer')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Supprimer une opération' })
  deleteOperation(@Param('opId', ParseUUIDPipe) opId: string) {
    return this.service.deleteOperation(opId);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([Gamme, OperationGamme])],
  controllers: [GammesController],
  providers: [GammesService],
  exports: [GammesService],
})
export class GammesModule {}
