import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Site, Emplacement } from '../../database/entities/site.entity';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateSiteDto {
  @ApiProperty({ example: 'USINE-A' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Usine principale Paris' })
  @IsString()
  nom: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  adresse?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  ville?: string;

  @ApiProperty({ required: false, default: 'France' })
  @IsOptional() @IsString()
  pays?: string;
}

export class CreateEmplacementDto {
  @ApiProperty({ example: 'A-R03-N2' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'MP', enum: ['RECEPTION','MP','PF','QUARANTAINE'] })
  @IsOptional() @IsString()
  zone?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber()
  capacite?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site) private readonly siteRepo: Repository<Site>,
    @InjectRepository(Emplacement) private readonly empRepo: Repository<Emplacement>,
  ) {}

  findAllSites(actif?: boolean) {
    const where: any = {};
    if (actif !== undefined) where.actif = actif;
    return this.siteRepo.find({ where, order: { code: 'ASC' } });
  }

  async findOneSite(id: string) {
    const site = await this.siteRepo.findOne({
      where: { id },
      relations: ['emplacements'],
    });
    if (!site) throw new NotFoundException(`Site ${id} introuvable`);
    return site;
  }

  async createSite(dto: CreateSiteDto) {
    const site = this.siteRepo.create(dto);
    return this.siteRepo.save(site);
  }

  async updateSite(id: string, dto: Partial<CreateSiteDto>) {
    await this.siteRepo.update(id, dto);
    return this.findOneSite(id);
  }

  findEmplacements(siteId: string, zone?: string) {
    const where: any = { siteId };
    if (zone) where.zone = zone;
    return this.empRepo.find({ where, order: { code: 'ASC' } });
  }

  async createEmplacement(siteId: string, dto: CreateEmplacementDto) {
    const site = await this.siteRepo.findOne({ where: { id: siteId } });
    if (!site) throw new NotFoundException(`Site ${siteId} introuvable`);
    const emp = this.empRepo.create({ ...dto, siteId });
    return this.empRepo.save(emp);
  }

  async updateEmplacement(id: string, dto: Partial<CreateEmplacementDto>) {
    await this.empRepo.update(id, dto);
    return this.empRepo.findOne({ where: { id } });
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('sites')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sites')
export class SitesController {
  constructor(private readonly service: SitesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste tous les sites' })
  @ApiQuery({ name: 'actif', required: false, type: Boolean })
  findAll(@Query('actif') actif?: string) {
    return this.service.findAllSites(
      actif !== undefined ? actif === 'true' : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un site avec ses emplacements' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneSite(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR)
  @ApiOperation({ summary: 'Créer un site' })
  create(@Body() dto: CreateSiteDto) {
    return this.service.createSite(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR)
  @ApiOperation({ summary: 'Modifier un site' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateSiteDto) {
    return this.service.updateSite(id, dto);
  }

  @Get(':id/emplacements')
  @ApiOperation({ summary: 'Liste les emplacements d\'un site' })
  @ApiQuery({ name: 'zone', required: false })
  findEmplacements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('zone') zone?: string,
  ) {
    return this.service.findEmplacements(id, zone);
  }

  @Post(':id/emplacements')
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR)
  @ApiOperation({ summary: 'Créer un emplacement dans un site' })
  createEmplacement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmplacementDto,
  ) {
    return this.service.createEmplacement(id, dto);
  }

  @Put(':siteId/emplacements/:empId')
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR)
  @ApiOperation({ summary: 'Modifier un emplacement' })
  updateEmplacement(
    @Param('empId', ParseUUIDPipe) empId: string,
    @Body() dto: CreateEmplacementDto,
  ) {
    return this.service.updateEmplacement(empId, dto);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([Site, Emplacement])],
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
