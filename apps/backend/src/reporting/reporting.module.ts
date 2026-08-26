import {
  Controller, Get, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Module } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard } from '../auth/guards/auth.guard';
import { Roles, CurrentUser, JwtUser } from '../auth/decorators/auth.decorators';
import { UserRole } from '../database/entities/enums';

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable()
export class ReportingService {
  constructor(private readonly dataSource: DataSource) {}

  // ── US-080 : Dashboard Directeur — 7 KPIs ─────────────────────────────────
  async getKpisDirecteur() {
    const [stock, service, rebut, of, nc, rupture, sousMini] = await Promise.all([
      // Valeur totale stock
      this.dataSource.query(`
        SELECT COALESCE(SUM(valeur_stock), 0) AS valeur_totale
        FROM mv_stock_actuel
      `),
      // Taux de service client (livraisons à temps ce mois)
      this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (
            WHERE bl.date_livraison <= cc.date_livraison_prev
            AND bl.statut = 'LIVRE'
          )::float / NULLIF(COUNT(*) FILTER (WHERE bl.statut = 'LIVRE'), 0) * 100 AS taux_service
        FROM bons_livraison bl
        JOIN commandes_clients cc ON cc.id = bl.commande_id
        WHERE bl.date_livraison >= date_trunc('month', NOW())
      `),
      // Taux de rebut production
      this.dataSource.query(`
        SELECT
          COALESCE(SUM(quantite_rebut), 0)::float /
          NULLIF(SUM(quantite_produite + quantite_rebut), 0) * 100 AS taux_rebut
        FROM ordres_fabrication
        WHERE statut IN ('TERMINE', 'CLOS')
          AND date_fin_reelle >= date_trunc('month', NOW())
      `),
      // OF terminés vs planifiés ce mois
      this.dataSource.query(`
        SELECT
          COUNT(*) FILTER (WHERE statut IN ('TERMINE', 'CLOS')) AS termines,
          COUNT(*) AS planifies
        FROM ordres_fabrication
        WHERE date_debut_prevue >= date_trunc('month', NOW())
      `),
      // NC ouvertes
      this.dataSource.query(`
        SELECT COUNT(*) AS nb_nc_ouvertes
        FROM non_conformites
        WHERE statut NOT IN ('CLOTUREE')
      `),
      // Articles en rupture
      this.dataSource.query(`
        SELECT COUNT(*) AS nb_rupture
        FROM mv_stock_actuel
        WHERE stock_disponible <= 0
      `),
      // Articles sous stock mini
      this.dataSource.query(`
        SELECT COUNT(*) AS nb_sous_mini
        FROM mv_stock_actuel
        WHERE stock_disponible <= stock_mini AND stock_disponible > 0
      `),
    ]);

    return {
      periode: new Date().toISOString().slice(0, 7),
      valeurTotaleStock: parseFloat(stock[0]?.valeur_totale || '0'),
      tauxServiceClient: Math.round(parseFloat(service[0]?.taux_service || '0') * 100) / 100,
      tauxRebutProduction: Math.round(parseFloat(rebut[0]?.taux_rebut || '0') * 100) / 100,
      ofTermines: parseInt(of[0]?.termines || '0'),
      ofPlanifies: parseInt(of[0]?.planifies || '0'),
      ratioOf: of[0]?.planifies > 0
        ? Math.round(of[0].termines / of[0].planifies * 100)
        : 0,
      nbNcOuvertes: parseInt(nc[0]?.nb_nc_ouvertes || '0'),
      nbArticlesRupture: parseInt(rupture[0]?.nb_rupture || '0'),
      nbArticlesSousMini: parseInt(sousMini[0]?.nb_sous_mini || '0'),
    };
  }

  // ── US-081 : TRS par poste de charge ─────────────────────────────────────
  async getTrs(periodeJours = 30) {
    return this.dataSource.query(`
      SELECT
        p.id AS poste_id,
        p.code,
        p.libelle,
        p.capacite_h_jour,
        p.taux_rendement AS taux_cible,
        -- Temps disponible total en minutes
        p.capacite_h_jour * 60 * $1 AS temps_disponible_min,
        -- Temps utile réel (déclarations)
        COALESCE(SUM(d.temps_production), 0) AS temps_utile_min,
        -- TRS
        ROUND(
          COALESCE(SUM(d.temps_production), 0) /
          NULLIF(p.capacite_h_jour * 60 * $1, 0) * 100
        , 2) AS trs_pct,
        -- Taux rebut
        COALESCE(SUM(d.quantite_rebut), 0) AS total_rebut,
        COALESCE(SUM(d.quantite_produite), 0) AS total_produit,
        ROUND(
          COALESCE(SUM(d.quantite_rebut), 0) /
          NULLIF(SUM(d.quantite_produite + d.quantite_rebut), 0) * 100
        , 2) AS taux_rebut_pct
      FROM postes_charge p
      LEFT JOIN operations_gamme og ON og.poste_charge_id = p.id
      LEFT JOIN declarations_production d ON d.operation_id = og.id
        AND d.date_declaration >= NOW() - ($1 || ' days')::INTERVAL
      WHERE p.actif = true
      GROUP BY p.id, p.code, p.libelle, p.capacite_h_jour, p.taux_rendement
      ORDER BY trs_pct ASC NULLS LAST
    `, [periodeJours]);
  }

  // ── US-083 : Écarts de consommation MP ───────────────────────────────────
  async getEcartsConsommation() {
    return this.dataSource.query(`
      SELECT
        of.reference AS of_reference,
        of.id AS of_id,
        a_pf.reference AS pf_reference,
        a_pf.designation AS pf_designation,
        of.quantite_prevue,
        SUM(c.qte_theorique) AS qte_mp_theorique,
        SUM(c.qte_reelle) AS qte_mp_reelle,
        SUM(c.ecart_qte) AS ecart_qte_total,
        ROUND(SUM(c.ecart_qte) / NULLIF(SUM(c.qte_theorique), 0) * 100, 2) AS ecart_pct,
        ROUND(SUM(c.ecart_qte * a_mp.prix_achat_std), 2) AS ecart_valeur_eur
      FROM ordres_fabrication of
      JOIN consommations_mp c ON c.of_id = of.id
      JOIN articles a_pf ON a_pf.id = of.article_id
      JOIN articles a_mp ON a_mp.id = c.article_id
      WHERE of.statut = 'CLOS'
        AND of.date_fin_reelle >= date_trunc('month', NOW())
        AND ABS(c.ecart_qte) > 0.001
      GROUP BY of.reference, of.id, a_pf.reference, a_pf.designation, of.quantite_prevue
      HAVING ABS(SUM(c.ecart_qte * a_mp.prix_achat_std)) > 0
      ORDER BY ABS(SUM(c.ecart_qte * a_mp.prix_achat_std)) DESC
    `);
  }

  // ── US-082 : Traçabilité lot (déjà dans MouvementsService, doublon reporting) ─
  async getTracabiliteLot(numero: string) {
    return this.dataSource.query(`
      WITH RECURSIVE tracabilite AS (
        SELECT
          l.id, l.numero, a.reference, a.designation, 0 AS profondeur
        FROM lots l JOIN articles a ON a.id = l.article_id
        WHERE l.numero = $1

        UNION ALL

        SELECT l2.id, l2.numero, a2.reference, a2.designation, t.profondeur + 1
        FROM lots l2
        JOIN articles a2 ON a2.id = l2.article_id
        JOIN consommations_mp c ON c.lot_id = l2.id
        JOIN ordres_fabrication of ON of.id = c.of_id
        JOIN lots l3 ON l3.id = of.lot_pf_id
        JOIN tracabilite t ON t.id = l3.id
        WHERE t.profondeur < 5
      )
      SELECT DISTINCT profondeur, numero AS lot_numero, reference, designation
      FROM tracabilite
      ORDER BY profondeur, numero
    `, [numero]);
  }

  // ── US-084 : Audit trail ───────────────────────────────────────────────────
  async getAuditLog(filters: {
    tableName?: string;
    recordId?: string;
    from?: string;
    to?: string;
    page?: number;
  }) {
    const { tableName, recordId, from, to, page = 1 } = filters;
    let query = `
      SELECT id, table_name, record_id, action,
             old_values, new_values, changed_by, changed_at
      FROM audit_log WHERE 1=1
    `;
    const params: any[] = [];
    let i = 1;

    if (tableName) { query += ` AND table_name = $${i++}`; params.push(tableName); }
    if (recordId)  { query += ` AND record_id = $${i++}`; params.push(recordId); }
    if (from)      { query += ` AND changed_at >= $${i++}`; params.push(from); }
    if (to)        { query += ` AND changed_at <= $${i++}`; params.push(to); }

    query += ` ORDER BY changed_at DESC LIMIT 50 OFFSET $${i++}`;
    params.push((page - 1) * 50);

    return this.dataSource.query(query, params);
  }

  // Score classement fournisseurs
  async getClassementFournisseurs() {
    return this.dataSource.query(`
      SELECT
        f.id, f.code, f.raison_sociale,
        f.score_qualite,
        CASE
          WHEN f.score_qualite >= 90 THEN 'PREFERE'
          WHEN f.score_qualite >= 70 THEN 'STANDARD'
          WHEN f.score_qualite >= 50 THEN 'SURVEILLANCE'
          ELSE 'BLOQUE'
        END AS niveau,
        f.statut
      FROM fournisseurs f
      WHERE f.actif = true
      ORDER BY f.score_qualite DESC
    `);
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
@ApiTags('reporting')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reporting')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('kpis-directeur')
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR, UserRole.RESP_PROD, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Dashboard Directeur — 7 KPIs temps réel — US-080' })
  getKpis() {
    return this.service.getKpisDirecteur();
  }

  @Get('trs')
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'TRS par poste de charge — US-081' })
  @ApiQuery({ name: 'periode', required: false, type: Number, description: 'Période en jours (défaut 30)' })
  getTrs(@Query('periode') periode?: number) {
    return this.service.getTrs(periode ? Number(periode) : 30);
  }

  @Get('ecarts-consommation')
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR, UserRole.RESP_PROD)
  @ApiOperation({ summary: 'Écarts consommation MP du mois — US-083' })
  getEcarts() {
    return this.service.getEcartsConsommation();
  }

  @Get('tracabilite/:numero')
  @ApiOperation({ summary: 'Traçabilité ascendante d\'un lot — US-082' })
  getTracabilite(@Query('numero') numero: string) {
    return this.service.getTracabiliteLot(numero);
  }

  @Get('fournisseurs/classement')
  @Roles(UserRole.ADMIN, UserRole.DIRECTEUR, UserRole.RESP_ACHATS)
  @ApiOperation({ summary: 'Classement fournisseurs par score qualité — US-044' })
  getClassementFournisseurs() {
    return this.service.getClassementFournisseurs();
  }

  @Get('audit-log')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Journal d\'audit immuable — US-084 (ADMIN uniquement)' })
  @ApiQuery({ name: 'tableName', required: false })
  @ApiQuery({ name: 'recordId', required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  getAuditLog(
    @Query('tableName') tableName?: string,
    @Query('recordId') recordId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
  ) {
    return this.service.getAuditLog({ tableName, recordId, from, to, page });
  }
}

// ── Module ────────────────────────────────────────────────────────────────────
@Module({
  controllers: [ReportingController],
  providers: [ReportingService],
  exports: [ReportingService],
})
export class ReportingModule {}
