import { useState } from 'react';
import {
  useArticles, useFamillesArticles,
  useCreateArticle, useUpdateArticle, useDesactiverArticle,
  usePagination,
} from '../../hooks/useReferentiels';
import {
  Table, Badge, Button, Modal, SearchInput,
  Select, FormField, Input, Pagination, KpiCard,
} from '../../components/ui';

const ARTICLE_TYPES = [
  { value: 'MP', label: 'Matière première' },
  { value: 'SF', label: 'Semi-fini' },
  { value: 'PF', label: 'Produit fini' },
  { value: 'CONSOMMABLE', label: 'Consommable' },
  { value: 'EMBALLAGE', label: 'Emballage' },
];

const TYPE_VARIANTS: Record<string, any> = {
  MP: 'info', SF: 'accent', PF: 'success', CONSOMMABLE: 'warning', EMBALLAGE: 'neutral',
};

const NIVEAUX_CONTROLE = [
  { value: 'REDUIT', label: 'Réduit' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'RENFORCE', label: 'Renforcé' },
  { value: 'RENFORCE_LABO', label: 'Renforcé Labo' },
];

const emptyForm = {
  reference: '', designation: '', type: 'MP', uniteMesure: 'kg',
  stockMini: 0, stockMaxi: '', delaiReapproJours: 0, prixAchatStd: 0,
  gestionParLot: false, niveauControle: 'NORMAL', familleId: '',
};

