import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  IsUUID, IsNumber, IsOptional, IsString,
  IsDateString, IsEnum, Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { CommandeClient } from '../database/entities/expedition.entity';
import { LigneCommandeClient } from '../database/entities/expedition.entity';
import { BonLivraison } from '../database/entities/expedition.entity';
import { LigneBl } from '../database/entities/expedition.entity';
import { Lot } from '../database/entities/stock.entity';
import { MouvementStock } from '../database/entities/stock.entity';
import { StatutCommandeClient, MouvementType } from '../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../auth/decorators/auth.decorators';
import { UserRole } from '../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateCommandeClientDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  refClient?: string;

  @ApiProperty()
  @IsString()
  clientId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateLivraisonPrev?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  adresseLivraison?: string;

  @ApiProperty({ required: false, default: 'EUR' })
  @IsOptional() @IsString()
  devise?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  notes?: string;
}

export class CreateLigneCommandeClientDto {
  @ApiProperty()
  @IsString()
  articleId: string;

  @ApiProperty()
  @IsNumber() @Min(0.001)
  quantiteCommandee: number;

  @ApiProperty()
  @IsNumber() @Min(0)
  prixUnitaire: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateLivrSouhaitee?: string;
}

export class CreateBonLivraisonDto {
  @ApiProperty()
  @IsUUID()
  commandeId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  transporteur?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  numeroTracking?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsNumber() @Min(0)
  poidsTotalKg?: number;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional() @IsNumber() @Min(1)
  nbColis?: number;
}

export class CreateLigneBlDto {
  @ApiProperty()
  @IsString()
  articleId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  lotId?: string;

