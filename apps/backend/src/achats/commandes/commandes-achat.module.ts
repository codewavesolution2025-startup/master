import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  IsUUID, IsNumber, IsOptional, IsString,
  IsDateString, IsEnum, Min, IsArray, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { CommandeAchat } from '../../database/entities/achat.entity';
import { LigneCommandeAchat } from '../../database/entities/achat.entity';
import { StatutCA } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateCommandeAchatDto {
  @ApiProperty()
  @IsUUID()
  fournisseurId: string;

  @ApiProperty()
  @IsUUID()
  siteLivraisonId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateLivraisonPrev?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  incoterm?: string;

  @ApiProperty({ required: false, default: 'VIREMENT' })
  @IsOptional() @IsString()
  modePaiement?: string;

  @ApiProperty({ required: false, default: 30 })
  @IsOptional() @IsNumber()
  delaiPaiement?: number;

  @ApiProperty({ required: false, default: 'EUR' })
  @IsOptional() @IsString()
  devise?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  notesInternes?: string;
}

export class CreateLigneCADto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  refArticleFour?: string;

  @ApiProperty()
  @IsNumber() @Min(0.001)
  quantiteCommandee: number;

  @ApiProperty()
  @IsNumber() @Min(0)
  prixUnitaire: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  remisePct?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateLivrSouhaitee?: string;

  @ApiProperty({ required: false, default: 5 })
  @IsOptional() @IsNumber()
  tolerancePct?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  demandeAchatId?: string;
}

export class EnvoyerCommandeDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class CommandesAchatService {
  constructor(
    @InjectRepository(CommandeAchat)
    private readonly repo: Repository<CommandeAchat>,
    @InjectRepository(LigneCommandeAchat)
    private readonly ligneRepo: Repository<LigneCommandeAchat>,
    private readonly dataSource: DataSource,
  ) {}

  private async genererReference(): Promise<string> {
    const annee = new Date().getFullYear();
    const count = await this.repo.count();
    return `CA-${annee}-${String(count + 1).padStart(5, '0')}`;
  }

