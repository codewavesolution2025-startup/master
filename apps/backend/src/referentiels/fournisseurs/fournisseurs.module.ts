import {
  Controller, Get, Post, Put, Delete, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsString, IsOptional, IsNumber, IsBoolean,
  IsEmail, Length, Min, IsEnum,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Fournisseur } from '../../database/entities/fournisseur.entity';
import { FournisseurContact } from '../../database/entities/fournisseur.entity';
import { CatalogueFournisseur } from '../../database/entities/fournisseur.entity';
import { PalierPrix } from '../../database/entities/fournisseur.entity';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateFournisseurDto {
  @ApiProperty({ example: 'FOUR-001' })
  @IsString()
  code: string;

  @ApiProperty({ example: 'Aciers du Nord SAS' })
  @IsString()
  raisonSociale: string;

  @ApiProperty({ required: false, example: '12345678901234' })
  @IsOptional() @IsString() @Length(14, 14, { message: 'SIRET doit faire 14 chiffres' })
  siret?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  adresseFact?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  villeFact?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  cpFact?: string;

  @ApiProperty({ required: false, default: 'France' })
  @IsOptional() @IsString()
  paysFact?: string;

  @ApiProperty({ required: false, default: 30 })
  @IsOptional() @IsNumber() @Min(0)
  delaiPaiement?: number;

  @ApiProperty({ required: false, default: 'VIREMENT' })
  @IsOptional() @IsString()
  modePaiement?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  certifications?: object[];

  @ApiProperty({ required: false, default: 'ACTIF', enum: ['ACTIF','EVALUATION','BLOQUE','OBSOLETE'] })
  @IsOptional() @IsString()
  statut?: string;
}

export class CreateContactDto {
  @ApiProperty({ enum: ['COMMERCIAL','LOGISTIQUE','QUALITE','COMPTABLE'] })
  @IsString()
  role: string;

  @ApiProperty()
  @IsString()
  nom: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  prenom?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  telephone?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional() @IsBoolean()
  principal?: boolean;
}

export class CreateCatalogueDto {
  @ApiProperty()
  @IsString()
  articleId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  refFournisseur?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(0)
  delaiLivraison?: number;

  @ApiProperty()
  @IsNumber() @Min(0)
  prixUnitaire: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional() @IsNumber() @Min(0)
  lotMin?: number;
}

export class CreatePalierDto {
  @ApiProperty()
  @IsNumber() @Min(0)
  quantiteMin: number;