  @ApiProperty()
  @IsNumber() @Min(0.001)
  quantite: number;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class ExpeditionsService {
  constructor(
    @InjectRepository(CommandeClient) private readonly ccRepo: Repository<CommandeClient>,
    @InjectRepository(LigneCommandeClient) private readonly lccRepo: Repository<LigneCommandeClient>,
    @InjectRepository(BonLivraison) private readonly blRepo: Repository<BonLivraison>,
    @InjectRepository(LigneBl) private readonly ligneBlRepo: Repository<LigneBl>,
    @InjectRepository(Lot) private readonly lotRepo: Repository<Lot>,
    @InjectRepository(MouvementStock) private readonly mouvRepo: Repository<MouvementStock>,
  ) {}

  private async genRef(prefix: string, repo: Repository<any>): Promise<string> {
    const annee = new Date().getFullYear();
    const count = await repo.count();
    return `${prefix}-${annee}-${String(count + 1).padStart(5, '0')}`;
  }

  // ── Commandes clients ──────────────────────────────────────────────────────
  async findAllCC(filters: { clientId?: string; statut?: string; page?: number }) {
    const { clientId, statut } = filters;
    const page = Number(filters.page) || 1;
    const qb = this.ccRepo.createQueryBuilder('cc')
      .leftJoinAndSelect('cc.client', 'client')
      .leftJoinAndSelect('cc.lignes', 'lignes')
      .where('1=1');
    if (clientId) qb.andWhere('cc.client_id = :clientId', { clientId });
    if (statut) qb.andWhere('cc.statut = :statut', { statut });
    const [data, total] = await qb
      .orderBy('cc.createdAt', 'DESC')
      .skip((page - 1) * 20).take(20)
      .getManyAndCount();
    return { data, total, page };
  }

  async findOneCC(id: string) {
    const cc = await this.ccRepo.findOne({
      where: { id },
      relations: ['client', 'lignes', 'lignes.article', 'bonsLivraison'],
    });
    if (!cc) throw new NotFoundException(`Commande client ${id} introuvable`);
    return cc;
  }

  async createCC(dto: CreateCommandeClientDto, userId: string) {
    const reference = await this.genRef('CC', this.ccRepo);
    const cc = this.ccRepo.create({
      ...dto,
      reference,
      statut: StatutCommandeClient.RECUE,
      createdBy: userId,
      dateLivraisonPrev: dto.dateLivraisonPrev ? new Date(dto.dateLivraisonPrev) : undefined,
    });
    return this.ccRepo.save(cc) as unknown as Promise<CommandeClient>;
  }

  async addLigneCC(ccId: string, dto: CreateLigneCommandeClientDto) {
    const cc = await this.findOneCC(ccId);
    const nbLignes = await this.lccRepo.count({ where: { commandeId: ccId } });
    const ligne = this.lccRepo.create({
      ...dto,
      commandeId: ccId,
      numLigne: (nbLignes + 1) * 10,
      dateLivrSouhaitee: dto.dateLivrSouhaitee ? new Date(dto.dateLivrSouhaitee) : undefined,
    });
    return this.lccRepo.save(ligne) as unknown as Promise<LigneCommandeClient>;
  }

  async changerStatutCC(id: string, statut: StatutCommandeClient) {
    await this.findOneCC(id);
    await this.ccRepo.update(id, { statut });
    return this.findOneCC(id);
  }

  // ── Bons de livraison ──────────────────────────────────────────────────────
  async findAllBL(commandeId?: string) {
    const qb = this.blRepo.createQueryBuilder('bl')
      .leftJoinAndSelect('bl.commande', 'commande')
      .leftJoinAndSelect('bl.lignes', 'lignes')
      .leftJoinAndSelect('lignes.article', 'article')
      .leftJoinAndSelect('lignes.lot', 'lot')
      .where('1=1');
    if (commandeId) qb.andWhere('bl.commande_id = :commandeId', { commandeId });
    return qb.orderBy('bl.created_at', 'DESC').getMany();
  }

  async createBL(dto: CreateBonLivraisonDto, userId: string) {
    await this.findOneCC(dto.commandeId);
    const reference = await this.genRef('BL', this.blRepo);
    const bl = this.blRepo.create({
      ...dto,
      reference,
      statut: 'PREPARE',
      createdBy: userId,
    });
    return this.blRepo.save(bl) as unknown as Promise<BonLivraison>;
  }

  // ── US-073 : Ligne BL avec traçabilité lot ────────────────────────────────
  async addLigneBL(blId: string, dto: CreateLigneBlDto, userId: string) {
    const bl = await this.blRepo.findOne({ where: { id: blId } });
    if (!bl) throw new NotFoundException(`BL ${blId} introuvable`);

    // Créer mouvement sortie expédition
    const mouvement = this.mouvRepo.create({
      articleId: dto.articleId,
      lotId: dto.lotId,
      siteId: '00000000-0000-0000-0000-000000000000', // sera mis à jour depuis la CC
      typeMouvement: MouvementType.SORTIE_EXPEDITION,
      quantite: dto.quantite,
      sens: -1,
      origineType: 'COMMANDE_CLIENT',
      origineId: bl.commandeId,
      createdBy: userId,
    });
    const savedMouv = await this.mouvRepo.save(mouvement);

    const ligne = this.ligneBlRepo.create({
      blId,
      articleId: dto.articleId,
      lotId: dto.lotId,
      quantite: dto.quantite,
      mouvementId: savedMouv.id,
    });

    return this.ligneBlRepo.save(ligne) as unknown as Promise<LigneBl>;
  }

  async expedier(blId: string) {
    await this.blRepo.update(blId, {
      statut: 'EXPEDIE',
      dateExpedition: new Date(),
    });
    return this.blRepo.findOne({ where: { id: blId } });
  }

  async confirmerLivraison(blId: string, podUrl?: string) {
    await this.blRepo.update(blId, {
      statut: 'LIVRE',
      dateLivraison: new Date(),
      podUrl,
    });
    return this.blRepo.findOne({ where: { id: blId } });
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────
@ApiTags('expeditions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commandes-clients')
export class CommandesClientsController {
  constructor(private readonly service: ExpeditionsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les commandes clients — US-070' })
  @ApiQuery({ name: 'clientId', required: false })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(
    @Query('clientId') clientId?: string,
    @Query('statut') statut?: string,
    @Query('page') page?: number,
  ) {
    return this.service.findAllCC({ clientId, statut, page });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une commande client' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneCC(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Créer une commande client — US-070' })
  create(@Body() dto: CreateCommandeClientDto, @CurrentUser() user: JwtUser) {
    return this.service.createCC(dto, user.id);
  }

  @Post(':id/lignes')
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN)
  @ApiOperation({ summary: 'Ajouter une ligne commande client — US-071' })
  addLigne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLigneCommandeClientDto,
  ) {
    return this.service.addLigneCC(id, dto);
  }

  @Put(':id/statut/:statut')
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN)
  @ApiOperation({ summary: 'Changer statut commande client' })
  changerStatut(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('statut') statut: StatutCommandeClient,
  ) {
    return this.service.changerStatutCC(id, statut);
  }
}

@ApiTags('expeditions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bons-livraison')
export class BonsLivraisonController {
  constructor(private readonly service: ExpeditionsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les bons de livraison — US-072' })
  @ApiQuery({ name: 'commandeId', required: false })
  findAll(@Query('commandeId') commandeId?: string) {
    return this.service.findAllBL(commandeId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN)
  @ApiOperation({ summary: 'Créer un bon de livraison — US-072' })
  create(@Body() dto: CreateBonLivraisonDto, @CurrentUser() user: JwtUser) {
    return this.service.createBL(dto, user.id);
  }

  @Post(':id/lignes')
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN)
  @ApiOperation({ summary: 'Ajouter une ligne BL avec traçabilité lot — US-073' })
  addLigne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLigneBlDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.addLigneBL(id, dto, user.id);
  }

  @Put(':id/expedier')
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN)
  @ApiOperation({ summary: 'Marquer le BL comme expédié' })
  expedier(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.expedier(id);
  }

  @Put(':id/livrer')
  @Roles(UserRole.ADMIN, UserRole.LOGISTICIEN)
  @ApiOperation({ summary: 'Confirmer la livraison avec preuve (POD)' })
  livrer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('podUrl') podUrl?: string,
  ) {
    return this.service.confirmerLivraison(id, podUrl);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([
    CommandeClient, LigneCommandeClient, BonLivraison, LigneBl, Lot, MouvementStock,
  ])],
  controllers: [CommandesClientsController, BonsLivraisonController],
  providers: [ExpeditionsService],
  exports: [ExpeditionsService],
})
export class ExpeditionsModule {}
