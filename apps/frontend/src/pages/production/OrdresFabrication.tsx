import { useState } from 'react';
import {
  useOrdresFabrication, useOrdreFabrication, useCreateOF,
  useValiderOF, useLancerOF, useSuspendreOF, useReprendreOF,
  useCloturerOF, useDeclarer, useConsommer,
  useDisponibiliteMp, useDeclarationsOf, useConsommationsOf,
} from '../../hooks/useProduction';
import { useArticles, useSites } from '../../hooks/useReferentiels';
import { useGammes } from '../../hooks/useProduction';
import { useLots } from '../../hooks/useStock';
import { Table, Badge, Button, Modal, Select, FormField, Input, KpiCard } from '../../components/ui';

const STATUTS_OF = [
  { value: 'PLANIFIE', label: 'Planifié' },
  { value: 'VALIDE', label: 'Validé' },
  { value: 'LANCE', label: 'Lancé' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'SUSPENDU', label: 'Suspendu' },
  { value: 'TERMINE', label: 'Terminé' },
  { value: 'CLOS', label: 'Clôturé' },
  { value: 'ANNULE', label: 'Annulé' },
];

const STATUT_VARIANTS: Record<string, any> = {
  PLANIFIE: 'neutral', VALIDE: 'info', LANCE: 'accent',
  EN_COURS: 'warning', SUSPENDU: 'danger', TERMINE: 'success',
  CLOS: 'neutral', ANNULE: 'danger',
};

// Stepper OF
function OFStepper({ statut }: { statut: string }) {
  const steps = ['PLANIFIE', 'VALIDE', 'LANCE', 'EN_COURS', 'TERMINE', 'CLOS'];
  const idx = steps.indexOf(statut);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            padding: '3px 8px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600,
            background: i === idx ? 'rgba(79,195,247,0.2)' : i < idx ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.03)',
            color: i === idx ? '#4FC3F7' : i < idx ? '#4ADE80' : '#2D4A5E',
          }}>
            {s.replace('_', ' ')}
          </div>
          {i < steps.length - 1 && <span style={{ color: '#2D4A5E', fontSize: '0.7rem' }}>›</span>}
        </div>
      ))}
    </div>
  );
}

