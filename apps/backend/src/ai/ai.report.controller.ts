import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Response } from 'express';

@Controller('ai/report')
export class AiReportController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('excel')
  async generateExcel(@Query('type') type: string, @Res() res: Response) {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      const date = new Date().toLocaleDateString('fr-FR');

      const stock = await this.db.query(`
        SELECT reference, designation, unite_mesure,
          ROUND(stock_actuel::numeric,2) as stock_total,
          ROUND(stock_disponible::numeric,2) as disponible,
          ROUND(stock_reserve::numeric,2) as reserve,
          ROUND(stock_mini::numeric,2) as stock_mini,
          ROUND(valeur_stock::numeric,2) as valeur_eur,
          CASE
            WHEN stock_disponible <= 0 THEN 'RUPTURE'
            WHEN stock_disponible <= stock_mini THEN 'CRITIQUE'
            WHEN stock_disponible <= stock_mini * 1.5 THEN 'ALERTE'
            ELSE 'OK'
          END as statut
        FROM mv_stock_actuel ORDER BY stock_disponible
      `);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(stock), 'Stock actuel');

      const ofs = await this.db.query(`
        SELECT of2.reference, a.reference as article, a.designation,
          of2.statut, of2.quantite_prevue, of2.quantite_produite, of2.quantite_rebut,
          of2.date_debut_prevue::text as date_debut, of2.date_fin_prevue::text as date_fin
        FROM ordres_fabrication of2 JOIN articles a ON a.id = of2.article_id
        ORDER BY of2.statut
      `);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ofs), 'Ordres fabrication');

      const ncs = await this.db.query(`
        SELECT nc.reference, nc.severite, nc.statut, nc.type_detection,
          a.reference as article, nc.description, nc.action_corrective
        FROM non_conformites nc LEFT JOIN articles a ON a.id = nc.article_id
        ORDER BY nc.severite
      `);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ncs), 'Non-conformites');

      const fours = await this.db.query(`
        SELECT code, raison_sociale, score_qualite, statut, delai_paiement, mode_paiement
        FROM fournisseurs ORDER BY score_qualite DESC
      `);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(fours), 'Fournisseurs');

      const cas = await this.db.query(`
        SELECT ca.reference, f.raison_sociale as fournisseur,
          ca.statut, ca.montant_ht, ca.montant_ttc,
          ca.date_livraison_prev::text as date_livraison
        FROM commandes_achat ca JOIN fournisseurs f ON f.id = ca.fournisseur_id
        ORDER BY ca.created_at DESC
      `);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(cas), 'Commandes achat');

      const das = await this.db.query(`
        SELECT da.reference, a.reference as article, a.designation,
          da.quantite, da.statut, da.origine, da.justification
        FROM demandes_achat da JOIN articles a ON a.id = da.article_id
        ORDER BY da.created_at DESC
      `);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(das), 'Demandes achat');

      const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      const filename = `SupplyChain_${date.replace(/\//g, '-')}.xlsx`;
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buf.length,
      });
      res.send(buf);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('word')
  async generateWord(@Query('type') type: string, @Res() res: Response) {
    try {
      const dateHeure = new Date().toLocaleString('fr-FR');

      const kpis = await this.db.query(`
        SELECT
          ROUND(COALESCE(SUM(valeur_stock),0)::numeric,2) as valeur_stock,
          COUNT(*) FILTER (WHERE stock_disponible <= 0) as ruptures,
          COUNT(*) FILTER (WHERE stock_disponible > 0 AND stock_disponible <= stock_mini) as critiques
        FROM mv_stock_actuel
      `);
      const k = kpis[0] || { valeur_stock: 0, ruptures: 0, critiques: 0 };

      const ofs = await this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE statut IN ('LANCE','EN_COURS')) as en_cours,
          COUNT(*) FILTER (WHERE statut='CLOS') as clos,
          COALESCE(SUM(quantite_rebut),0) as total_rebut,
          COALESCE(SUM(quantite_produite),0) as total_produit
        FROM ordres_fabrication
      `);
      const o = ofs[0] || { en_cours: 0, clos: 0, total_rebut: 0, total_produit: 0 };

      const ncs = await this.db.query(`
        SELECT
          COUNT(*) FILTER (WHERE statut NOT IN ('CLOTUREE')) as ouvertes,
          COUNT(*) FILTER (WHERE severite='CRITIQUE' AND statut NOT IN ('CLOTUREE')) as critiques_nc
        FROM non_conformites
      `);
      const n = ncs[0] || { ouvertes: 0, critiques_nc: 0 };

      const stockDetails = await this.db.query(`
        SELECT reference, designation, unite_mesure,
          ROUND(stock_disponible::numeric,2) as dispo,
          ROUND(stock_mini::numeric,2) as mini,
          CASE
            WHEN stock_disponible <= 0 THEN 'RUPTURE'
            WHEN stock_disponible <= stock_mini THEN 'CRITIQUE'
            WHEN stock_disponible <= stock_mini * 1.5 THEN 'ALERTE'
            ELSE 'OK'
          END as statut_alerte
        FROM mv_stock_actuel ORDER BY stock_disponible LIMIT 20
      `);

      const ncDetails = await this.db.query(`
        SELECT nc.reference, nc.severite, nc.statut, a.reference as article, nc.description
        FROM non_conformites nc LEFT JOIN articles a ON a.id = nc.article_id
        WHERE nc.statut NOT IN ('CLOTUREE') ORDER BY nc.severite LIMIT 10
      `);

      const totalProduit = parseFloat(o.total_produit) || 0;
      const totalRebut = parseFloat(o.total_rebut) || 0;
      const tauxRebut = (totalProduit + totalRebut) > 0
        ? ((totalRebut / (totalProduit + totalRebut)) * 100).toFixed(2)
        : '0.00';

      const getBadge = (alerte: string) => {
        if (alerte === 'RUPTURE') return 'badge-red';
        if (alerte === 'CRITIQUE' || alerte === 'ALERTE') return 'badge-orange';
        return 'badge-green';
      };

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  body{font-family:Calibri,Arial,sans-serif;margin:40px;color:#1a1a2e}
  h1{color:#0F4C81;font-size:22px;border-bottom:3px solid #0F4C81;padding-bottom:8px}
  h2{color:#1976D2;font-size:15px;margin-top:24px;background:#f0f7ff;padding:6px 12px}
  .kpi-grid{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}
  .kpi{border:2px solid #0F4C81;border-radius:8px;padding:12px 20px;min-width:130px;text-align:center}
  .kpi-value{font-size:26px;font-weight:bold;color:#0F4C81}
  .kpi-label{font-size:10px;color:#666;text-transform:uppercase}
  .kpi.danger{border-color:#dc2626}.kpi.danger .kpi-value{color:#dc2626}
  .kpi.warning{border-color:#d97706}.kpi.warning .kpi-value{color:#d97706}
  .kpi.success{border-color:#16a34a}.kpi.success .kpi-value{color:#16a34a}
  table{width:100%;border-collapse:collapse;margin:12px 0;font-size:11px}
  th{background:#0F4C81;color:white;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase}
  td{padding:5px 10px;border-bottom:1px solid #e5e7eb}
  tr:nth-child(even) td{background:#f8fafc}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:bold}
  .badge-red{background:#fee2e2;color:#dc2626}
  .badge-orange{background:#fef3c7;color:#d97706}
  .badge-green{background:#dcfce7;color:#16a34a}
  .footer{margin-top:40px;font-size:10px;color:#999;border-top:1px solid #e5e7eb;padding-top:8px}
</style></head><body>

<h1>📊 Rapport Dashboard Supply Chain</h1>
<p style="color:#666;font-size:12px">Généré le ${dateHeure}</p>

<h2>1. KPIs Principaux</h2>
<div class="kpi-grid">
  <div class="kpi ${parseFloat(k.ruptures) > 0 ? 'danger' : 'success'}">
    <div class="kpi-value">${k.ruptures}</div><div class="kpi-label">Ruptures stock</div>
  </div>
  <div class="kpi ${parseFloat(k.critiques) > 0 ? 'warning' : 'success'}">
    <div class="kpi-value">${k.critiques}</div><div class="kpi-label">Stocks critiques</div>
  </div>
  <div class="kpi">
    <div class="kpi-value">${Number(k.valeur_stock).toLocaleString('fr-FR')} €</div><div class="kpi-label">Valeur stock</div>
  </div>
  <div class="kpi ${parseFloat(n.ouvertes) > 0 ? 'warning' : 'success'}">
    <div class="kpi-value">${n.ouvertes}</div><div class="kpi-label">NC ouvertes</div>
  </div>
  <div class="kpi">
    <div class="kpi-value">${o.en_cours}</div><div class="kpi-label">OF en cours</div>
  </div>
  <div class="kpi ${parseFloat(tauxRebut) > 2 ? 'warning' : 'success'}">
    <div class="kpi-value">${tauxRebut}%</div><div class="kpi-label">Taux rebut</div>
  </div>
</div>

<h2>2. État du Stock</h2>
<table>
  <tr><th>Référence</th><th>Désignation</th><th>Disponible</th><th>Stock Mini</th><th>Unité</th><th>Statut</th></tr>
  ${stockDetails.map((s: any) => `<tr>
    <td><strong>${s.reference}</strong></td>
    <td>${s.designation}</td>
    <td><strong>${s.dispo}</strong></td>
    <td>${s.mini}</td>
    <td>${s.unite_mesure}</td>
    <td><span class="badge ${getBadge(s.statut_alerte)}">${s.statut_alerte}</span></td>
  </tr>`).join('')}
</table>

<h2>3. Non-Conformités Ouvertes</h2>
${ncDetails.length === 0
  ? '<p style="color:#16a34a">✅ Aucune non-conformité ouverte</p>'
  : `<table>
  <tr><th>Référence</th><th>Sévérité</th><th>Statut</th><th>Article</th><th>Description</th></tr>
  ${ncDetails.map((nc: any) => `<tr>
    <td><strong>${nc.reference}</strong></td>
    <td><span class="badge ${nc.severite === 'CRITIQUE' ? 'badge-red' : 'badge-orange'}">${nc.severite}</span></td>
    <td>${(nc.statut || '').replace(/_/g, ' ')}</td>
    <td>${nc.article || '—'}</td>
    <td style="font-size:10px">${(nc.description || '—').substring(0, 80)}</td>
  </tr>`).join('')}
</table>`}

<h2>4. Production</h2>
<table>
  <tr><th>Indicateur</th><th>Valeur</th></tr>
  <tr><td>OF en cours</td><td><strong>${o.en_cours}</strong></td></tr>
  <tr><td>OF clôturés</td><td><strong>${o.clos}</strong></td></tr>
  <tr><td>Total produit</td><td><strong>${Math.round(totalProduit)} pces</strong></td></tr>
  <tr><td>Total rebut</td><td><strong>${Math.round(totalRebut)} pces</strong></td></tr>
  <tr><td>Taux de rebut</td><td><strong>${tauxRebut}%</strong></td></tr>
</table>

<div class="footer">Supply Chain Industrielle · Rapport Agent IA · ${dateHeure}</div>
</body></html>`;

      const filename = `Rapport_Dashboard_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.doc`;
      res.set({
        'Content-Type': 'application/msword',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.send(html);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  }
}