export default function ArticlesPage() {
  const { page, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [actifFilter, setActifFilter] = useState('true');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const { data, isLoading } = useArticles({
    search: search || undefined,
    type: typeFilter || undefined,
    actif: actifFilter || undefined,
    page, limit: 20,
  });

  const { data: familles } = useFamillesArticles();
  const createArticle = useCreateArticle();
  const updateArticle = useUpdateArticle(editingId || '');
  const desactiver = useDesactiverArticle();

  const articles = data?.data || [];
  const total = data?.total || 0;
  const pages = data?.pages || 1;

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (article: any) => {
    setForm({
      reference: article.reference,
      designation: article.designation,
      type: article.type,
      uniteMesure: article.uniteMesure,
      stockMini: article.stockMini,
      stockMaxi: article.stockMaxi || '',
      delaiReapproJours: article.delaiReapproJours,
      prixAchatStd: article.prixAchatStd,
      gestionParLot: article.gestionParLot,
      niveauControle: article.niveauControle,
      familleId: article.familleId || '',
    });
    setEditingId(article.id);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...form,
        stockMini: Number(form.stockMini),
        stockMaxi: form.stockMaxi ? Number(form.stockMaxi) : undefined,
        delaiReapproJours: Number(form.delaiReapproJours),
        prixAchatStd: Number(form.prixAchatStd),
        familleId: form.familleId || undefined,
      };
      if (editingId) {
        await updateArticle.mutateAsync(payload);
      } else {
        await createArticle.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDesactiver = async (id: string, ref: string) => {
    if (!confirm(`Désactiver l'article ${ref} ?`)) return;
    await desactiver.mutateAsync(id);
  };

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Articles</h1>
          <p className="page-subtitle">{total} articles · Référentiel central</p>
        </div>
        <Button onClick={openCreate}>+ Nouvel article</Button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Référence, désignation..." />
        <Select value={typeFilter} onChange={v => { setTypeFilter(v); setPage(1); }}
          options={ARTICLE_TYPES} placeholder="Tous les types" />
        <Select value={actifFilter} onChange={v => { setActifFilter(v); setPage(1); }}
          options={[{ value: 'true', label: 'Actifs' }, { value: 'false', label: 'Inactifs' }]}
          placeholder="Tous" />
      </div>

      {/* Tableau */}
      <Table
        loading={isLoading}
        data={articles}
        emptyText="Aucun article trouvé"
        columns={[
          { key: 'reference', header: 'Référence', width: '140px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.reference}</span> },
          { key: 'designation', header: 'Désignation' },
          { key: 'type', header: 'Type', width: '120px',
            render: r => <Badge variant={TYPE_VARIANTS[r.type] || 'neutral'}>{r.type}</Badge> },
          { key: 'uniteMesure', header: 'Unité', width: '70px',
            render: r => <span style={{ color: '#5A7A90' }}>{r.uniteMesure}</span> },
          { key: 'stockMini', header: 'Stock mini', width: '100px',
            render: r => <span style={{ color: '#C4DCF0' }}>{r.stockMini}</span> },
          { key: 'prixAchatStd', header: 'Prix std', width: '100px',
            render: r => r.prixAchatStd ? `${Number(r.prixAchatStd).toFixed(2)} €` : '—' },
          { key: 'gestionParLot', header: 'Par lot', width: '70px',
            render: r => r.gestionParLot ? <Badge variant="success">Oui</Badge> : <Badge variant="neutral">Non</Badge> },
          { key: 'actif', header: 'Statut', width: '80px',
            render: r => r.actif ? <Badge variant="success">Actif</Badge> : <Badge variant="neutral">Inactif</Badge> },
          { key: 'actions', header: '', width: '120px',
            render: r => (
              <div style={{ display: 'flex', gap: '6px' }}>
                <Button size="sm" variant="secondary" onClick={() => openEdit(r)}>Modifier</Button>
                {r.actif && (
                  <Button size="sm" variant="danger" onClick={() => handleDesactiver(r.id, r.reference)}>
                    Désact.
                  </Button>
                )}
              </div>
            )},
        ]}
      />

      <Pagination page={page} pages={pages} total={total} onPage={setPage} />

      {/* Modal création/édition */}
      {showModal && (
        <Modal
          title={editingId ? `Modifier ${form.reference}` : 'Nouvel article'}
          onClose={() => setShowModal(false)}
          width="640px"
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Référence" required>
              <Input value={form.reference} onChange={set('reference')} placeholder="MP-ACIER-001" required />
            </FormField>
            <FormField label="Type" required>
              <Select value={form.type} onChange={set('type')} options={ARTICLE_TYPES} />
            </FormField>
            <FormField label="Désignation" required>
              <Input value={form.designation} onChange={set('designation')} placeholder="Acier inoxydable 304" />
            </FormField>
            <FormField label="Unité de mesure" required>
              <Input value={form.uniteMesure} onChange={set('uniteMesure')} placeholder="kg, m, L, pce..." />
            </FormField>
            <FormField label="Famille">
              <Select value={form.familleId} onChange={set('familleId')}
                options={(familles || []).map((f: any) => ({ value: f.id, label: f.nom }))}
                placeholder="Sans famille" />
            </FormField>
            <FormField label="Niveau contrôle">
              <Select value={form.niveauControle} onChange={set('niveauControle')} options={NIVEAUX_CONTROLE} />
            </FormField>
            <FormField label="Stock mini">
              <Input value={form.stockMini} onChange={set('stockMini')} type="number" placeholder="0" />
            </FormField>
            <FormField label="Stock maxi">
              <Input value={form.stockMaxi} onChange={set('stockMaxi')} type="number" placeholder="optionnel" />
            </FormField>
            <FormField label="Délai réappro (jours)">
              <Input value={form.delaiReapproJours} onChange={set('delaiReapproJours')} type="number" placeholder="7" />
            </FormField>
            <FormField label="Prix achat std (€)">
              <Input value={form.prixAchatStd} onChange={set('prixAchatStd')} type="number" placeholder="0.00" />
            </FormField>
          </div>

          <FormField label="Gestion par lot">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.gestionParLot}
                onChange={e => setForm((f: any) => ({ ...f, gestionParLot: e.target.checked }))} />
              <span style={{ color: '#C4DCF0', fontSize: '0.875rem' }}>Activer la traçabilité par lot (FIFO/FEFO)</span>
            </label>
          </FormField>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button
              onClick={handleSubmit}
              disabled={createArticle.isPending || updateArticle.isPending}
            >
              {editingId ? 'Enregistrer' : 'Créer l\'article'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
