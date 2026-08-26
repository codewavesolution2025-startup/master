import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsUUID, IsNumber, IsOptional, IsString, IsDateString, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DemandeAchat } from '../../database/entities/achat.entity';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateDemandeAchatDto {
  @ApiProperty()
  @IsString()
  articleId: string;

  @ApiProperty()
  @IsString()
  siteId: string;

  @ApiProperty()
  @IsNumber() @Min(0.001)
  quantite: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateSouhaitee?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  justification?: string;

  @ApiProperty({ required: false, enum: ['ALERTE_STOCK', 'MRP', 'MANUELLE'], default: 'MANUELLE' })
  @IsOptional() @IsString()
  origine?: string;
}

export class RefuserDemandeDto {
  @ApiProperty({ description: 'Commentaire obligatoire en cas de refus' })
  @IsString()
  commentaire: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class DemandesAchatService {
  constructor(
    @InjectRepository(DemandeAchat)
    private readonly repo: Repository<DemandeAchat>,
  ) {}

  // Générer référence DA-YYYY-XXXXX
  private async genererReference(): Promise<string> {
    const annee = new Date().getFullYear();
    const count = await this.repo.count();
    const seq = String(count + 1).padStart(5, '0');
    return `DA-${annee}-${seq}`;
  }

  async findAll(filters: { statut?: string; articleId?: string; siteId?: string }) {
    const qb = this.repo.createQueryBuilder('da')
      .leftJoinAndSelect('da.article', 'article')
      .leftJoinAndSelect('da.site', 'site')
      .where('1=1');

    if (filters.statut) qb.andWhere('da.statut = :statut', { statut: filters.statut });
    if (filters.articleId) qb.andWhere('da.article_id = :articleId', { articleId: filters.articleId });
    if (filters.siteId) qb.andWhere('da.site_id = :siteId', { siteId: filters.siteId });

    return qb.orderBy('da.created_at', 'DESC').getMany();
  }

  async findOne(id: string) {
    const da = await this.repo.findOne({
      where: { id },
      relations: ['article', 'site'],
    });
    if (!da) throw new NotFoundException(`Demande d'achat ${id} introuvable`);
    return da;
  }

  async create(dto: CreateDemandeAchatDto, userId: string) {
    const reference = await this.genererReference();
    const da = this.repo.create({
      ...dto,
      reference,
      statut: 'EN_ATTENTE',
      origine: dto.origine || 'MANUELLE',
      createdBy: userId,
    });
    return this.repo.save(da) as unknown as Promise<DemandeAchat>;
  }

  async valider(id: string, userId: string) {
    const da = await this.findOne(id);
    if (da.statut !== 'EN_ATTENTE') {
      throw new BadRequestException(`Demande en statut ${da.statut} — non validable`);
    }
    await this.repo.update(id, {
      statut: 'VALIDEE',
      validePar: userId,
      dateValidation: new Date(),
    });
    return this.findOne(id);
  }

  async refuser(id: string, dto: RefuserDemandeDto, userId: string) {
    const da = await this.findOne(id);
    if (da.statut !== 'EN_ATTENTE') {
      throw new BadRequestException(`Demande en statut ${da.statut} — non refusable`);
    }
    await this.repo.update(id, {
      statut: 'REFUSEE',
      validePar: userId,
      dateValidation: new Date(),
      commentaireValid: dto.commentaire,
    });
    return this.findOne(id);
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('achats')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('demandes-achat')
export class DemandesAchatController {
  constructor(private readonly service: DemandesAchatService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les demandes d\'achat' })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'articleId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  findAll(
    @Query('statut') statut?: string,
    @Query('articleId') articleId?: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.service.findAll({ statut, articleId, siteId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une demande d\'achat' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GEST_STOCK, UserRole.RESP_ACHATS, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Créer une demande d\'achat' })
  create(@Body() dto: CreateDemandeAchatDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user.id);
  }

  @Put(':id/valider')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Valider une demande d\'achat' })
  valider(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.service.valider(id, user.id);
  }

  @Put(':id/refuser')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Refuser une demande d\'achat — commentaire obligatoire' })
  refuser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefuserDemandeDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.refuser(id, dto, user.id);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([DemandeAchat])],
  controllers: [DemandesAchatController],
  providers: [DemandesAchatService],
  exports: [DemandesAchatService],
})
export class DemandesAchatModule {}
