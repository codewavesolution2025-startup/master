import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, Query, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  IsUUID, IsNumber, IsOptional, IsString,
  IsDateString, Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { OrdreFabrication } from '../../database/entities/production.entity';
import { DeclarationProduction } from '../../database/entities/production.entity';
import { ConsommationMp } from '../../database/entities/production.entity';
import { Lot } from '../../database/entities/stock.entity';
import { MouvementStock } from '../../database/entities/stock.entity';
import { StatutOF, StatutLot, MouvementType } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateOFDto {
  @ApiProperty()
  @IsString()
  articleId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  gammeId?: string;

  @ApiProperty()
  @IsString()
  siteId: string;

  @ApiProperty()
  @IsNumber() @Min(0.001)
  quantitePrevue: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateDebutPrevue?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsDateString()
  dateFinPrevue?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  commandeClientId?: string;
}

export class DeclarationProductionDto {
  @ApiProperty()
  @IsUUID()
  operationId: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  quantiteProduite?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  quantiteRebut?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  codeMotifRebut?: string;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  tempsPreparation?: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  tempsProduction?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

export class ConsommationMpDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  lotId?: string;

  @ApiProperty()
  @IsNumber() @Min(0)
  qteReelle: number;
}

export class CloturerOFDto {
  @ApiProperty()
  @IsNumber() @Min(0)
  quantiteProduiteFinale: number;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  quantiteRebutFinale?: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class OrdresFabricationService {
  constructor(
    @InjectRepository(OrdreFabrication) private readonly repo: Repository<OrdreFabrication>,
    @InjectRepository(DeclarationProduction) private readonly declRepo: Repository<DeclarationProduction>,
    @InjectRepository(ConsommationMp) private readonly consoRepo: Repository<ConsommationMp>,
    @InjectRepository(Lot) private readonly lotRepo: Repository<Lot>,
    @InjectRepository(MouvementStock) private readonly mouvRepo: Repository<MouvementStock>,
    private readonly dataSource: DataSource,
  ) {}

  private async genererReference(): Promise<string> {
    const now = new Date();
    const annee = now.getFullYear();
    const mois = String(now.getMonth() + 1).padStart(2, '0');
    const count = await this.repo.count();
    return `OF-${annee}-${mois}-${String(count + 1).padStart(4, '0')}`;
  }

  async findAll(filters: {
    statut?: StatutOF;
    articleId?: string;
    siteId?: string;
    page?: number;
    limit?: number;
  }) {
    const { statut, articleId, siteId } = filters;
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const qb = this.repo.createQueryBuilder('of')
      .leftJoinAndSelect('of.article', 'article')
      .leftJoinAndSelect('of.site', 'site')
      .leftJoinAndSelect('of.gamme', 'gamme')
      .where('1=1');

    if (statut) qb.andWhere('of.statut = :statut', { statut });
    if (articleId) qb.andWhere('of.article_id = :articleId', { articleId });
    if (siteId) qb.andWhere('of.site_id = :siteId', { siteId });

    const [data, total] = await qb
      .orderBy('of.dateDebutPrevue', 'ASC', 'NULLS LAST')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const of = await this.repo.findOne({
      where: { id },
      relations: ['article', 'site', 'gamme', 'gamme.operations', 'lotPf'],
    });
    if (!of) throw new NotFoundException(`OF ${id} introuvable`);
    return of;
  }

  async create(dto: CreateOFDto, userId: string) {
    const reference = await this.genererReference();
    const of = this.repo.create({
      ...dto,
      reference,
      statut: StatutOF.PLANIFIE,
      createdBy: userId,
      dateDebutPrevue: dto.dateDebutPrevue ? new Date(dto.dateDebutPrevue) : undefined,
      dateFinPrevue: dto.dateFinPrevue ? new Date(dto.dateFinPrevue) : undefined,
    });
    return this.repo.save(of) as unknown as Promise<OrdreFabrication>;
  }

  // ── US-054 : Vérifier disponibilité MP ────────────────────────────────────
  async verifierDisponibiliteMp(id: string) {
    const of = await this.findOne(id);

    const composants = await this.dataSource.query(`
      SELECT
        n.composant_id AS article_id,
        a.reference,
        a.designation,
        a.unite_mesure,
        ROUND((n.qte_avec_perte * $2)::numeric, 3) AS qte_necessaire,
        COALESCE(s.stock_disponible, 0) AS stock_disponible,
        GREATEST(0, ROUND((n.qte_avec_perte * $2 - COALESCE(s.stock_disponible, 0))::numeric, 3)) AS manquant,
        CASE
          WHEN COALESCE(s.stock_disponible, 0) >= n.qte_avec_perte * $2 THEN 'OK'
          ELSE 'MANQUANT'
        END AS statut
      FROM nomenclatures n
      JOIN articles a ON a.id = n.composant_id
      LEFT JOIN mv_stock_actuel s ON s.article_id = n.composant_id AND s.site_id = $3
      WHERE n.article_parent = $1
        AND n.actif = true
        AND (n.date_fin IS NULL OR n.date_fin >= CURRENT_DATE)
      ORDER BY statut DESC, a.reference
    `, [of.articleId, of.quantitePrevue, of.siteId]);

    const estFaisable = composants.every((c: any) => c.statut === 'OK');

    return {
      ofId: id,
      reference: of.reference,
      quantitePrevue: of.quantitePrevue,
      estFaisable,
      composants,
      nbManquants: composants.filter((c: any) => c.statut === 'MANQUANT').length,
    };
  }

  // ── US-055 : Lancement sécurisé via fn_lancer_of ─────────────────────────
  async lancer(id: string, userId: string) {
    const of = await this.findOne(id);

    if (of.statut !== StatutOF.VALIDE) {
      throw new BadRequestException(`OF en statut ${of.statut} — doit être VALIDE pour lancer`);
    }

    // Appeler la fonction PostgreSQL fn_lancer_of
    const result = await this.dataSource.query(
      `SELECT fn_lancer_of($1, $2) AS resultat`,
      [id, userId],
    );

    const resultat = result[0]?.resultat;

    if (!resultat?.succes) {
      throw new BadRequestException(
        resultat?.erreur || 'Échec du lancement',
        resultat?.manquants ? JSON.stringify(resultat.manquants) : undefined,
      );
    }

    return { message: 'OF lancé avec succès', of: await this.findOne(id) };
  }

  async valider(id: string, userId: string) {
    const of = await this.findOne(id);
    if (of.statut !== StatutOF.PLANIFIE) {
      throw new BadRequestException(`OF en statut ${of.statut} — doit être PLANIFIE`);
    }
    await this.repo.update(id, { statut: StatutOF.VALIDE, validePar: userId });
    return this.findOne(id);
  }

  async suspendre(id: string, motif: string) {
    const of = await this.findOne(id);
    if (![StatutOF.LANCE, StatutOF.EN_COURS].includes(of.statut)) {
      throw new BadRequestException('OF non suspendable dans ce statut');
    }
    await this.repo.update(id, { statut: StatutOF.SUSPENDU, motifSuspension: motif });
    return this.findOne(id);
  }

  async reprendre(id: string) {
    const of = await this.findOne(id);
    if (of.statut !== StatutOF.SUSPENDU) {
      throw new BadRequestException('OF non en statut SUSPENDU');
    }
    await this.repo.update(id, { statut: StatutOF.EN_COURS, motifSuspension: undefined });
    return this.findOne(id);
  }

  // ── US-056 : Déclarations de production ──────────────────────────────────
  async declarer(id: string, dto: DeclarationProductionDto, userId: string) {
    const of = await this.findOne(id);

    // RG07 : OF clos non déclarable
    if ([StatutOF.CLOS, StatutOF.ANNULE].includes(of.statut)) {
      throw new BadRequestException(`RG07 : Impossible de déclarer sur un OF en statut ${of.statut}`);
    }

    if (![StatutOF.LANCE, StatutOF.EN_COURS].includes(of.statut)) {
      throw new BadRequestException(`OF doit être en statut LANCE ou EN_COURS`);
    }

    const declaration = this.declRepo.create({
      ofId: id,
      operationId: dto.operationId,
      operateurId: userId,
      quantiteProduite: dto.quantiteProduite || 0,
      quantiteRebut: dto.quantiteRebut || 0,
      codeMotifRebut: dto.codeMotifRebut,
      tempsPreparation: dto.tempsPreparation || 0,
      tempsProduction: dto.tempsProduction || 0,
      commentaire: dto.commentaire,
    });

    const saved = await this.declRepo.save(declaration);

    // Mettre à jour quantités sur l'OF
    await this.repo.update(id, {
      statut: StatutOF.EN_COURS,
      quantiteProduite: () => `quantite_produite + ${dto.quantiteProduite || 0}`,
      quantiteRebut: () => `quantite_rebut + ${dto.quantiteRebut || 0}`,
    });

    return saved;
  }

  // ── US-057 : Consommations MP ─────────────────────────────────────────────
  async enregistrerConsommation(id: string, dto: ConsommationMpDto, userId: string) {
    const of = await this.findOne(id);

    if ([StatutOF.CLOS, StatutOF.ANNULE].includes(of.statut)) {
      throw new BadRequestException('OF clos — consommation impossible');
    }

    // Récupérer qté théorique depuis nomenclature
    const theo = await this.dataSource.query(`
      SELECT ROUND((n.qte_avec_perte * $3)::numeric, 3) AS qte_theorique
      FROM nomenclatures n
      WHERE n.article_parent = $1 AND n.composant_id = $2
        AND n.actif = true LIMIT 1
    `, [of.articleId, dto.articleId, of.quantitePrevue]);

    const qteTheorique = parseFloat(theo[0]?.qte_theorique || '0');

    // Créer mouvement de sortie
    const mouvement = this.mouvRepo.create({
      articleId: dto.articleId,
      lotId: dto.lotId,
      siteId: of.siteId,
      typeMouvement: MouvementType.SORTIE_CONSOMMATION,
      quantite: dto.qteReelle,
      sens: -1,
      origineType: 'OF',
      origineId: id,
      createdBy: userId,
    });
    const savedMouv = await this.mouvRepo.save(mouvement);

    // Enregistrer consommation
    const conso = this.consoRepo.create({
      ofId: id,
      articleId: dto.articleId,
      lotId: dto.lotId,
      qteTheorique,
      qteReelle: dto.qteReelle,
      mouvementId: savedMouv.id,
    });

    return this.consoRepo.save(conso);
  }

  // ── US-058 : Clôture OF ───────────────────────────────────────────────────
  async cloturer(id: string, dto: CloturerOFDto, userId: string) {
    const of = await this.findOne(id);

    if (![StatutOF.EN_COURS, StatutOF.LANCE, StatutOF.TERMINE].includes(of.statut)) {
      throw new BadRequestException(`OF en statut ${of.statut} — non clôturable`);
    }

    // Générer numéro de lot PF
    const annee = new Date().getFullYear();
    const count = await this.lotRepo.count();
    const lotPfNumero = `LOT-${annee}-PF-${String(count + 1).padStart(5, '0')}`;

    // Créer lot PF
    const lotPf = this.lotRepo.create({
      numero: lotPfNumero,
      articleId: of.articleId,
      siteId: of.siteId,
      quantiteInitiale: dto.quantiteProduiteFinale,
      statut: StatutLot.DISPONIBLE,
      dateReception: new Date(),
    });
    const savedLotPf = await this.lotRepo.save(lotPf);

    // Mouvement entrée PF
    await this.mouvRepo.save(this.mouvRepo.create({
      articleId: of.articleId,
      lotId: savedLotPf.id,
      siteId: of.siteId,
      typeMouvement: MouvementType.ENTREE_PRODUCTION,
      quantite: dto.quantiteProduiteFinale,
      sens: 1,
      origineType: 'OF',
      origineId: id,
      createdBy: userId,
    }));

    // Calculer coûts réels
    const couts = await this.dataSource.query(`
      SELECT
        COALESCE(SUM(c.qte_reelle * a.prix_achat_std), 0) AS cout_mp_reel,
        COALESCE(SUM(d.temps_production / 60.0 * p.cout_horaire), 0) AS cout_mo_reel
      FROM ordres_fabrication of
      LEFT JOIN consommations_mp c ON c.of_id = of.id
      LEFT JOIN articles a ON a.id = c.article_id
      LEFT JOIN declarations_production d ON d.of_id = of.id
      LEFT JOIN operations_gamme og ON og.id = d.operation_id
      LEFT JOIN postes_charge p ON p.id = og.poste_charge_id
      WHERE of.id = $1
    `, [id]);

    // RG07 : Clôturer l'OF (irréversible)
    await this.repo.update(id, {
      statut: StatutOF.CLOS,
      quantiteProduite: dto.quantiteProduiteFinale,
      quantiteRebut: dto.quantiteRebutFinale || 0,
      lotPfId: savedLotPf.id,
      dateFinReelle: new Date(),
      coutMpReel: couts[0]?.cout_mp_reel || 0,
      coutMoReel: couts[0]?.cout_mo_reel || 0,
    });

    return {
      message: 'OF clôturé avec succès',
      lotPf: savedLotPf,
      of: await this.findOne(id),
    };
  }

  // ── Rapport écarts ─────────────────────────────────────────────────────────
  async getRapportEcarts(id: string) {
    return this.dataSource.query(`
      SELECT
        c.article_id,
        a.reference,
        a.designation,
        a.unite_mesure,
        c.qte_theorique,
        c.qte_reelle,
        c.ecart_qte,
        ROUND((c.ecart_qte / NULLIF(c.qte_theorique, 0) * 100)::numeric, 2) AS ecart_pct,
        ROUND((c.ecart_qte * a.prix_achat_std)::numeric, 2) AS ecart_valeur_eur
      FROM consommations_mp c
      JOIN articles a ON a.id = c.article_id
      WHERE c.of_id = $1
        AND ABS(c.ecart_qte) > 0.001
      ORDER BY ABS(c.ecart_qte * a.prix_achat_std) DESC
    `, [id]);
  }

  async getDeclarations(ofId: string) {
    return this.declRepo.find({
      where: { ofId },
      relations: ['operation', 'operation.posteCharge'],
      order: { dateDeclaration: 'ASC' },
    });
  }

  async getConsommations(ofId: string) {
    return this.consoRepo.find({
      where: { ofId },
      relations: ['article', 'lot'],
      order: { createdAt: 'ASC' },
    });
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('production')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ordres-fabrication')
export class OrdresFabricationController {
  constructor(private readonly service: OrdresFabricationService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les ordres de fabrication' })
  @ApiQuery({ name: 'statut', required: false, enum: StatutOF })
  @ApiQuery({ name: 'articleId', required: false })
  @ApiQuery({ name: 'siteId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  findAll(
    @Query('statut') statut?: StatutOF,
    @Query('articleId') articleId?: string,
    @Query('siteId') siteId?: string,
    @Query('page') page?: number,
  ) {
    return this.service.findAll({ statut, articleId, siteId, page });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un OF' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/disponibilite-mp')
  @ApiOperation({ summary: 'Vérifier disponibilité MP avant lancement — US-054' })
  verifierMp(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.verifierDisponibiliteMp(id);
  }

  @Get(':id/declarations')
  @ApiOperation({ summary: 'Déclarations de production de l\'OF' })
  getDeclarations(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getDeclarations(id);
  }

  @Get(':id/consommations')
  @ApiOperation({ summary: 'Consommations MP réelles vs théoriques — US-057' })
  getConsommations(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getConsommations(id);
  }

  @Get(':id/rapport-ecarts')
  @ApiOperation({ summary: 'Rapport des écarts de consommation MP — US-058' })
  getRapportEcarts(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getRapportEcarts(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Créer un ordre de fabrication — US-053' })
  create(@Body() dto: CreateOFDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user.id);
  }

  @Put(':id/valider')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Valider un OF (PLANIFIE → VALIDE)' })
  valider(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.service.valider(id, user.id);
  }

  @Put(':id/lancer')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Lancer un OF — vérifie stock MP + réserve — US-055 RG04' })
  lancer(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtUser) {
    return this.service.lancer(id, user.id);
  }

  @Put(':id/suspendre')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Suspendre un OF avec motif' })
  suspendre(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('motif') motif: string,
  ) {
    return this.service.suspendre(id, motif);
  }

  @Put(':id/reprendre')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Reprendre un OF suspendu' })
  reprendre(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.reprendre(id);
  }

  @Post(':id/declarations')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD, UserRole.OPERATEUR)
  @ApiOperation({ summary: 'Déclarer production par opération — US-056 RG07' })
  declarer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeclarationProductionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.declarer(id, dto, user.id);
  }

  @Post(':id/consommations')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD, UserRole.OPERATEUR)
  @ApiOperation({ summary: 'Enregistrer consommation MP réelle — US-057' })
  consommer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConsommationMpDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.enregistrerConsommation(id, dto, user.id);
  }

  @Put(':id/cloturer')
  @Roles(UserRole.ADMIN, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Clôturer un OF — crée lot PF + entrée stock — US-058 RG07' })
  cloturer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloturerOFDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.cloturer(id, dto, user.id);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([
    OrdreFabrication, DeclarationProduction, ConsommationMp, Lot, MouvementStock,
  ])],
  controllers: [OrdresFabricationController],
  providers: [OrdresFabricationService],
  exports: [OrdresFabricationService],
})
export class OrdresFabricationModule {}
