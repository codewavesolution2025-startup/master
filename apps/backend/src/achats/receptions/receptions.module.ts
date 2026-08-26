import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IsUUID, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Reception } from '../../database/entities/achat.entity';
import { LigneReception } from '../../database/entities/achat.entity';
import { Lot } from '../../database/entities/stock.entity';
import { MouvementStock } from '../../database/entities/stock.entity';
import { StatutLot, MouvementType } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateReceptionDto {
  @ApiProperty()
  @IsUUID()
  commandeAchatId: string;

  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  blFournisseur?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  transporteur?: string;
}

export class CreateLigneReceptionDto {
  @ApiProperty()
  @IsUUID()
  ligneCaId: string;

  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty()
  @IsNumber() @Min(0.001)
  quantiteRecue: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  emplacementId?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateDluo?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  lotFournisseur?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  certificatUrl?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class ReceptionsService {
  constructor(
    @InjectRepository(Reception) private readonly repo: Repository<Reception>,
    @InjectRepository(LigneReception) private readonly ligneRepo: Repository<LigneReception>,
    @InjectRepository(Lot) private readonly lotRepo: Repository<Lot>,
    @InjectRepository(MouvementStock) private readonly mouvRepo: Repository<MouvementStock>,
    private readonly dataSource: DataSource,
  ) {}

  private async genererRef(prefix: string, repo: Repository<any>): Promise<string> {
    const annee = new Date().getFullYear();
    const count = await repo.count();
    return `${prefix}-${annee}-${String(count + 1).padStart(5, '0')}`;
  }

  async findAll(commandeAchatId?: string) {
    const qb = this.repo.createQueryBuilder('r')
      .leftJoinAndSelect('r.commandeAchat', 'ca')
      .leftJoinAndSelect('ca.fournisseur', 'fournisseur')
      .leftJoinAndSelect('r.site', 'site')
      .where('1=1');

    if (commandeAchatId) qb.andWhere('r.commande_achat_id = :id', { id: commandeAchatId });
    return qb.orderBy('r.created_at', 'DESC').getMany();
  }

  async findOne(id: string) {
    const r = await this.repo.findOne({
      where: { id },
      relations: ['commandeAchat', 'commandeAchat.fournisseur', 'site', 'lignes', 'lignes.article', 'lignes.lot'],
    });
    if (!r) throw new NotFoundException(`Réception ${id} introuvable`);
    return r;
  }

  async create(dto: CreateReceptionDto, userId: string) {
    const reference = await this.genererRef('REC', this.repo);
    const reception = this.repo.create({
      ...dto,
      reference,
      statut: 'EN_COURS',
      createdBy: userId,
    });
    return this.repo.save(reception) as unknown as Promise<Reception>;
  }

  // ── US-043 : Réception d'une ligne — crée le lot + mouvement ─────────────
  async addLigne(receptionId: string, dto: CreateLigneReceptionDto, userId: string) {
    const reception = await this.findOne(receptionId);

    // Vérifier tolérance de réception
    const ligneCA = await this.dataSource.query(`
      SELECT lca.*, ca.fournisseur_id
      FROM lignes_commande_achat lca
      JOIN commandes_achat ca ON ca.id = lca.commande_id
      WHERE lca.id = $1
    `, [dto.ligneCaId]);

    if (!ligneCA.length) throw new NotFoundException('Ligne commande achat introuvable');

    const lca = ligneCA[0];
    const qteRestante = lca.quantite_commandee - lca.quantite_recue;
    const tolerancePct = lca.tolerance_pct || 5;
    const qteMaxAcceptee = lca.quantite_commandee * (1 + tolerancePct / 100);

    if (dto.quantiteRecue > qteMaxAcceptee) {
      throw new BadRequestException(
        `Quantité reçue (${dto.quantiteRecue}) dépasse la tolérance de ${tolerancePct}% — max autorisé: ${qteMaxAcceptee}`,
      );
    }

    // Générer numéro de lot
    const lotNumero = await this.genererRef('LOT', this.lotRepo);

    // Créer le lot
    const lot = this.lotRepo.create({
      numero: lotNumero,
      articleId: dto.articleId,
      siteId: reception.siteId,
      emplacementId: dto.emplacementId,
      fournisseurId: lca.fournisseur_id,
      commandeAchatId: reception.commandeAchatId,
      lotFournisseur: dto.lotFournisseur,
      dateDluo: dto.dateDluo ? new Date(dto.dateDluo) : undefined,
      quantiteInitiale: dto.quantiteRecue,
      certificatUrl: dto.certificatUrl,
      statut: StatutLot.DISPONIBLE,
      dateReception: new Date(),
    });
    const savedLot = await this.lotRepo.save(lot);

    // Créer le mouvement d'entrée
    const mouvement = this.mouvRepo.create({
      articleId: dto.articleId,
      lotId: savedLot.id,
      siteId: reception.siteId,
      emplacementId: dto.emplacementId,
      typeMouvement: MouvementType.ENTREE_RECEPTION,
      quantite: dto.quantiteRecue,
      sens: 1,
      origineType: 'COMMANDE_ACHAT',
      origineId: reception.commandeAchatId,
      createdBy: userId,
    });
    const savedMouvement = await this.mouvRepo.save(mouvement);

    // Créer la ligne de réception
    const ligne = this.ligneRepo.create({
      receptionId,
      ligneCaId: dto.ligneCaId,
      articleId: dto.articleId,
      quantiteRecue: dto.quantiteRecue,
      lotId: savedLot.id,
      emplacementId: dto.emplacementId,
      statutControle: 'EN_ATTENTE',
      mouvementStockId: savedMouvement.id,
    });
    await this.ligneRepo.save(ligne);

    // Mettre à jour quantité reçue sur la ligne CA
    await this.dataSource.query(`
      UPDATE lignes_commande_achat
      SET quantite_recue = quantite_recue + $1
      WHERE id = $2
    `, [dto.quantiteRecue, dto.ligneCaId]);

    return {
      lot: savedLot,
      mouvement: savedMouvement,
      message: `Lot ${lotNumero} créé — ${dto.quantiteRecue} unités entrées en stock`,
    };
  }
}

// ── Service MRP ───────────────────────────────────────────────────────────────
@Injectable()
export class MrpService {
  constructor(private readonly dataSource: DataSource) {}