// Detail OF
function OFDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: of } = useOrdreFabrication(id);
  const { data: dispo } = useDisponibiliteMp(id);
  const { data: declarations } = useDeclarationsOf(id);
  const { data: consommations } = useConsommationsOf(id);
  const { data: articlesData } = useArticles({ limit: 200 });
  const { data: lotsData } = useLots({ statut: 'DISPONIBLE' });

  const valider = useValiderOF();
  const lancer = useLancerOF();
  const suspendre = useSuspendreOF();
  const reprendre = useReprendreOF();
  const cloturer = useCloturerOF();
  const declarer = useDeclarer(id);
  const consommer = useConsommer(id);

  const [tab, setTab] = useState<'infos' | 'mp' | 'declarations' | 'consommations'>('infos');
  const [showDeclarer, setShowDeclarer] = useState(false);
  const [showConsommer, setShowConsommer] = useState(false);
  const [showCloturer, setShowCloturer] = useState(false);
  const [declForm, setDeclForm] = useState({ operationId: '', quantiteProduite: '', quantiteRebut: '0', tempsProduction: '0' });
  const [consoForm, setConsoForm] = useState({ articleId: '', lotId: '', qteReelle: '' });
  const [cloForm, setCloForm] = useState({ quantiteProduiteFinale: '', quantiteRebutFinale: '0', commentaire: '' });

  if (!of) return null;

  const articleOptions = (articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation}` }));
  const lotOptions = (lotsData?.data || []).map((l: any) => ({ value: l.id, label: `${l.numero} — ${l.article?.reference}` }));
  const opOptions = (of.gamme?.operations || []).map((op: any) => ({ value: op.id, label: `OP${op.numeroOp} — ${op.libelle}` }));

  const canDeclarer = ['LANCE', 'EN_COURS'].includes(of.statut);
  const canCloturer = ['EN_COURS', 'LANCE', 'TERMINE'].includes(of.statut);

  return (
    <Modal title={`OF ${of.reference}`} onClose={onClose} width="820px">
      <OFStepper statut={of.statut} />

      {/* Actions workflow */}
      <div style={{ display: 'flex', gap: '8px', margin: '16px 0', flexWrap: 'wrap' }}>
        {of.statut === 'PLANIFIE' && <Button size="sm" onClick={() => valider.mutateAsync(id)}>✓ Valider</Button>}
        {of.statut === 'VALIDE' && <Button size="sm" onClick={() => lancer.mutateAsync(id)}>🚀 Lancer</Button>}
        {['LANCE', 'EN_COURS'].includes(of.statut) && (
          <>
            <Button size="sm" variant="secondary" onClick={() => setShowDeclarer(true)}>📋 Déclarer</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowConsommer(true)}>📦 Consommer MP</Button>
            <Button size="sm" variant="danger" onClick={() => suspendre.mutateAsync({ id, motif: 'Suspension manuelle' })}>⏸ Suspendre</Button>
          </>
        )}
        {of.statut === 'SUSPENDU' && <Button size="sm" onClick={() => reprendre.mutateAsync(id)}>▶ Reprendre</Button>}
        {canCloturer && <Button size="sm" variant="secondary" onClick={() => setShowCloturer(true)}>🏁 Clôturer</Button>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid rgba(79,195,247,0.08)', paddingBottom: '10px' }}>
        {(['infos', 'mp', 'declarations', 'consommations'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '5px 14px', borderRadius: '6px', border: 'none',
            background: tab === t ? 'rgba(79,195,247,0.12)' : 'transparent',
            color: tab === t ? '#4FC3F7' : '#5A7A90',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
          }}>
            {t === 'mp' ? 'Dispo. MP' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'infos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {[
            ['Article', `${of.article?.reference} — ${of.article?.designation}`],
            ['Qté prévue', `${of.quantitePrevue} ${of.article?.uniteMesure}`],
            ['Qté produite', `${of.quantiteProduite || 0}`],
            ['Qté rebut', `${of.quantiteRebut || 0}`],
            ['Site', of.site?.nom],
            ['Gamme', of.gamme?.code || '—'],
            ['Début prévu', of.dateDebutPrevue ? new Date(of.dateDebutPrevue).toLocaleDateString('fr-FR') : '—'],
            ['Fin prévue', of.dateFinPrevue ? new Date(of.dateFinPrevue).toLocaleDateString('fr-FR') : '—'],
            ['Lot PF', of.lotPf?.numero || '—'],
          ].map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '10px' }}>
              <div style={{ color: '#3A6278', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{k}</div>
              <div style={{ color: '#C4DCF0', fontSize: '0.85rem' }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'mp' && dispo && (
        <div>
          <div style={{ marginBottom: '12px' }}>
            <Badge variant={dispo.estFaisable ? 'success' : 'danger'}>
              {dispo.estFaisable ? '✅ Faisable' : `⚠ ${dispo.nbManquants} manquant(s)`}
            </Badge>
          </div>
          <Table data={dispo.composants || []} emptyText="Aucun composant"
            columns={[
              { key: 'reference', header: 'Référence', width: '140px',
                render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.8rem' }}>{r.reference}</span> },
              { key: 'designation', header: 'Désignation' },
              { key: 'qte_necessaire', header: 'Nécessaire', width: '100px',
                render: (r: any) => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.qte_necessaire).toFixed(2)}</span> },
              { key: 'stock_disponible', header: 'Disponible', width: '100px',
                render: (r: any) => <span style={{ color: Number(r.stock_disponible) >= Number(r.qte_necessaire) ? '#4ADE80' : '#FCA5A5', fontWeight: 600 }}>
                  {Number(r.stock_disponible).toFixed(2)}
                </span> },
              { key: 'manquant', header: 'Manquant', width: '90px',
                render: (r: any) => <span style={{ color: Number(r.manquant) > 0 ? '#FCA5A5' : '#4ADE80', fontWeight: 700 }}>
                  {Number(r.manquant) > 0 ? `-${Number(r.manquant).toFixed(2)}` : '✓'}
                </span> },
              { key: 'statut', header: 'Statut', width: '90px',
                render: (r: any) => <Badge variant={r.statut === 'OK' ? 'success' : 'danger'}>{r.statut}</Badge> },
            ]}
          />
        </div>
      )}

      {tab === 'declarations' && (
        <Table data={declarations || []} emptyText="Aucune déclaration"
          columns={[
            { key: 'dateDeclaration', header: 'Date', width: '130px',
              render: (r: any) => <span style={{ color: '#5A7A90', fontSize: '0.8rem' }}>{new Date(r.dateDeclaration || r.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span> },
            { key: 'quantiteProduite', header: 'Produit', width: '90px',
              render: (r: any) => <span style={{ color: '#4ADE80', fontWeight: 600 }}>+{r.quantiteProduite}</span> },
            { key: 'quantiteRebut', header: 'Rebut', width: '80px',
              render: (r: any) => <span style={{ color: r.quantiteRebut > 0 ? '#FCA5A5' : '#3A6278' }}>{r.quantiteRebut}</span> },
            { key: 'tempsProduction', header: 'Temps', width: '90px',
              render: (r: any) => <span style={{ color: '#5A7A90' }}>{r.tempsProduction}min</span> },
          ]}
        />
      )}

      {tab === 'consommations' && (
        <Table data={consommations || []} emptyText="Aucune consommation"
          columns={[
            { key: 'article', header: 'Article',
              render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.8rem' }}>{r.article?.reference}</span> },
            { key: 'qteTheorique', header: 'Théorique', width: '100px',
              render: (r: any) => <span style={{ color: '#5A7A90' }}>{Number(r.qteTheorique).toFixed(2)}</span> },
            { key: 'qteReelle', header: 'Réelle', width: '100px',
              render: (r: any) => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.qteReelle).toFixed(2)}</span> },
            { key: 'ecartQte', header: 'Écart', width: '90px',
              render: (r: any) => {
                const e = Number(r.ecartQte || 0);
                return <span style={{ color: Math.abs(e) > 0.01 ? '#FCD34D' : '#4ADE80', fontWeight: 700 }}>
                  {e > 0 ? '+' : ''}{e.toFixed(2)}
                </span>;
              }},
          ]}
        />
      )}

      {/* Modals actions */}
      {showDeclarer && (
        <Modal title="Déclaration de production" onClose={() => setShowDeclarer(false)}>
          <FormField label="Opération">
            <Select value={declForm.operationId} onChange={v => setDeclForm(f => ({ ...f, operationId: v }))} options={opOptions} placeholder="Sélectionner..." />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Quantité produite"><Input value={declForm.quantiteProduite} onChange={v => setDeclForm(f => ({ ...f, quantiteProduite: v }))} type="number" /></FormField>
            <FormField label="Quantité rebut"><Input value={declForm.quantiteRebut} onChange={v => setDeclForm(f => ({ ...f, quantiteRebut: v }))} type="number" /></FormField>
            <FormField label="Temps production (min)"><Input value={declForm.tempsProduction} onChange={v => setDeclForm(f => ({ ...f, tempsProduction: v }))} type="number" /></FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowDeclarer(false)}>Annuler</Button>
            <Button onClick={async () => {
              await declarer.mutateAsync({ ...declForm, quantiteProduite: Number(declForm.quantiteProduite), quantiteRebut: Number(declForm.quantiteRebut), tempsProduction: Number(declForm.tempsProduction) });
              setShowDeclarer(false);
            }}>Déclarer</Button>
          </div>
        </Modal>
      )}

      {showConsommer && (
        <Modal title="Consommation MP" onClose={() => setShowConsommer(false)}>
          <FormField label="Article" required>
            <Select value={consoForm.articleId} onChange={v => setConsoForm(f => ({ ...f, articleId: v }))} options={articleOptions} placeholder="Sélectionner..." />
          </FormField>
          <FormField label="Lot (optionnel)">
            <Select value={consoForm.lotId} onChange={v => setConsoForm(f => ({ ...f, lotId: v }))} options={lotOptions} placeholder="Sans lot spécifique" />
          </FormField>
          <FormField label="Quantité réelle" required>
            <Input value={consoForm.qteReelle} onChange={v => setConsoForm(f => ({ ...f, qteReelle: v }))} type="number" />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowConsommer(false)}>Annuler</Button>
            <Button onClick={async () => {
              await consommer.mutateAsync({ ...consoForm, qteReelle: Number(consoForm.qteReelle) });
              setShowConsommer(false);
            }}>Enregistrer</Button>
          </div>
        </Modal>
      )}

      {showCloturer && (
        <Modal title="Clôture de l'OF" onClose={() => setShowCloturer(false)}>
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <span style={{ color: '#FCA5A5', fontSize: '0.875rem' }}>⚠ La clôture est irréversible — un lot PF sera créé automatiquement.</span>
          </div>
          <FormField label="Quantité produite finale" required>
            <Input value={cloForm.quantiteProduiteFinale} onChange={v => setCloForm(f => ({ ...f, quantiteProduiteFinale: v }))} type="number" />
          </FormField>
          <FormField label="Quantité rebut finale">
            <Input value={cloForm.quantiteRebutFinale} onChange={v => setCloForm(f => ({ ...f, quantiteRebutFinale: v }))} type="number" />
          </FormField>
          <FormField label="Commentaire">
            <Input value={cloForm.commentaire} onChange={v => setCloForm(f => ({ ...f, commentaire: v }))} />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCloturer(false)}>Annuler</Button>
            <Button onClick={async () => {
              await cloturer.mutateAsync({ id, data: { ...cloForm, quantiteProduiteFinale: Number(cloForm.quantiteProduiteFinale), quantiteRebutFinale: Number(cloForm.quantiteRebutFinale) } });
              setShowCloturer(false);
              onClose();
            }}>Clôturer l'OF</Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

// ── Page principale OF ────────────────────────────────────────────────────────
export default function OrdresFabricationPage() {
  const [statutFilter, setStatutFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({ articleId: '', siteId: '', gammeId: '', quantitePrevue: '', dateDebutPrevue: '', dateFinPrevue: '' });

  const { data, isLoading } = useOrdresFabrication({ statut: statutFilter || undefined });
  const { data: articlesData } = useArticles({ type: 'PF', limit: 200 });
  const { data: sfData } = useArticles({ type: 'SF', limit: 200 });
  const { data: sites } = useSites();
  const { data: gammes } = useGammes();
  const createOF = useCreateOF();

  const ofs = data?.data || [];
  const total = data?.total || 0;

  const articleOptions = [
    ...(articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation} (PF)` })),
    ...(sfData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation} (SF)` })),
  ];
  const siteOptions = (sites || []).map((s: any) => ({ value: s.id, label: `${s.code} — ${s.nom}` }));
  const gammeOptions = (Array.isArray(gammes) ? gammes : [])
    .filter((g: any) => g.statut === 'ACTIF')
    .map((g: any) => ({ value: g.id, label: `${g.code} v${g.version} — ${g.article?.reference}` }));

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const planifies = ofs.filter((o: any) => o.statut === 'PLANIFIE').length;
  const enCours = ofs.filter((o: any) => ['LANCE', 'EN_COURS'].includes(o.statut)).length;
  const termines = ofs.filter((o: any) => o.statut === 'CLOS').length;

  const handleCreate = async () => {
    try {
      await createOF.mutateAsync({
        ...form,
        quantitePrevue: Number(form.quantitePrevue),
        gammeId: form.gammeId || undefined,
        dateDebutPrevue: form.dateDebutPrevue || undefined,
        dateFinPrevue: form.dateFinPrevue || undefined,
      });
      setShowCreate(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Ordres de fabrication</h1>
          <p className="page-subtitle">{total} ordres</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouvel OF</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <KpiCard label="Planifiés" value={planifies} variant="neutral" icon="📋" />
        <KpiCard label="En cours" value={enCours} variant="warning" icon="⚙️" />
        <KpiCard label="Clôturés" value={termines} variant="success" icon="✅" />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <Select value={statutFilter} onChange={setStatutFilter} options={STATUTS_OF} placeholder="Tous les statuts" />
      </div>

      <Table
        loading={isLoading}
        data={ofs}
        emptyText="Aucun ordre de fabrication"
        onRowClick={r => setDetailId(r.id)}
        columns={[
          { key: 'reference', header: 'Référence', width: '180px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'article', header: 'Article',
            render: (r: any) => (
              <div>
                <div style={{ color: '#C4DCF0' }}>{r.article?.reference}</div>
                <div style={{ color: '#3A6278', fontSize: '0.75rem' }}>{r.article?.designation}</div>
              </div>
            )},
          { key: 'statut', header: 'Statut', width: '100px',
            render: (r: any) => <Badge variant={STATUT_VARIANTS[r.statut]}>{r.statut.replace('_', ' ')}</Badge> },
          { key: 'quantitePrevue', header: 'Qté prévue', width: '100px',
            render: (r: any) => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.quantitePrevue).toFixed(2)}</span> },
          { key: 'quantiteProduite', header: 'Produit', width: '90px',
            render: (r: any) => <span style={{ color: '#4ADE80' }}>{Number(r.quantiteProduite || 0).toFixed(2)}</span> },
          { key: 'dateDebutPrevue', header: 'Début prévu', width: '120px',
            render: (r: any) => r.dateDebutPrevue ? <span style={{ color: '#5A7A90', fontSize: '0.8rem' }}>{new Date(r.dateDebutPrevue).toLocaleDateString('fr-FR')}</span> : '—' },
          { key: 'site', header: 'Site', width: '100px',
            render: (r: any) => <span style={{ color: '#3A6278', fontSize: '0.8rem' }}>{r.site?.code}</span> },
        ]}
      />

      {detailId && <OFDetail id={detailId} onClose={() => setDetailId(null)} />}

      {showCreate && (
        <Modal title="Nouvel ordre de fabrication" onClose={() => setShowCreate(false)} width="580px">
          <FormField label="Article (PF ou SF)" required>
            <Select value={form.articleId} onChange={set('articleId')} options={articleOptions} placeholder="Sélectionner..." />
          </FormField>
          <FormField label="Site de production" required>
            <Select value={form.siteId} onChange={set('siteId')} options={siteOptions} placeholder="Sélectionner..." />
          </FormField>
          <FormField label="Gamme (optionnel)">
            <Select value={form.gammeId} onChange={set('gammeId')} options={gammeOptions} placeholder="Sans gamme" />
          </FormField>
          <FormField label="Quantité prévue" required>
            <Input value={form.quantitePrevue} onChange={set('quantitePrevue')} type="number" placeholder="100" />
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Début prévu"><Input value={form.dateDebutPrevue} onChange={set('dateDebutPrevue')} type="date" /></FormField>
            <FormField label="Fin prévue"><Input value={form.dateFinPrevue} onChange={set('dateFinPrevue')} type="date" /></FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createOF.isPending}>Créer l'OF</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}