import { useState } from 'react';
import {
  useCommandesAchat, useCreateCA, useAddLigneCA,
  useValiderCA, useEnvoyerCA, useChangerStatutCA, useCommandeAchat,
} from '../../hooks/useAchats';
import { useFournisseurs, useSites, useArticles } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, Select, FormField, Input, Pagination } from '../../components/ui';

const STATUTS_CA = [
  { value: 'BROUILLON', label: 'Brouillon' },
  { value: 'VALIDEE', label: 'Validée' },
  { value: 'ENVOYEE', label: 'Envoyée' },
  { value: 'AR_RECU', label: 'AR reçu' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'RECUE', label: 'Reçue' },
  { value: 'CLOTUREE', label: 'Clôturée' },
  { value: 'ANNULEE', label: 'Annulée' },
];

const STATUT_VARIANTS: Record<string, any> = {
  BROUILLON: 'neutral', VALIDEE: 'info', ENVOYEE: 'accent',
  AR_RECU: 'accent', EN_COURS: 'warning', RECUE: 'success',
  CLOTUREE: 'neutral', ANNULEE: 'danger',
};

const TRANSITIONS: Record<string, string[]> = {
  ENVOYEE: ['AR_RECU'],
  AR_RECU: ['EN_COURS'],
  EN_COURS: ['RECUE'],
  RECUE: ['CLOTUREE'],
  BROUILLON: ['ANNULEE'],
  VALIDEE: ['ANNULEE'],
};

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: '8px',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(79,195,247,0.15)',
  color: '#E8F4FD', fontFamily: 'inherit', fontSize: '13px',
};

// Stepper statut
function StatutStepper({ statut }: { statut: string }) {
  const steps = ['BROUILLON', 'VALIDEE', 'ENVOYEE', 'AR_RECU', 'EN_COURS', 'RECUE', 'CLOTUREE'];
  const idx = steps.indexOf(statut);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{
            padding: '3px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
            background: i === idx ? 'rgba(79,195,247,0.2)' : i < idx ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.03)',
            color: i === idx ? '#4FC3F7' : i < idx ? '#4ADE80' : '#2D4A5E',
            border: i === idx ? '1px solid rgba(79,195,247,0.3)' : '1px solid transparent',
          }}>
            {s.replace('_', ' ')}
          </div>
          {i < steps.length - 1 && <span style={{ color: '#2D4A5E', fontSize: '0.7rem' }}>›</span>}
        </div>
      ))}
    </div>
  );
}

