import { useState } from 'react';
import { useLots, useCreateLot, useUpdateStatutLot, useAlertesDluo } from '../../hooks/useStock';
import { useSites, useArticles } from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, SearchInput, Select, FormField, Input, Pagination } from '../../components/ui';

const STATUTS_LOT = [
  { value: 'DISPONIBLE', label: 'Disponible' },
  { value: 'RESERVE', label: 'Réservé' },
  { value: 'QUARANTAINE', label: 'Quarantaine' },
  { value: 'LIBERE', label: 'Libéré' },
  { value: 'CONSOMME', label: 'Consommé' },
  { value: 'PERIME', label: 'Périmé' },
];

const STATUT_VARIANTS: Record<string, any> = {
  DISPONIBLE: 'success', RESERVE: 'accent', QUARANTAINE: 'warning',
  LIBERE: 'info', CONSOMME: 'neutral', PERIME: 'danger',
};

const TRANSITIONS: Record<string, string[]> = {
  DISPONIBLE: ['RESERVE', 'QUARANTAINE', 'CONSOMME', 'PERIME'],
  RESERVE: ['DISPONIBLE', 'CONSOMME', 'QUARANTAINE'],
  QUARANTAINE: ['LIBERE', 'PERIME'],
  LIBERE: ['DISPONIBLE', 'PERIME'],
  CONSOMME: [], PERIME: [],
};

function AlerteDluo({ date }: { date: string }) {
  if (!date) return null;
  const diff = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  if (diff > 30) return <span style={{ color: '#5A7A90', fontSize: '0.8rem' }}>{new Date(date).toLocaleDateString('fr-FR')}</span>;
  if (diff <= 0) return <Badge variant="danger">Périmé</Badge>;
  return <Badge variant="warning">⚠ {diff}j</Badge>;
}

