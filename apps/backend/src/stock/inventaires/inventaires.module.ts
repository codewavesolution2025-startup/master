import {
  Controller, Get, Post, Put, Param, Body,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { IsUUID, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MouvementStock } from '../../database/entities/stock.entity';
import { MouvementType } from '../../database/entities/enums';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../../auth/decorators/auth.decorators';
import { UserRole } from '../../database/entities/enums';

// ── DTOs ─────────────────────────────────────────────────────────────────────
export class CreateInventaireDto {
  @ApiProperty()
  @IsUUID()
  siteId: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

export class CreateLigneInventaireDto {
  @ApiProperty()
  @IsUUID()
  articleId: string;

  @ApiProperty()
  @IsNumber() @Min(0)
  qteConstatee: number;

  @ApiProperty({ required: false })
  @IsOptional() @IsUUID()
  emplacementId?: string;
}

export class ValiderInventaireDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString()
  commentaire?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class InventairesService {
  constructor(
    @InjectRepository(MouvementStock)
    private readonly mouvementRepo: Repository<MouvementStock>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Créer une session d'inventaire ────────────────────────────────────────
  async create(dto: CreateInventaireDto, userId: string) {
    const result = await this.dataSource.query(`
      INSERT INTO inventaires (site_id, statut, date_inventaire, created_by, commentaire)
      VALUES ($1, 'EN_COURS', NOW(), $2, $3)
      RETURNING *
    `, [dto.siteId, userId, dto.commentaire]);
    return result[0];
  }

  // ── Lister les inventaires ────────────────────────────────────────────────
  findAll(siteId?: string) {
    let query = `
      SELECT i.*, s.code AS site_code, s.nom AS site_nom,
             COUNT(li.id) AS nb_lignes
      FROM inventaires i
      JOIN sites s ON s.id = i.site_id
      LEFT JOIN lignes_inventaire li ON li.inventaire_id = i.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (siteId) { query += ` AND i.site_id = $1`; params.push(siteId); }
    query += ` GROUP BY i.id, s.code, s.nom ORDER BY i.date_inventaire DESC`;
    return this.dataSource.query(query, params);
  }

  // ── Ajouter une ligne d'inventaire ────────────────────────────────────────
  async addLigne(inventaireId: string, dto: CreateLigneInventaireDto, userId: string) {
    // Vérifier que l'inventaire existe et est EN_COURS
    const inv = await this.dataSource.query(
      `SELECT * FROM inventaires WHERE id = $1`, [inventaireId]
    );
    if (!inv.length) throw new NotFoundException('Inventaire introuvable');
    if (inv[0].statut !== 'EN_COURS') {
      throw new BadRequestException('Inventaire non modifiable — statut: ' + inv[0].statut);
    }

    // Récupérer stock théorique depuis mv_stock_actuel
    const stockTheo = await this.dataSource.query(`
      SELECT COALESCE(stock_actuel, 0) AS qte_theorique
      FROM mv_stock_actuel
      WHERE article_id = $1 AND site_id = (SELECT site_id FROM inventaires WHERE id = $2)
    `, [dto.articleId, inventaireId]);

    const qteTheorique = parseFloat(stockTheo[0]?.qte_theorique || '0');
    const ecart = dto.qteConstatee - qteTheorique;
    const ecartPct = qteTheorique > 0 ? Math.abs(ecart / qteTheorique) * 100 : 0;

    // RG10 : écart > 5% → VALIDATION_REQUISE
    const statutLigne = ecartPct > 5 ? 'VALIDATION_REQUISE' : 'OK';

    const result = await this.dataSource.query(`
      INSERT INTO lignes_inventaire
        (inventaire_id, article_id, qte_constatee, qte_theorique, ecart, ecart_pct, statut_ligne, emplacement_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (inventaire_id, article_id) DO UPDATE SET
        qte_constatee = EXCLUDED.qte_constatee,
        ecart = EXCLUDED.ecart,
        ecart_pct = EXCLUDED.ecart_pct,
        statut_ligne = EXCLUDED.statut_ligne
      RETURNING *
    `, [inventaireId, dto.articleId, dto.qteConstatee, qteTheorique, ecart, ecartPct, statutLigne, dto.emplacementId]);

    return result[0];
  }

  // ── Écarts d'un inventaire ────────────────────────────────────────────────
  async getEcarts(inventaireId: string) {
    return this.dataSource.query(`
      SELECT
        li.*,
        a.reference,
        a.designation,
        a.unite_mesure,
        a.prix_achat_std,
        ABS(li.ecart) * a.prix_achat_std AS valeur_ecart
      FROM lignes_inventaire li
      JOIN articles a ON a.id = li.article_id
      WHERE li.inventaire_id = $1
      ORDER BY ABS(li.ecart) DESC
    `, [inventaireId]);
  }

  // ── Valider un inventaire — crée les ajustements de stock ─────────────────
  async valider(inventaireId: string, dto: ValiderInventaireDto, userId: string) {
    const inv = await this.dataSource.query(
      `SELECT * FROM inventaires WHERE id = $1`, [inventaireId]
    );
    if (!inv.length) throw new NotFoundException('Inventaire introuvable');
    if (inv[0].statut !== 'EN_COURS') {
      throw new BadRequestException('Inventaire déjà validé ou annulé');
    }

    // Vérifier qu'il n'y a pas de lignes VALIDATION_REQUISE non approuvées
    const lignesBloquees = await this.dataSource.query(`
      SELECT COUNT(*) AS nb FROM lignes_inventaire
      WHERE inventaire_id = $1 AND statut_ligne = 'VALIDATION_REQUISE'
    `, [inventaireId]);

    if (parseInt(lignesBloquees[0].nb) > 0) {
      throw new BadRequestException(
        `RG10 : ${lignesBloquees[0].nb} ligne(s) avec écart > 5% nécessitent une approbation`
      );
    }

    // Créer les mouvements d'ajustement pour chaque écart
    const lignes = await this.dataSource.query(`
      SELECT li.*, s.id AS site_id
      FROM lignes_inventaire li
      JOIN inventaires i ON i.id = li.inventaire_id
      JOIN sites s ON s.id = i.site_id
      WHERE li.inventaire_id = $1 AND li.ecart != 0
    `, [inventaireId]);

    for (const ligne of lignes) {
      const typeMouvement = ligne.ecart > 0
        ? MouvementType.ENTREE_AJUSTEMENT
        : MouvementType.SORTIE_AJUSTEMENT;

      await this.mouvementRepo.save(this.mouvementRepo.create({
        articleId: ligne.article_id,
        siteId: ligne.site_id,
        typeMouvement,
        quantite: Math.abs(ligne.ecart),
        sens: ligne.ecart > 0 ? 1 : -1,
        origineType: 'INVENTAIRE',
        origineId: inventaireId,
        commentaire: `Ajustement inventaire ${inventaireId}`,
        createdBy: userId,
      }));
    }

    // Clôturer l'inventaire
    await this.dataSource.query(`
      UPDATE inventaires
      SET statut = 'VALIDE', valide_par = $2, date_validation = NOW(), commentaire_validation = $3
      WHERE id = $1
    `, [inventaireId, userId, dto.commentaire]);

    return { message: `Inventaire validé — ${lignes.length} ajustements créés` };
  }

  // ── Approuver une ligne VALIDATION_REQUISE ────────────────────────────────
  async approuverLigne(ligneId: string, userId: string) {
    await this.dataSource.query(`
      UPDATE lignes_inventaire
      SET statut_ligne = 'APPROUVE', approuve_par = $2
      WHERE id = $1
    `, [ligneId, userId]);
    return { message: 'Ligne approuvée' };
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('inventaires')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('inventaires')
export class InventairesController {
  constructor(private readonly service: InventairesService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les inventaires' })
  findAll() {
    return this.service.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GEST_STOCK)
  @ApiOperation({ summary: 'Créer une session d\'inventaire' })
  create(@Body() dto: CreateInventaireDto, @CurrentUser() user: JwtUser) {
    return this.service.create(dto, user.id);
  }

  @Get(':id/ecarts')
  @ApiOperation({ summary: 'Écarts d\'un inventaire triés par valeur absolue — RG10' })
  getEcarts(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getEcarts(id);
  }

  @Post(':id/lignes')
  @Roles(UserRole.ADMIN, UserRole.GEST_STOCK)
  @ApiOperation({ summary: 'Saisir une quantité constatée pour un article' })
  addLigne(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLigneInventaireDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.addLigne(id, dto, user.id);
  }

  @Put(':id/valider')
  @Roles(UserRole.ADMIN, UserRole.GEST_STOCK)
  @ApiOperation({ summary: 'Valider l\'inventaire et créer les ajustements de stock — RG10' })
  valider(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ValiderInventaireDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.valider(id, dto, user.id);
  }

  @Put('lignes/:ligneId/approuver')
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Approuver une ligne avec écart > 5% (RG10)' })
  approuverLigne(
    @Param('ligneId', ParseUUIDPipe) ligneId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.approuverLigne(ligneId, user.id);
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  imports: [TypeOrmModule.forFeature([MouvementStock])],
  controllers: [InventairesController],
  providers: [InventairesService],
  exports: [InventairesService],
})
export class InventairesModule {}
