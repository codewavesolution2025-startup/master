import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import {
  IsString, IsOptional, IsEnum, IsNumber, IsBoolean,
  IsPositive, Min, ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Article } from '../../database/entities/article.entity';
import { FamilleArticle } from '../../database/entities/article.entity';
import { ArticleType, NiveauControle } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateFamilleArticleDto {
  @ApiProperty({ example: 'MAT-BRU' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Matières brutes' })
  @IsString()
  nom: string;

  @ApiProperty({ enum: ArticleType })
  @IsEnum(ArticleType)
  type: ArticleType;
}

export class CreateArticleDto {
  @ApiProperty({ example: 'MP-ACIER-001' })
  @IsString()
  reference: string;

  @ApiProperty({ example: 'Acier inoxydable 304' })
  @IsString()
  designation: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  designationLongue?: string;

  @ApiProperty({ enum: ArticleType })
  @IsEnum(ArticleType)
  type: ArticleType;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  familleId?: string;

  @ApiProperty({ example: 'kg' })
  @IsString()
  uniteMesure: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  stockMini?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(0)
  stockMaxi?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  stockSecurite?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  delaiReapproJours?: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional() @IsNumber() @Min(0)
  lotMinCommande?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  prixAchatStd?: number;

  @ApiProperty({ required: false, default: false })
  @IsOptional() @IsBoolean()
  gestionParLot?: boolean;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(1)
  dureeVieJours?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(0)
  poidsUnitaireKg?: number;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional() @IsNumber()
  toleranceReception?: number;

  @ApiProperty({ enum: NiveauControle, required: false })
  @IsOptional() @IsEnum(NiveauControle)
  niveauControle?: NiveauControle;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  fournisseurPrincId?: string;
}

export class UpdateArticleDto extends CreateArticleDto {}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article) private readonly repo: Repository<Article>,
    @InjectRepository(FamilleArticle) private readonly familleRepo: Repository<FamilleArticle>,
  ) {}

  // ── Familles ────────────────────────────────────────────────────────────────
  findAllFamilles() {
    return this.familleRepo.find({ order: { code: 'ASC' } });
  }

  async createFamille(dto: CreateFamilleArticleDto) {
    const exists = await this.familleRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Famille ${dto.code} existe déjà`);
    return this.familleRepo.save(this.familleRepo.create(dto));
  }

  // ── Articles ────────────────────────────────────────────────────────────────
  async findAll(filters: {
    type?: ArticleType;
    familleId?: string;
    actif?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { type, familleId, actif, search, page = 1, limit = 20 } = filters;
    const where: FindOptionsWhere<Article> = {};

    if (type) where.type = type;
    if (familleId) where.familleId = familleId;
    if (actif !== undefined) where.actif = actif;

    const qb = this.repo.createQueryBuilder('a')
      .leftJoinAndSelect('a.famille', 'famille')
      .where('1=1');

    if (type) qb.andWhere('a.type = :type', { type });
    if (familleId) qb.andWhere('a.famille_id = :familleId', { familleId });
    if (actif !== undefined) qb.andWhere('a.actif = :actif', { actif });
    if (search) {
      qb.andWhere(
        '(a.reference ILIKE :s OR a.designation ILIKE :s)',
        { s: `%${search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('a.reference', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const article = await this.repo.findOne({
      where: { id },
      relations: ['famille'],
    });
    if (!article) throw new NotFoundException(`Article ${id} introuvable`);
    return article;
  }

  async findByRef(reference: string) {
    const article = await this.repo.findOne({ where: { reference } });
    if (!article) throw new NotFoundException(`Article ${reference} introuvable`);
    return article;
  }

  async create(dto: CreateArticleDto, userId: string) {
    // RG01 : Référence unique
    const exists = await this.repo.findOne({ where: { reference: dto.reference } });
    if (exists) throw new ConflictException(`Référence ${dto.reference} déjà utilisée`);

    // stock_mini obligatoire pour MP
    if (dto.type === ArticleType.MP && (dto.stockMini === undefined || dto.stockMini < 0)) {
      throw new BadRequestException('stock_mini obligatoire pour les articles de type MP');
    }

    const article = this.repo.create({ ...dto, createdBy: userId });
    return this.repo.save(article) as unknown as Promise<Article>;
  }

  async update(id: string, dto: Partial<UpdateArticleDto>) {
    const article = await this.findOne(id);

    // Vérifier unicité si la référence change
    if (dto.reference && dto.reference !== article.reference) {
      const exists = await this.repo.findOne({ where: { reference: dto.reference } });
      if (exists) throw new ConflictException(`Référence ${dto.reference} déjà utilisée`);
    }

    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async desactiver(id: string) {
    await this.findOne(id);
    await this.repo.update(id, { actif: false, obsolete: true });
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('articles')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('articles')
export class ArticlesController {
  constructor(private readonly service: ArticlesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les articles avec filtres et pagination' })
  @ApiQuery({ name: 'type', required: false, enum: ArticleType })
  @ApiQuery({ name: 'familleId', required: false })
  @ApiQuery({ name: 'actif', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('type') type?: ArticleType,
    @Query('familleId') familleId?: string,
    @Query('actif') actif?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll({
      type, familleId, search, page, limit,
      actif: actif !== undefined ? actif === 'true' : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un article par UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Créer un article' })
  create(@Body() dto: CreateArticleDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user.id);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Modifier un article' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateArticleDto,
  ) {
    return this.service.update(id, dto);
  }

  @Put(':id/desactiver')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Désactiver un article (soft delete)' })
  desactiver(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.desactiver(id);
  }
}

// ── Controller Familles ───────────────────────────────────────────────────────
@ApiTags('articles')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('familles-articles')
export class FamillesController {
  constructor(private readonly service: ArticlesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste toutes les familles d\'articles' })
  findAll() {
    return this.service.findAllFamilles();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Créer une famille d\'articles' })
  create(@Body() dto: CreateFamilleArticleDto) {
    return this.service.createFamille(dto);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([Article, FamilleArticle])],
  controllers: [ArticlesController, FamillesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