  // ── US-045 : MRP simplifié — besoins nets MP ──────────────────────────────
  async calculerBesoinsNets(horizonJours = 30) {
    const result = await this.dataSource.query(`
      WITH besoins_bruts AS (
        SELECT
          n.composant_id AS article_id,
          a.reference,
          a.designation,
          a.unite_mesure,
          a.delai_reappro_jours,
          SUM(n.qte_avec_perte * of.quantite_prevue) AS besoin_brut,
          MIN(of.date_debut_prevue) AS date_besoin
        FROM ordres_fabrication of
        JOIN nomenclatures n ON n.article_parent = of.article_id
          AND n.actif = true
          AND (n.date_fin IS NULL OR n.date_fin >= CURRENT_DATE)
        JOIN articles a ON a.id = n.composant_id
        WHERE of.statut IN ('PLANIFIE', 'VALIDE')
          AND of.date_debut_prevue <= CURRENT_DATE + ($1 || ' days')::INTERVAL
        GROUP BY n.composant_id, a.reference, a.designation, a.unite_mesure, a.delai_reappro_jours
      ),
      stock_dispo AS (
        SELECT article_id, COALESCE(SUM(stock_disponible), 0) AS stock
        FROM mv_stock_actuel
        GROUP BY article_id
      ),
      en_commande AS (
        SELECT lca.article_id, COALESCE(SUM(lca.quantite_commandee - lca.quantite_recue), 0) AS qte
        FROM lignes_commande_achat lca
        JOIN commandes_achat ca ON ca.id = lca.commande_id
        WHERE ca.statut NOT IN ('CLOTUREE', 'ANNULEE')
        GROUP BY lca.article_id
      )
      SELECT
        bb.article_id,
        bb.reference,
        bb.designation,
        bb.unite_mesure,
        ROUND(bb.besoin_brut::numeric, 3) AS besoin_brut,
        COALESCE(sd.stock, 0) AS stock_disponible,
        COALESCE(ec.qte, 0) AS en_commande,
        GREATEST(0, ROUND((bb.besoin_brut - COALESCE(sd.stock, 0) - COALESCE(ec.qte, 0))::numeric, 3)) AS besoin_net,
        bb.date_besoin,
        bb.date_besoin - (bb.delai_reappro_jours || ' days')::INTERVAL AS date_commande_requise
      FROM besoins_bruts bb
      LEFT JOIN stock_dispo sd ON sd.article_id = bb.article_id
      LEFT JOIN en_commande ec ON ec.article_id = bb.article_id
      WHERE (bb.besoin_brut - COALESCE(sd.stock, 0) - COALESCE(ec.qte, 0)) > 0
      ORDER BY date_commande_requise ASC NULLS LAST
    `, [horizonJours]);

    return {
      horizon: `${horizonJours} jours`,
      dateCalcul: new Date().toISOString(),
      nbArticles: result.length,
      besoins: result,
    };
  }
}

// ── Controllers ───────────────────────────────────────────────────────────────
@ApiTags('achats')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('receptions')
export class ReceptionsController {
  constructor(private readonly service: ReceptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les réceptions' })
  @ApiQuery({ name: 'commandeAchatId', required: false })
  findAll(@Query('commandeAchatId') commandeAchatId?: string) {
    return this.service.findAll(commandeAchatId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une réception avec lots créés' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS, UserRole.GEST_STOCK)
  @ApiOperation({ summary: 'Créer une réception pour une commande achat' })
  create(@Body() dto: CreateReceptionDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user.id);
  }

  @Post(':id/lignes')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS, UserRole.GEST_STOCK)
  @ApiOperation({ summary: 'Réceptionner une ligne — crée lot + mouvement entrée — US-043' })
  addLigne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLigneReceptionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.addLigne(id, dto, user.id);
  }
}

@ApiTags('achats')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mrp')
export class MrpController {
  constructor(private readonly service: MrpService) {}

  @Get('besoins-nets')
  @Roles(UserRole.ADMIN, UserRole.RESP_ACHATS, UserRole.RESP_PROD, UserRole.DIRECTEUR)
  @ApiOperation({ summary: 'MRP simplifié — besoins nets MP sur horizon (défaut 30j) — US-045' })
  @ApiQuery({ name: 'horizon', required: false, type: Number, description: 'Horizon en jours (défaut 30)' })
  getBesoinsNets(@Query('horizon') horizon?: number) {
    return this.service.calculerBesoinsNets(horizon ? Number(horizon) : 30);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([Reception, LigneReception, Lot, MouvementStock])],
  controllers: [ReceptionsController, MrpController],
  providers: [ReceptionsService, MrpService],
  exports: [ReceptionsService, MrpService],
})
export class ReceptionsModule {}