export default function LotsPage() {
  const [page, setPage] = useState(1);
  const [articleId, setArticleId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [statut, setStatut] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showStatut, setShowStatut] = useState<any>(null);
  const [form, setForm] = useState({ articleId: '', siteId: '', quantiteInitiale: '', dateDluo: '', lotFournisseur: '' });
  const [newStatut, setNewStatut] = useState('');

  const { data, isLoading } = useLots({ articleId: articleId || undefined, siteId: siteId || undefined, statut: statut || undefined, page, limit: 20 });
  const { data: alertesDluo } = useAlertesDluo();
  const { data: sites } = useSites();
  const { data: articlesData } = useArticles({ limit: 100 });
  const createLot = useCreateLot();
  const updateStatut = useUpdateStatutLot();

  const lots = data?.data || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const siteOptions = (sites || []).map((s: any) => ({ value: s.id, label: `${s.code} — ${s.nom}` }));
  const articleOptions = (articlesData?.data || []).map((a: any) => ({ value: a.id, label: `${a.reference} — ${a.designation}` }));

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleCreate = async () => {
    try {
      await createLot.mutateAsync({
        ...form,
        quantiteInitiale: Number(form.quantiteInitiale),
        dateDluo: form.dateDluo || undefined,
      });
      setShowCreate(false);
      setForm({ articleId: '', siteId: '', quantiteInitiale: '', dateDluo: '', lotFournisseur: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleStatut = async () => {
    try {
      await updateStatut.mutateAsync({ id: showStatut.id, statut: newStatut });
      setShowStatut(null);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lots</h1>
          <p className="page-subtitle">{total} lots · {(alertesDluo || []).length} alertes DLUO</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nouveau lot</Button>
      </div>

      {/* Alertes DLUO */}
      {(alertesDluo || []).length > 0 && (
        <div style={{
          background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)',
          borderRadius: '10px', padding: '12px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <span style={{ fontSize: '1.1rem' }}>⚠️</span>
          <span style={{ color: '#FCD34D', fontSize: '0.875rem' }}>
            <strong>{(alertesDluo || []).length} lots</strong> arrivent à expiration dans moins de 30 jours
          </span>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <Select value={siteId} onChange={v => { setSiteId(v); setPage(1); }} options={siteOptions} placeholder="Tous les sites" />
        <Select value={statut} onChange={v => { setStatut(v); setPage(1); }} options={STATUTS_LOT} placeholder="Tous les statuts" />
      </div>

      <Table
        loading={isLoading}
        data={lots}
        emptyText="Aucun lot"
        columns={[
          { key: 'numero', header: 'N° Lot', width: '160px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.8rem' }}>{r.numero}</span> },
          { key: 'article', header: 'Article',
            render: r => (
              <div>
                <div style={{ color: '#C4DCF0', fontSize: '0.875rem' }}>{r.article?.reference}</div>
                <div style={{ color: '#3A6278', fontSize: '0.75rem' }}>{r.article?.designation}</div>
              </div>
            )},
          { key: 'statut', header: 'Statut', width: '110px',
            render: r => <Badge variant={STATUT_VARIANTS[r.statut]}>{r.statut}</Badge> },
          { key: 'quantiteInitiale', header: 'Quantité', width: '100px',
            render: r => <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{Number(r.quantiteInitiale).toFixed(2)}</span> },
          { key: 'dateDluo', header: 'DLUO', width: '120px',
            render: r => <AlerteDluo date={r.dateDluo} /> },
          { key: 'dateReception', header: 'Réception', width: '110px',
            render: r => <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{new Date(r.dateReception).toLocaleDateString('fr-FR')}</span> },
          { key: 'fournisseur', header: 'Fournisseur', width: '140px',
            render: r => <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{r.fournisseur?.code || '—'}</span> },
          { key: 'actions', header: '', width: '100px',
            render: r => TRANSITIONS[r.statut]?.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => { setShowStatut(r); setNewStatut(''); }}>
                Changer statut
              </Button>
            )},
        ]}
      />
      <Pagination page={page} pages={pages} total={total} onPage={setPage} />

      {/* Modal création lot */}
      {showCreate && (
        <Modal title="Nouveau lot" onClose={() => setShowCreate(false)}>
          <FormField label="Article" required>
            <Select value={form.articleId} onChange={set('articleId')} options={articleOptions} placeholder="Sélectionner un article" />
          </FormField>
          <FormField label="Site" required>
            <Select value={form.siteId} onChange={set('siteId')} options={siteOptions} placeholder="Sélectionner un site" />
          </FormField>
          <FormField label="Quantité initiale" required>
            <Input value={form.quantiteInitiale} onChange={set('quantiteInitiale')} type="number" placeholder="500" />
          </FormField>
          <FormField label="DLUO (date limite)">
            <Input value={form.dateDluo} onChange={set('dateDluo')} type="date" />
          </FormField>
          <FormField label="N° lot fournisseur">
            <Input value={form.lotFournisseur} onChange={set('lotFournisseur')} placeholder="LOT-FOUR-2026" />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={createLot.isPending}>Créer le lot</Button>
          </div>
        </Modal>
      )}

      {/* Modal changement statut */}
      {showStatut && (
        <Modal title={`Changer statut — ${showStatut.numero}`} onClose={() => setShowStatut(null)}>
          <div style={{ marginBottom: '16px' }}>
            <span style={{ color: '#5A7A90', fontSize: '0.875rem' }}>Statut actuel : </span>
            <Badge variant={STATUT_VARIANTS[showStatut.statut]}>{showStatut.statut}</Badge>
          </div>
          <FormField label="Nouveau statut" required>
            <Select value={newStatut} onChange={setNewStatut}
              options={TRANSITIONS[showStatut.statut].map(s => ({ value: s, label: s }))}
              placeholder="Sélectionner..." />
          </FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowStatut(null)}>Annuler</Button>
            <Button onClick={handleStatut} disabled={!newStatut || updateStatut.isPending}>Confirmer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
