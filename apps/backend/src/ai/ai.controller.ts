import { Controller, Post, Body, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Tables autorisées en lecture
const READ_TABLES = [
  'mv_stock_actuel','articles','lots','mouvements_stock','familles_articles',
  'fournisseurs','fournisseur_contacts','catalogue_fournisseur',
  'clients','postes_charge','demandes_achat','commandes_achat',
  'lignes_commande_achat','receptions','lignes_reception',
  'nomenclatures','gammes','operations_gamme','ordres_fabrication',
  'declarations_production','consommations_mp','plans_controle',
  'criteres_controle','controles_reception','mesures_controle',
  'non_conformites','commandes_clients','lignes_commande_client',
  'bons_livraison','lignes_bl','inventaires','lignes_inventaire',
  'utilisateurs',
];

// Validation SQL injection basique
function validateSql(sql: string): boolean {
  const forbidden = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXEC|EXECUTE)\b/i;
  return !forbidden.test(sql);
}

@Controller('ai')
export class AiController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  // ── Endpoint alertes proactives ─────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Get('alertes')
  async getAlertes() {
    const alertes = [];

    // Ruptures de stock
    const ruptures = await this.dataSource.query(`
      SELECT reference, designation, ROUND(stock_disponible::numeric,2) as dispo,
             ROUND(stock_mini::numeric,2) as mini, unite_mesure
      FROM mv_stock_actuel WHERE stock_disponible <= 0
    `);
    for (const r of ruptures) {
      alertes.push({
        type: 'RUPTURE', severity: 'critical',
        message: `🚨 RUPTURE : ${r.reference} — ${r.designation} (stock: ${r.dispo} ${r.unite_mesure}, mini: ${r.mini})`,
        action: `Créer une demande d'achat pour ${r.reference}`,
      });
    }

    // Stocks critiques
    const critiques = await this.dataSource.query(`
      SELECT reference, designation, ROUND(stock_disponible::numeric,2) as dispo,
             ROUND(stock_mini::numeric,2) as mini, unite_mesure
      FROM mv_stock_actuel WHERE stock_disponible > 0 AND stock_disponible <= stock_mini
    `);
    for (const c of critiques) {
      alertes.push({
        type: 'CRITIQUE', severity: 'warning',
        message: `⚠️ Stock critique : ${c.reference} — ${c.dispo}/${c.mini} ${c.unite_mesure}`,
        action: `Réapprovisionner ${c.reference} rapidement`,
      });
    }

    // DLUO dans 30 jours
    const dluo = await this.dataSource.query(`
      SELECT l.numero, a.reference, a.designation, l.date_dluo,
             (l.date_dluo - CURRENT_DATE) as jours_restants
      FROM lots l JOIN articles a ON a.id = l.article_id
      WHERE l.statut = 'DISPONIBLE' AND l.date_dluo IS NOT NULL
        AND l.date_dluo <= CURRENT_DATE + INTERVAL '30 days'
        AND l.date_dluo >= CURRENT_DATE
      ORDER BY l.date_dluo
    `);
    for (const d of dluo) {
      alertes.push({
        type: 'DLUO', severity: d.jours_restants <= 7 ? 'critical' : 'warning',
        message: `📅 DLUO dans ${d.jours_restants}j : lot ${d.numero} — ${d.reference} (${d.date_dluo?.toString()?.slice(0,10)})`,
        action: `Utiliser ou rebuter le lot ${d.numero}`,
      });
    }

    // NC ouvertes critiques
    const ncs = await this.dataSource.query(`
      SELECT nc.reference, nc.severite, nc.description, a.reference as article
      FROM non_conformites nc LEFT JOIN articles a ON a.id = nc.article_id
      WHERE nc.statut NOT IN ('CLOTUREE') AND nc.severite IN ('CRITIQUE','MAJEURE')
      ORDER BY nc.created_at
    `);
    for (const n of ncs) {
      alertes.push({
        type: 'NC', severity: n.severite === 'CRITIQUE' ? 'critical' : 'warning',
        message: `🔴 NC ${n.severite} ouverte : ${n.reference} — ${n.article} — ${n.description?.substring(0,60)}`,
        action: 'Traiter la non-conformité en urgence',
      });
    }

    // OF en retard
    const ofs = await this.dataSource.query(`
      SELECT of2.reference, a.reference as article, of2.date_fin_prevue,
             (CURRENT_DATE - of2.date_fin_prevue) as jours_retard
      FROM ordres_fabrication of2 JOIN articles a ON a.id = of2.article_id
      WHERE of2.statut IN ('LANCE','EN_COURS') AND of2.date_fin_prevue < CURRENT_DATE
    `);
    for (const o of ofs) {
      alertes.push({
        type: 'RETARD_OF', severity: 'warning',
        message: `🏭 OF en retard : ${o.reference} — ${o.article} (${o.jours_retard}j de retard)`,
        action: `Relancer ou replanifier l'OF ${o.reference}`,
      });
    }

    return { alertes, total: alertes.length, timestamp: new Date() };
  }

  // ── Endpoint chat principal ─────────────────────────────────
  @UseGuards(AuthGuard('jwt'))
  @Post('chat')
  async chat(@Body() body: {
    messages: any[];
    system: string;
    module?: string;
    memory?: string;
  }) {
    const tools = [
      {
        name: 'query_database',
        description: `Exécute une requête SQL SELECT en lecture seule sur la base Supply Chain.
Tables disponibles: ${READ_TABLES.join(', ')}.
Utilise cet outil pour TOUTE question sur des données réelles.
Exemples: stock actuel, articles, commandes, OF, NC, clients, fournisseurs, KPIs, etc.`,
        input_schema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'Requête SQL SELECT valide. Utilise des JOINs pour enrichir les données. Pas de sous-requêtes complexes. Limite à 100 lignes avec LIMIT.',
            },
            description: {
              type: 'string',
              description: 'Ce que tu cherches à obtenir avec cette requête',
            },
          },
          required: ['sql', 'description'],
        },
      },
      {
        name: 'create_demande_achat',
        description: 'Crée une demande d\'achat automatiquement quand l\'utilisateur le demande ou quand un article est en rupture/critique.',
        input_schema: {
          type: 'object',
          properties: {
            article_reference: { type: 'string', description: 'Référence de l\'article (ex: MP-ACIER-001)' },
            quantite: { type: 'number', description: 'Quantité à commander' },
            justification: { type: 'string', description: 'Raison de la demande' },
            origine: { type: 'string', enum: ['MANUELLE', 'ALERTE_STOCK', 'MRP'], description: 'Origine de la demande' },
          },
          required: ['article_reference', 'quantite', 'justification', 'origine'],
        },
      },
      {
        name: 'generate_report',
        description: 'Génère un fichier Excel ou Word téléchargeable avec les données réelles de la base. Utilise cet outil quand l\'utilisateur demande un rapport, un fichier Excel, un document Word, ou un export.',
        input_schema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['excel', 'word'], description: 'Format du fichier : excel pour .xlsx, word pour .doc' },
            type: { type: 'string', enum: ['dashboard'], description: 'Type de rapport (dashboard = rapport complet)' },
          },
          required: ['format'],
        },
      },
      { name: 'create_ordre_fabrication',
        description: 'Crée un ordre de fabrication quand l\'utilisateur le demande.',
        input_schema: {
          type: 'object',
          properties: {
            article_reference: { type: 'string', description: 'Référence de l\'article à fabriquer (PF ou SF)' },
            quantite: { type: 'number', description: 'Quantité à produire' },
            date_debut: { type: 'string', description: 'Date de début prévue (YYYY-MM-DD)' },
            date_fin: { type: 'string', description: 'Date de fin prévue (YYYY-MM-DD)' },
          },
          required: ['article_reference', 'quantite'],
        },
      },
    ];

    const memoryContext = body.memory ? `\n\n=== MÉMOIRE DES CONVERSATIONS PRÉCÉDENTES ===\n${body.memory}\n===` : '';

    const systemPrompt = `${body.system}${memoryContext}

Tu es un agent IA expert en supply chain industrielle avec accès complet à la base de données.

RÈGLES ABSOLUES:
1. Pour TOUTE question sur des données, utilise TOUJOURS l'outil query_database avec du SQL précis
2. Ne dis JAMAIS que tu n'as pas accès aux données
3. Si l'utilisateur veut créer une DA ou un OF, utilise les outils correspondants
4. Réponds en français, sois précis et actionnable
5. Cite toujours les chiffres exacts issus de la base
6. Si tu crées quelque chose (DA, OF), confirme ce qui a été créé`;

    let apiMessages = body.messages
      .filter((m: any) => typeof m.content === 'string')
      .map((m: any) => ({ role: m.role, content: m.content }));

    let finalResponse = '';
    const actions: any[] = [];

    for (let i = 0; i < 8; i++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5',
          max_tokens: 2000,
          system: systemPrompt,
          tools,
          tool_choice: i === 0 ? { type: 'any' } : { type: 'auto' },
          messages: apiMessages,
        }),
      });

      if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
      const data = await res.json() as any;

      if (data.stop_reason === 'tool_use') {
        const toolUses = data.content.filter((b: any) => b.type === 'tool_use');

        const toolResults = await Promise.all(toolUses.map(async (toolUse: any) => {
          let result: any;

          if (toolUse.name === 'query_database') {
            const sql = toolUse.input.sql as string;
            if (!validateSql(sql)) {
              result = { error: 'Requête non autorisée — lecture seule uniquement' };
            } else {
              try {
                const rows = await this.dataSource.query(
                  sql.includes('LIMIT') ? sql : sql + ' LIMIT 100'
                );
                result = rows;
              } catch (e: any) {
                result = { error: e.message };
              }
            }
          }

          else if (toolUse.name === 'create_demande_achat') {
            try {
              const { article_reference, quantite, justification, origine } = toolUse.input;
              const article = await this.dataSource.query(
                `SELECT id, reference FROM articles WHERE reference = $1 AND actif = true LIMIT 1`,
                [article_reference]
              );
              if (!article.length) {
                result = { error: `Article ${article_reference} non trouvé` };
              } else {
                const site = await this.dataSource.query(
                  `SELECT id FROM sites LIMIT 1`
                );
                const count = await this.dataSource.query(
                  `SELECT COUNT(*) as nb FROM demandes_achat`
                );
                const ref = `DA-AI-${String(parseInt(count[0].nb) + 1).padStart(3, '0')}`;
                const admin = await this.dataSource.query(
                  `SELECT id FROM utilisateurs WHERE role = 'ADMIN' LIMIT 1`
                );
                await this.dataSource.query(
                  `INSERT INTO demandes_achat (id, reference, article_id, site_id, quantite, statut, origine, justification, created_by)
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, 'EN_ATTENTE', $5, $6, $7)`,
                  [ref, article[0].id, site[0].id, quantite, origine, justification, admin[0].id]
                );
                result = { success: true, reference: ref, article: article_reference, quantite };
                actions.push({ type: 'DA_CREATED', data: result });
              }
            } catch (e: any) {
              result = { error: e.message };
            }
          }

          else if (toolUse.name === 'generate_report') {
            const { format, type } = toolUse.input;
            const downloadUrl = `/api/v1/ai/report/${format}?type=${type || 'dashboard'}`;
            result = { success: true, downloadUrl, format, message: `Rapport ${format.toUpperCase()} prêt à télécharger` };
            actions.push({ type: 'REPORT_GENERATED', data: { downloadUrl, format } });
          }

          else if (toolUse.name === 'create_ordre_fabrication') {
            try {
              const { article_reference, quantite, date_debut, date_fin } = toolUse.input;
              const article = await this.dataSource.query(
                `SELECT id, reference FROM articles WHERE reference = $1 AND type IN ('PF','SF') LIMIT 1`,
                [article_reference]
              );
              if (!article.length) {
                result = { error: `Article PF/SF ${article_reference} non trouvé` };
              } else {
                const site = await this.dataSource.query(`SELECT id FROM sites LIMIT 1`);
                const admin = await this.dataSource.query(`SELECT id FROM utilisateurs WHERE role='ADMIN' LIMIT 1`);
                const count = await this.dataSource.query(`SELECT COUNT(*) as nb FROM ordres_fabrication`);
                const ref = `OF-AI-${String(parseInt(count[0].nb) + 1).padStart(3, '0')}`;
                await this.dataSource.query(
                  `INSERT INTO ordres_fabrication (id, reference, article_id, site_id, quantite_prevue, statut, date_debut_prevue, date_fin_prevue, created_by)
                   VALUES (gen_random_uuid(), $1, $2, $3, $4, 'PLANIFIE', $5, $6, $7)`,
                  [ref, article[0].id, site[0].id, quantite,
                   date_debut || new Date().toISOString().slice(0,10),
                   date_fin || new Date(Date.now() + 7*86400000).toISOString().slice(0,10),
                   admin[0].id]
                );
                result = { success: true, reference: ref, article: article_reference, quantite };
                actions.push({ type: 'OF_CREATED', data: result });
              }
            } catch (e: any) {
              result = { error: e.message };
            }
          }

          return {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(result),
          };
        }));

        apiMessages = [
          ...apiMessages,
          { role: 'assistant', content: data.content },
          { role: 'user', content: toolResults },
        ];
        continue;
      }

      finalResponse = data.content
        .filter((b: any) => b.type === 'text')
        .map((b: any) => b.text)
        .join('\n');
      break;
    }

    return {
      content: finalResponse || 'Désolé, je n\'ai pas pu générer une réponse.',
      actions,
    };
  }
}