// Detail CA avec lignes
function CommandeDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: ca } = useCommandeAchat(id);
  const { data: articlesData } = useArticles({ limit: 100 });
  const addLigne = useAddLigneCA(id);
  const valider = useValiderCA();
  const envoyer = useEnvoyerCA();
  const changerStatut = useChangerStatutCA();
  const [showAddLigne, setShowAddLigne] = useState(false);
  const [ligneForm, setLigneForm] = useState({
    articleId: '', quantiteCommandee: '', prixUnitaire: '', dateLivrSouhaitee: '',
  });

  if (!ca) return null;

  const articleOptions = (articlesData?.data || []).map((a: any) => ({
    value: a.id, label: `${a.reference} — ${a.designation}`,
  }));
  const setL = (k: string) => (v: string) => setLigneForm(f => ({ ...f, [k]: v }));

  const handleAddLigne = async () => {
    try {
      await addLigne.mutateAsync({
        ...ligneForm,
        quantiteCommandee: Number(ligneForm.quantiteCommandee),
        prixUnitaire: Number(ligneForm.prixUnitaire),
      } as any);
      setShowAddLigne(false);
      setLigneForm({ articleId: '', quantiteCommandee: '', prixUnitaire: '', dateLivrSouhaitee: '' });
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erreur');
    }
  };

  return (
    <Modal title={`${ca.reference} — ${ca.fournisseur?.raisonSociale}`} onClose={onClose} width="800px">
      {/* Stepper */}
      <div style={{ marginBottom: '16px' }}>
        <StatutStepper statut={ca.statut} />
      </div>

      {/* Actions workflow */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {ca.statut === 'BROUILLON' && (
          <>
            <Button size="sm" onClick={() => valider.mutateAsync(id)}>✓ Valider</Button>
            <Button size="sm" variant="secondary" onClick={() => setShowAddLigne(true)}>+ Ajouter ligne</Button>
          </>
        )}
        {ca.statut === 'VALIDEE' && (
          <Button size="sm" onClick={() => envoyer.mutateAsync(id)}>📤 Envoyer au fournisseur</Button>
        )}
        {TRANSITIONS[ca.statut]?.map(s => (
          <Button key={s} size="sm" variant="secondary"
            onClick={() => changerStatut.mutateAsync({ id, statut: s })}>
            → {s.replace('_', ' ')}
          </Button>
        ))}
      </div>

      {/* Infos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {[
          ['Fournisseur', ca.fournisseur?.raisonSociale],
          ['Montant HT', `${Number(ca.montantHt || 0).toLocaleString('fr-FR')} €`],
          ['Montant TTC', `${Number(ca.montantTtc || 0).toLocaleString('fr-FR')} €`],
          ['Livraison prévue', ca.dateLivraisonPrev ? new Date(ca.dateLivraisonPrev).toLocaleDateString('fr-FR') : '—'],
          ['Devise', ca.devise || 'EUR'],
          ['Paiement', `${ca.delaiPaiement}j — ${ca.modePaiement}`],
        ].map(([k, v]) => (
          <div key={k as string} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '10px' }}>
            <div style={{ color: '#3A6278', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{k}</div>
            <div style={{ color: '#C4DCF0', fontSize: '0.875rem' }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Lignes */}
      <h4 style={{ color: '#5A7A90', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
        Lignes commande ({(ca.lignes || []).length})
      </h4>
      <Table
        data={ca.lignes || []}
        emptyText="Aucune ligne"
        columns={[
          {
            key: 'numLigne', header: 'N°', width: '50px',
            render: (r: any) => <span style={{ color: '#5A7A90' }}>{r.numLigne}</span>,
          },
          {
            key: 'article', header: 'Article',
            render: (r: any) => (
              <div>
                <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.8rem' }}>{r.article?.reference}</span>
                <span style={{ color: '#5A7A90', marginLeft: '8px', fontSize: '0.78rem' }}>{r.article?.designation}</span>
              </div>
            ),
          },
          {
            key: 'quantiteCommandee', header: 'Qté', width: '80px',
            render: (r: any) => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.quantiteCommandee).toFixed(2)}</span>,
          },
          {
            key: 'prixUnitaire', header: 'Prix unit.', width: '100px',
            render: (r: any) => <span style={{ color: '#4ADE80' }}>{Number(r.prixUnitaire).toFixed(2)} €</span>,
          },
          {
            key: 'montantLigne', header: 'Montant', width: '110px',
            render: (r: any) => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.montantLigne || 0).toFixed(2)} €</span>,
          },
          {
            key: 'quantiteRecue', header: 'Reçu', width: '80px',
            render: (r: any) => (
              <span style={{ color: Number(r.quantiteRecue) >= Number(r.quantiteCommandee) ? '#4ADE80' : '#5A7A90' }}>
                {Number(r.quantiteRecue || 0).toFixed(2)}
              </span>
            ),
          },
        ]}
      />

      {/* Modal ajout ligne */}
      {showAddLigne && (
        <Modal title="Ajouter une ligne" onClose={() => setShowAddLigne(false)}>
          <FormField label="Article" required>
            <select
              value={ligneForm.articleId}
              onChange={e => setL('articleId')(e.target.value)}
              style={selectStyle}
            >
              <option value="">Sélectionner un article...</option>
              {articleOptions.map((o: any) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Quantité" required>
              <Input value={ligneForm.quantiteCommandee} onChange={setL('quantiteCommandee')} type="number" />
            </FormField>
            <FormField label="Prix unitaire (€)" required>
              <Input value={ligneForm.prixUnitaire} onChange={setL('prixUnitaire')} type="number" />
            </FormField>
            <FormField label="Date livraison souhaitée">
              <Input value={ligneForm.dateLivrSouhaitee} onChange={setL('dateLivrSouhaitee')} type="date" />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button variant="ghost" onClick={() => setShowAddLigne(false)}>Annuler</Button>
            <Button onClick={handleAddLigne} disabled={addLigne.isPending}>Ajouter</Button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

export default function CommandesAchatPage() {
  const [page, setPage] = useState(1);
  const [statutFilter, setStatutFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fournisseurId: '', siteLivraisonId: '', dateLivraisonPrev: '',
    devise: 'EUR', delaiPaiement: '30', modePaiement: 'VIREMENT',
  });

  const { data, isLoading } = useCommandesAchat({ statut: statutFilter || undefined, page });
  const { data: fournisseurs } = useFournisseurs({ statut: 'ACTIF' });
  const { data: sites } = useSites();
  const createCA = useCreateCA();

  const cas = data?.data || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / 20);

  const fourOptions = (fournisseurs || []).map((f: any) => ({
    value: f.id, label: `${f.code} — ${f.raisonSociale}`,
  }));
  const siteOptions = (sites || []).map((s: any) => ({
    value: s.id, label: `${s.code} — ${s.nom}`,
  }));
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
  if (!form.fournisseurId || !form.siteLivraisonId) {
    alert('Sélectionne un fournisseur et un site');
    return;
  }
  try {
    const payload = {
      fournisseurId: form.fournisseurId,
      siteLivraisonId: form.siteLivraisonId,
      dateLivraisonPrev: form.dateLivraisonPrev || undefined,
      devise: form.devise,
      delaiPaiement: Number(form.delaiPaiement),
      modePaiement: form.modePaiement,
    };
    console.log('payload envoyé:', payload); // vérif
    await createCA.mutateAsync(payload as any);
    setShowCreate(false);
    setForm({
      fournisseurId: '', siteLivraisonId: '', dateLivraisonPrev: '',
      devise: 'EUR', delaiPaiement: '30', modePaiement: 'VIREMENT',
    });
  } catch (e: any) {
    alert(e.response?.data?.message || 'Erreur');
  }
};

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Commandes achat</h1>
          <p className="page-subtitle">{total} commandes</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouvelle CA</Button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <Select
          value={statutFilter}
          onChange={v => { setStatutFilter(v); setPage(1); }}
          options={STATUTS_CA}
          placeholder="Tous les statuts"
        />
      </div>

      <Table
        loading={isLoading}
        data={cas}
        emptyText="Aucune commande achat"
        onRowClick={(r: any) => setDetailId(r.id)}
        columns={[
          {
            key: 'reference', header: 'Référence', width: '150px',
            render: (r: any) => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span>,
          },
          {
            key: 'fournisseur', header: 'Fournisseur',
            render: (r: any) => <span style={{ color: '#C4DCF0' }}>{r.fournisseur?.raisonSociale}</span>,
          },
          {
            key: 'statut', header: 'Statut', width: '110px',
            render: (r: any) => <Badge variant={STATUT_VARIANTS[r.statut]}>{r.statut.replace('_', ' ')}</Badge>,
          },
          {
            key: 'montantTtc', header: 'Montant TTC', width: '130px',
            render: (r: any) => <span style={{ color: '#4ADE80', fontWeight: 600 }}>{Number(r.montantTtc || 0).toLocaleString('fr-FR')} €</span>,
          },
          {
            key: 'dateLivraisonPrev', header: 'Livraison prév.', width: '130px',
            render: (r: any) => r.dateLivraisonPrev
              ? <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{new Date(r.dateLivraisonPrev).toLocaleDateString('fr-FR')}</span>
              : <span style={{ color: '#2D4A5E' }}>—</span>,
          },
          {
            key: 'createdAt', header: 'Créée le', width: '110px',
            render: (r: any) => <span style={{ color: '#3A6278', fontSize: '0.8rem' }}>{new Date(r.createdAt).toLocaleDateString('fr-FR')}</span>,
          },
        ]}
      />
      <Pagination page={page} pages={pages} total={total} onPage={setPage} />

      {/* Modal création */}
      {showCreate && (
        <Modal title="Nouvelle commande achat" onClose={() => setShowCreate(false)} width="580px">
          <FormField label="Fournisseur" required>
            <select
              value={form.fournisseurId}
              onChange={e => set('fournisseurId')(e.target.value)}
              style={selectStyle}
            >
              <option value="">Sélectionner un fournisseur...</option>
              {fourOptions.map((o: any) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Site de livraison" required>
            <select
              value={form.siteLivraisonId}
              onChange={e => set('siteLivraisonId')(e.target.value)}
              style={selectStyle}
            >
              <option value="">Sélectionner un site...</option>
              {siteOptions.map((o: any) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Date livraison prévue">
              <Input value={form.dateLivraisonPrev} onChange={set('dateLivraisonPrev')} type="date" />
            </FormField>
            <FormField label="Devise">
              <Select value={form.devise} onChange={set('devise')} options={[
                { value: 'EUR', label: 'EUR — Euro' },
                { value: 'USD', label: 'USD — Dollar' },
                { value: 'GBP', label: 'GBP — Livre' },
              ]} />
            </FormField>
            <FormField label="Délai paiement (jours)">
              <Input value={form.delaiPaiement} onChange={set('delaiPaiement')} type="number" />
            </FormField>
            <FormField label="Mode paiement">
              <Select value={form.modePaiement} onChange={set('modePaiement')} options={[
                { value: 'VIREMENT', label: 'Virement' },
                { value: 'CHEQUE', label: 'Chèque' },
                { value: 'PRELEVEMENT', label: 'Prélèvement' },
              ]} />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button
              onClick={handleCreate}
              disabled={createCA.isPending || !form.fournisseurId || !form.siteLivraisonId}
            >
              {createCA.isPending ? 'Création...' : 'Créer en brouillon'}
            </Button>
          </div>
        </Modal>
      )}

      {detailId && <CommandeDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}