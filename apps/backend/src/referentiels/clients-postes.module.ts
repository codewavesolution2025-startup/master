import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsString, IsOptional, IsNumber, IsBoolean, IsEmail, Min, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Client } from '../database/entities/fournisseur.entity';
import { PosteCharge } from '../database/entities/production.entity';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles } from '../auth/decorators/auth.decorators';
import { UserRole } from '../database/entities/enums';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CLIENTS
// ─────────────────────────────────────────────────────────────────────────────

export class CreateClientDto {
  @ApiProperty({ example: 'CLI-001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Renault SAS' })
  @IsString()
  raisonSociale: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  siret?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  adresse?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  ville?: string;

  @ApiProperty({ required: false, default: 'France' })
  @IsOptional() @IsString()
  pays?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  telephone?: string;

  @ApiProperty({ required: false, default: 30 })
  @IsOptional() @IsNumber() @Min(0)
  delaiPaiement?: number;
}

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private readonly repo: Repository<Client>,
  ) {}

  findAll(actif?: boolean, search?: string) {
    const qb = this.repo.createQueryBuilder('c').where('1=1');
    if (actif !== undefined) qb.andWhere('c.actif = :actif', { actif });
    if (search) qb.andWhere(
      '(c.code ILIKE :s OR c.raison_sociale ILIKE :s)',
      { s: `%${search}%` },
    );
    return qb.orderBy('c.raison_sociale', 'ASC').getMany();
  }

  async findOne(id: string) {
    const client = await this.repo.findOne({ where: { id } });
    if (!client) throw new NotFoundException(`Client ${id} introuvable`);
    return client;
  }

  async create(dto: CreateClientDto) {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Code client ${dto.code} déjà utilisé`);
    return this.repo.save(this.repo.create(dto)) as unknown as Promise<Client>;
  }

  async update(id: string, dto: Partial<CreateClientDto>) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async desactiver(id: string) {
    await this.findOne(id);
    await this.repo.update(id, { actif: false });
  }
}

@ApiTags('clients')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les clients' })
  @ApiQuery({ name: 'actif', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('actif') actif?: string, @Query('search') search?: string) {
    return this.service.findAll(
      actif !== undefined ? actif === 'true' : undefined,
      search,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un client' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Créer un client' })
  create(@Body() dto: CreateClientDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Modifier un client' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateClientDto) {
    return this.service.update(id, dto);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Client])],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE POSTES DE CHARGE
// ─────────────────────────────────────────────────────────────────────────────

export class CreatePosteChargeDto {
  @ApiProperty({ example: 'TOUR-001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Tour CNC n°1' })
  @IsString()
  libelle: string;

  @ApiProperty({ enum: ['MACHINE','MOD','SOUS_TRAITANCE'], required: false })
  @IsOptional() @IsString()
  type?: string;

  @ApiProperty()
  @IsString()
  siteId: string;

  @ApiProperty({ required: false, default: 8 })
  @IsOptional() @IsNumber() @Min(0)
  capaciteHJour?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  coutHoraire?: number;

  @ApiProperty({ required: false, default: 85 })
  @IsOptional() @IsNumber() @Min(0)
  tauxRendement?: number;
}

@Injectable()
export class PostesChargeService {
  constructor(
    @InjectRepository(PosteCharge) private readonly repo: Repository<PosteCharge>,
  ) {}

  findAll(siteId?: string, actif?: boolean) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.site', 'site')
      .where('1=1');
    if (siteId) qb.andWhere('p.site_id = :siteId', { siteId });
    if (actif !== undefined) qb.andWhere('p.actif = :actif', { actif });
    return qb.orderBy('p.code', 'ASC').getMany();
  }

  async findOne(id: string) {
    const p = await this.repo.findOne({ where: { id }, relations: ['site'] });
    if (!p) throw new NotFoundException(`Poste de charge ${id} introuvable`);
    return p;
  }

  async create(dto: CreatePosteChargeDto) {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Code poste ${dto.code} déjà utilisé`);
    return this.repo.save(this.repo.create(dto)) as unknown as Promise<PosteCharge>;
  }

  async update(id: string, dto: Partial<CreatePosteChargeDto>) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async desactiver(id: string) {
    await this.findOne(id);
    await this.repo.update(id, { actif: false });
  }
}

@ApiTags('postes-charge')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('postes-charge')
export class PostesChargeController {
  constructor(private readonly service: PostesChargeService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les postes de charge' })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'actif', required: false, type: Boolean })
  findAll(@Query('siteId') siteId?: string, @Query('actif') actif?: string) {
    return this.service.findAll(
      siteId,
      actif !== undefined ? actif === 'true' : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un poste de charge' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Créer un poste de charge' })
  create(@Body() dto: CreatePosteChargeDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Modifier un poste de charge' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePosteChargeDto) {
    return this.service.update(id, dto);
  }

  @Put(':id/desactiver')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Désactiver un poste de charge' })
  desactiver(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.desactiver(id);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([PosteCharge])],
  controllers: [PostesChargeController],
  providers: [PostesChargeService],
  exports: [PostesChargeService],
})
export class PostesChargeModule {}