  async findAll(filters: {
    fournisseurId?: string;
    statut?: StatutCA;
    siteId?: string;
    page?: number;
    limit?: number;
  }) {
    const { fournisseurId, statut, siteId, page = 1, limit = 20 } = filters;
    const qb = this.repo.createQueryBuilder('ca')
      .leftJoinAndSelect('ca.fournisseur', 'fournisseur')
      .leftJoinAndSelect('ca.siteLivraison', 'site')
      .where('1=1');

    if (fournisseurId) qb.andWhere('ca.fournisseur_id = :fournisseurId', { fournisseurId });
    if (statut) qb.andWhere('ca.statut = :statut', { statut });
    if (siteId) qb.andWhere('ca.site_livraison_id = :siteId', { siteId });

    const [data, total] = await qb
      .orderBy('ca.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const ca = await this.repo.findOne({
      where: { id },
      relations: ['fournisseur', 'siteLivraison', 'lignes', 'lignes.article'],
    });
    if (!ca) throw new NotFoundException(`Commande achat ${id} introuvable`);
    return ca;
  }

  async create(dto: CreateCommandeAchatDto, userId: string) {
    const reference = await this.genererReference();
    const ca = this.repo.create({
      ...dto,
      reference,
      statut: StatutCA.BROUILLON,
      createdBy: userId,
    });
    return this.repo.save(ca) as unknown as Promise<CommandeAchat>;
  }

  async addLigne(caId: string, dto: CreateLigneCADto) {
    const ca = await this.findOne(caId);
    if (![StatutCA.BROUILLON].includes(ca.statut)) {
      throw new BadRequestException('Impossible d\'ajouter une ligne — CA non en brouillon');
    }

    // Numéro de ligne auto
    const nbLignes = await this.ligneRepo.count({ where: { commandeId: caId } });

    const ligne = this.ligneRepo.create({
      ...dto,
      commandeId: caId,
      numLigne: (nbLignes + 1) * 10,
    });
    const savedLigne = await this.ligneRepo.save(ligne);

    // Recalculer montant total CA
    await this.recalculerMontants(caId);
    return savedLigne;
  }

  private async recalculerMontants(caId: string) {
    await this.dataSource.query(`
      UPDATE commandes_achat
      SET montant_ht = (
        SELECT COALESCE(SUM(montant_ligne), 0)
        FROM lignes_commande_achat
        WHERE commande_id = $1
      ),
      montant_tva = (
        SELECT COALESCE(SUM(montant_ligne), 0) * 0.20
        FROM lignes_commande_achat
        WHERE commande_id = $1
      ),
      montant_ttc = (
        SELECT COALESCE(SUM(montant_ligne), 0) * 1.20
        FROM lignes_commande_achat
        WHERE commande_id = $1
      )
      WHERE id = $1
    `, [caId]);
  }

  // ── Workflow ──────────────────────────────────────────────────────────────

  async valider(id: string, userId: string) {
    const ca = await this.findOne(id);
    if (ca.statut !== StatutCA.BROUILLON) {
      throw new BadRequestException(`CA en statut ${ca.statut} — non validable`);
    }
    if (!ca.lignes?.length) {
      throw new BadRequestException('Impossible de valider une CA sans lignes');
    }
    await this.repo.update(id, {
      statut: StatutCA.VALIDEE,
      validePar: userId,
      dateValidation: new Date(),
    });
    return this.findOne(id);
  }

  // RG08 : CA non modifiable après envoi
  async envoyer(id: string, dto: EnvoyerCommandeDto, userId: string) {
    const ca = await this.findOne(id);
    if (ca.statut !== StatutCA.VALIDEE) {
      throw new BadRequestException(`CA en statut ${ca.statut} — doit être VALIDEE avant envoi`);
    }
    await this.repo.update(id, {
      statut: StatutCA.ENVOYEE,
      envoyePar: userId,
      dateEnvoi: new Date(),
    });
    return this.findOne(id);
  }

  async changerStatut(id: string, statut: StatutCA) {
    const ca = await this.findOne(id);

    // Transitions autorisées
    const transitions: Partial<Record<StatutCA, StatutCA[]>> = {
      [StatutCA.ENVOYEE]:  [StatutCA.AR_RECU],
      [StatutCA.AR_RECU]:  [StatutCA.EN_COURS],
      [StatutCA.EN_COURS]: [StatutCA.RECUE],
      [StatutCA.RECUE]:    [StatutCA.CLOTUREE],
      [StatutCA.BROUILLON]: [StatutCA.ANNULEE],
      [StatutCA.VALIDEE]:  [StatutCA.ANNULEE],
    };

    if (!transitions[ca.statut]?.includes(statut)) {
      throw new BadRequestException(`Transition ${ca.statut} → ${statut} non autorisée`);
    }

    await this.repo.update(id, { statut });
    return this.findOne(id);
  }

  async getLignes(caId: string) {
    return this.ligneRepo.find({
      where: { commandeId: caId },
      relations: ['article', 'demandeAchat'],
      order: { numLigne: 'ASC' },
    });
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('achats')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commandes-achat')
export class CommandesAchatController {
  constructor(private readonly service: CommandesAchatService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les commandes achat' })
  @ApiQuery({ name: 'fournisseurId', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: StatutCA })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(
    @Query('fournisseurId') fournisseurId?: string,
    @Query('statut') statut?: StatutCA,
    @Query('siteId') siteId?: string,
    @Query('page') page?: number,
  ) {
    return this.service.findAll({ fournisseurId, statut, siteId, page });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une commande achat avec lignes' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Créer une commande achat — statut BROUILLON' })
  create(@Body() dto: CreateCommandeAchatDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user.id);
  }

  @Post(':id/lignes')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Ajouter une ligne à la commande' })
  addLigne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLigneCADto,
  ) {
    return this.service.addLigne(id, dto);
  }

  @Get(':id/lignes')
  @ApiOperation({ summary: 'Lignes d\'une commande achat' })
  getLignes(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getLignes(id);
  }

  @Put(':id/valider')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Valider la commande (BROUILLON → VALIDEE)' })
  valider(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.service.valider(id, user.id);
  }

  @Put(':id/envoyer')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Envoyer au fournisseur (VALIDEE → ENVOYEE) — RG08 : non modifiable après' })
  envoyer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EnvoyerCommandeDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.envoyer(id, dto, user.id);
  }

  @Put(':id/statut/:statut')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Changer le statut (AR_RECU, EN_COURS, RECUE, CLOTUREE, ANNULEE)' })
  changerStatut(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('statut') statut: StatutCA,
  ) {
    return this.service.changerStatut(id, statut);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([CommandeAchat, LigneCommandeAchat])],
  controllers: [CommandesAchatController],
  providers: [CommandesAchatService],
  exports: [CommandesAchatService],
})
export class CommandesAchatModule {}
