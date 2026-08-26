import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async getLiveKpis() {
    const [stock, production, qualite, achats, expeditions] = await Promise.all([
      this.db.query(`
        SELECT
          ROUND(COALESCE(SUM(valeur_stock),0)::numeric,2) as valeur_totale,
          COUNT(*) FILTER (WHERE stock_disponible <= 0) as ruptures,
          COUNT(*) FILTER (WHERE stock_disponible > 0 AND stock_disponible <= stock_mini) as critiques,
          COUNT(*) as total_articles
        FROM mv_stock_actuel
      `).catch(() => [{ valeur_totale: 0, ruptures: 0, critiques: 0, total_articles: 0 }]),

      this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE statut IN ('LANCE','EN_COURS')) as en_cours,
          COUNT(*) FILTER (WHERE statut='CLOS') as clos,
          COUNT(*) FILTER (WHERE statut='PLANIFIE') as planifies,
          ROUND(COALESCE(AVG(
            CASE WHEN quantite_prevue > 0
            THEN (quantite_produite::float / quantite_prevue) * 100 END
          ),0)::numeric,1) as avancement_moyen
        FROM ordres_fabrication
      `).catch(() => [{ en_cours: 0, clos: 0, planifies: 0, avancement_moyen: 0 }]),

      this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE statut NOT IN ('CLOTUREE')) as nc_ouvertes,
          COUNT(*) FILTER (WHERE severite='CRITIQUE' AND statut NOT IN ('CLOTUREE')) as nc_critiques,
          COUNT(*) FILTER (WHERE severite='MAJEURE' AND statut NOT IN ('CLOTUREE')) as nc_majeures
        FROM non_conformites
      `).catch(() => [{ nc_ouvertes: 0, nc_critiques: 0, nc_majeures: 0 }]),

      this.db.query(`
        SELECT COUNT(*) FILTER (WHERE statut='EN_ATTENTE') as da_attente
        FROM demandes_achat
      `).catch(() => [{ da_attente: 0 }]),

      this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE statut='EN_PREPARATION') as en_preparation,
          COUNT(*) FILTER (WHERE statut='EXPEDIEE') as expediees
        FROM commandes_clients
      `).catch(() => [{ en_preparation: 0, expediees: 0 }]),
    ]);

    return {
      stock: stock[0],
      production: production[0],
      qualite: qualite[0],
      achats: achats[0],
      expeditions: expeditions[0],
      timestamp: new Date(),
    };
  }

  async getStockChart() {
    return this.db.query(`
      SELECT reference, designation, unite_mesure,
        ROUND(stock_disponible::numeric,2) as disponible,
        ROUND(stock_mini::numeric,2) as mini,
        ROUND(stock_actuel::numeric,2) as total,
        CASE
          WHEN stock_disponible <= 0 THEN 'RUPTURE'
          WHEN stock_disponible <= stock_mini THEN 'CRITIQUE'
          WHEN stock_disponible <= stock_mini * 1.5 THEN 'ALERTE'
          ELSE 'OK'
        END as statut
      FROM mv_stock_actuel
      ORDER BY stock_disponible / NULLIF(stock_mini, 0) ASC
      LIMIT 12
    `).catch(() => []);
  }

  async getProductionChart() {
    return this.db.query(`
      SELECT of2.reference, a.reference as article,
        of2.statut, of2.quantite_prevue, of2.quantite_produite, of2.quantite_rebut,
        CASE WHEN of2.quantite_prevue > 0
          THEN ROUND((of2.quantite_produite::float / of2.quantite_prevue * 100)::numeric, 1)
          ELSE 0 END as avancement
      FROM ordres_fabrication of2
      JOIN articles a ON a.id = of2.article_id
      WHERE of2.statut IN ('LANCE','EN_COURS','PLANIFIE','CLOS')
      ORDER BY of2.date_debut_prevue DESC LIMIT 8
    `).catch(() => []);
  }

  async getQualiteChart() {
    const [parType, parSeverite, evolution] = await Promise.all([
      this.db.query(`
        SELECT type_detection, COUNT(*) as nb
        FROM non_conformites GROUP BY type_detection ORDER BY nb DESC
      `).catch(() => []),
      this.db.query(`
        SELECT severite, COUNT(*) as nb
        FROM non_conformites GROUP BY severite ORDER BY nb DESC
      `).catch(() => []),
      this.db.query(`
        SELECT DATE_TRUNC('month', created_at)::date as mois, COUNT(*) as nb_nc
        FROM non_conformites
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY mois
      `).catch(() => []),
    ]);
    return { parType, parSeverite, evolution };
  }

  async getPredictions() {
    const [stockTrend, ofRisques] = await Promise.all([
      this.db.query(`
        SELECT a.reference, a.designation, a.unite_mesure,
          ms.stock_disponible as stock_actuel,
          ms.stock_mini,
          COALESCE(conso.conso_journaliere, 0) as conso_jour,
          CASE WHEN COALESCE(conso.conso_journaliere, 0) > 0
            THEN ROUND((ms.stock_disponible / conso.conso_journaliere)::numeric, 0)
            ELSE 999 END as jours_restants
        FROM mv_stock_actuel ms
        JOIN articles a ON a.reference = ms.reference
        LEFT JOIN (
          SELECT article_id,
            ABS(SUM(quantite * sens)) / GREATEST(COUNT(DISTINCT created_at::date), 1) as conso_journaliere
          FROM mouvements_stock
          WHERE sens = -1 AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY article_id
        ) conso ON conso.article_id = a.id
        WHERE ms.stock_disponible > 0
        ORDER BY jours_restants ASC LIMIT 8
      `).catch(() => []),
      this.db.query(`
        SELECT of2.reference, a.reference as article,
          of2.date_fin_prevue,
          (of2.date_fin_prevue - CURRENT_DATE) as jours_restants,
          ROUND((of2.quantite_produite::float / NULLIF(of2.quantite_prevue,0) * 100)::numeric,1) as avancement
        FROM ordres_fabrication of2
        JOIN articles a ON a.id = of2.article_id
        WHERE of2.statut IN ('LANCE','EN_COURS') AND of2.date_fin_prevue IS NOT NULL
        ORDER BY of2.date_fin_prevue ASC LIMIT 5
      `).catch(() => []),
    ]);
    return { stockTrend, ofRisques };
  }
}