  @ApiProperty()
  @IsNumber() @Min(0)
  prixUnitaire: number;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class FournisseursService {
  constructor(
    @InjectRepository(Fournisseur) private readonly repo: Repository<Fournisseur>,
    @InjectRepository(FournisseurContact) private readonly contactRepo: Repository<FournisseurContact>,
    @InjectRepository(CatalogueFournisseur) private readonly catalogueRepo: Repository<CatalogueFournisseur>,
    @InjectRepository(PalierPrix) private readonly palierRepo: Repository<PalierPrix>,
  ) {}

  async findAll(statut?: string, search?: string) {
    const qb = this.repo.createQueryBuilder('f').where('1=1');
    if (statut) qb.andWhere('f.statut = :statut', { statut });
    if (search) qb.andWhere('(f.code ILIKE :s OR f.raison_sociale ILIKE :s)', { s: `%${search}%` });
    return qb.orderBy('f.raison_sociale', 'ASC').getMany();
  }

  async findOne(id: string) {
    const f = await this.repo.findOne({ where: { id }, relations: ['contacts'] });
    if (!f) throw new NotFoundException(`Fournisseur ${id} introuvable`);
    return f;
  }

  async create(dto: CreateFournisseurDto) {
    const exists = await this.repo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Code fournisseur ${dto.code} déjà utilisé`);
    // RG09 : score_qualite = 100 à la création, non modifiable manuellement
    const fournisseur = this.repo.create({ ...dto, scoreQualite: 100 });
    return this.repo.save(fournisseur) as unknown as Promise<Fournisseur>;
  }

  async update(id: string, dto: Partial<CreateFournisseurDto>) {
    // RG09 : on retire score_qualite du DTO pour éviter modification manuelle
    const { ...safeDto } = dto as any;
    delete safeDto.scoreQualite;
    await this.repo.update(id, safeDto);
    return this.findOne(id);
  }

  // ── Contacts ───────────────────────────────────────────────────────────────
  findContacts(fournisseurId: string) {
    return this.contactRepo.find({ where: { fournisseurId }, order: { principal: 'DESC' } });
  }

  async createContact(fournisseurId: string, dto: CreateContactDto) {
    await this.findOne(fournisseurId);
    if (dto.principal) {
      await this.contactRepo.update({ fournisseurId }, { principal: false });
    }
    const contact = this.contactRepo.create({ ...dto, fournisseurId });
    return this.contactRepo.save(contact) as unknown as Promise<FournisseurContact>;
  }

  async deleteContact(id: string) {
    await this.contactRepo.delete(id);
  }

  // ── Catalogue ──────────────────────────────────────────────────────────────
  findCatalogue(fournisseurId: string) {
    return this.catalogueRepo.find({
      where: { fournisseurId, actif: true },
      relations: ['article', 'paliers'],
      order: { articleId: 'ASC' },
    });
  }

  async createCatalogue(fournisseurId: string, dto: CreateCatalogueDto) {
    const exists = await this.catalogueRepo.findOne({
      where: { fournisseurId, articleId: dto.articleId },
    });
    if (exists) throw new ConflictException('Article déjà dans le catalogue de ce fournisseur');
    const ligne = this.catalogueRepo.create({ ...dto, fournisseurId });
    return this.catalogueRepo.save(ligne) as unknown as Promise<CatalogueFournisseur>;
  }

  async createPalier(catalogueId: string, dto: CreatePalierDto) {
    const palier = this.palierRepo.create({ ...dto, catalogueFourId: catalogueId });
    return this.palierRepo.save(palier) as unknown as Promise<PalierPrix>;
  }

  // ── Score fournisseur (RG09) ───────────────────────────────────────────────
  async getScore(id: string) {
    const fournisseur = await this.findOne(id);

    // Calcul OTD (30%) sur 12 mois glissants
    const otdResult = await this.repo.query(`
      SELECT
        COUNT(*) FILTER (WHERE r.date_reception <= lca.date_livr_souhaitee) AS livraisons_a_temps,
        COUNT(*) AS total_livraisons
      FROM receptions r
      JOIN commandes_achat ca ON ca.id = r.commande_achat_id
      JOIN lignes_commande_achat lca ON lca.commande_id = ca.id
      WHERE ca.fournisseur_id = $1
        AND r.date_reception >= NOW() - INTERVAL '12 months'
    `, [id]);

    const total = parseInt(otdResult[0]?.total_livraisons || '0');
    const otd = total > 0
      ? (parseInt(otdResult[0].livraisons_a_temps) / total) * 100
      : 100;

    // Taux NC (70%)
    const ncResult = await this.repo.query(`
      SELECT COUNT(*) AS nb_nc
      FROM non_conformites
      WHERE fournisseur_id = $1
        AND type_detection = 'RECEPTION'
        AND created_at >= NOW() - INTERVAL '12 months'
    `, [id]);

    const nbNc = parseInt(ncResult[0]?.nb_nc || '0');
    const tauxQualite = total > 0
      ? Math.max(0, 100 - (nbNc / total) * 100)
      : 100;

    const scoreGlobal = otd * 0.30 + tauxQualite * 0.70;

    let niveau = 'PREFERE';
    if (scoreGlobal < 50) niveau = 'BLOQUE';
    else if (scoreGlobal < 70) niveau = 'SURVEILLANCE';
    else if (scoreGlobal < 90) niveau = 'STANDARD';

    // Mise à jour automatique du score (RG09)
    await this.repo.update(id, { scoreQualite: Math.round(scoreGlobal * 100) / 100 });

    return {
      fournisseur: { id, code: fournisseur.code, raisonSociale: fournisseur.raisonSociale },
      periode: '12 mois glissants',
      otd: Math.round(otd * 100) / 100,
      tauxQualite: Math.round(tauxQualite * 100) / 100,
      scoreGlobal: Math.round(scoreGlobal * 100) / 100,
      niveau,
      totalLivraisons: total,
      nbNonConformites: nbNc,
    };
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('fournisseurs')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fournisseurs')
export class FournisseursController {
  constructor(private readonly service: FournisseursService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les fournisseurs' })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(@Query('statut') statut?: string, @Query('search') search?: string) {
    return this.service.findAll(statut, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un fournisseur' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Créer un fournisseur' })
  create(@Body() dto: CreateFournisseurDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Modifier un fournisseur' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateFournisseurDto) {
    return this.service.update(id, dto);
  }

  // ── Score (RG09) ──────────────────────────────────────────────────────────
  @Get(':id/score')
  @ApiOperation({ summary: 'Score qualité fournisseur (OTD 30% + Qualité 70%) — RG09' })
  getScore(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getScore(id);
  }

  // ── Contacts ──────────────────────────────────────────────────────────────
  @Get(':id/contacts')
  @ApiOperation({ summary: 'Liste les contacts d\'un fournisseur' })
  findContacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findContacts(id);
  }

  @Post(':id/contacts')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Ajouter un contact fournisseur' })
  createContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.service.createContact(id, dto);
  }

  @Delete(':id/contacts/:contactId')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Supprimer un contact fournisseur' })
  deleteContact(@Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.service.deleteContact(contactId);
  }

  // ── Catalogue ─────────────────────────────────────────────────────────────
  @Get(':id/catalogue')
  @ApiOperation({ summary: 'Catalogue articles d\'un fournisseur avec paliers de prix' })
  findCatalogue(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findCatalogue(id);
  }

  @Post(':id/catalogue')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Ajouter un article au catalogue fournisseur' })
  createCatalogue(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCatalogueDto,
  ) {
    return this.service.createCatalogue(id, dto);
  }

  @Post('catalogue/:catalogueId/paliers')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Ajouter un palier de prix à une ligne catalogue' })
  createPalier(
    @Param('catalogueId', ParseUUIDPipe) catalogueId: string,
    @Body() dto: CreatePalierDto,
  ) {
    return this.service.createPalier(catalogueId, dto);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([
    Fournisseur, FournisseurContact, CatalogueFournisseur, PalierPrix,
  ])],
  controllers: [FournisseursController],
  providers: [FournisseursService],
  exports: [FournisseursService],
})
export class FournisseursModule {}
