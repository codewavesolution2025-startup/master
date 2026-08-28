import { useState } from 'react';
import {
  useFournisseurs, useCreateFournisseur, useUpdateFournisseur, useScoreFournisseur,
} from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, SearchInput, Select, FormField, Input } from '../../components/ui';
import api from '../../services/api';
import { useQuery } from '@tanstack/react-query';

const STATUTS = [
  { value: 'ACTIF', label: 'Actif' },
  { value: 'EVALUATION', label: 'En évaluation' },
  { value: 'BLOQUE', label: 'Bloqué' },
  { value: 'OBSOLETE', label: 'Obsolète' },
];

const STATUT_VARIANTS: Record<string, any> = {
  ACTIF: 'success', EVALUATION: 'warning', BLOQUE: 'danger', OBSOLETE: 'neutral',
};

const NIVEAU_VARIANTS: Record<string, any> = {
  PREFERE: 'success', STANDARD: 'info', SURVEILLANCE: 'warning', BLOQUE: 'danger',
};

const emptyForm = {
  code: '', raisonSociale: '', siret: '',
  adresseFact: '', villeFact: '', cpFact: '', paysFact: 'France',
  delaiPaiement: 30, modePaiement: 'VIREMENT', statut: 'ACTIF',
};

// Jauge score qualité
function ScoreJauge({ score }: { score: number }) {
  const color = score >= 90 ? '#4ADE80' : score >= 70 ? '#4FC3F7' : score >= 50 ? '#FCD34D' : '#FCA5A5';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{
        width: '80px', height: '6px', background: 'rgba(255,255,255,0.06)',
        borderRadius: '3px', overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, score)}%`, height: '100%',
          background: color, borderRadius: '3px',
          transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ color, fontWeight: 700, fontSize: '0.82rem' }}>{score.toFixed(0)}</span>
    </div>
  );
}

// Fiche détail fournisseur
function FournisseurDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: four } = useQuery({
    queryKey: ['fournisseurs', id],
    queryFn: () => api.get(`/fournisseurs/${id}`).then(r => r.data),
  });
  const { data: score } = useScoreFournisseur(id);
  const { data: contacts } = useQuery({
    queryKey: ['fournisseurs', id, 'contacts'],
    queryFn: () => api.get(`/fournisseurs/${id}/contacts`).then(r => r.data),
  });
  const { data: catalogue } = useQuery({
    queryKey: ['fournisseurs', id, 'catalogue'],
    queryFn: () => api.get(`/fournisseurs/${id}/catalogue`).then(r => r.data),
  });

  const [tab, setTab] = useState<'infos' | 'contacts' | 'catalogue' | 'score'>('infos');

  if (!four) return null;

  return (
    <Modal title={`${four.code} — ${four.raisonSociale}`} onClose={onClose} width="700px">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid rgba(79,195,247,0.08)', paddingBottom: '12px' }}>
        {(['infos', 'contacts', 'catalogue', 'score'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '6px 14px', borderRadius: '6px', border: 'none',
            background: tab === t ? 'rgba(79,195,247,0.12)' : 'transparent',
            color: tab === t ? '#4FC3F7' : '#5A7A90',
            cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
            textTransform: 'capitalize', fontFamily: 'inherit',
          }}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'infos' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {[
            ['Code', four.code], ['SIRET', four.siret || '—'],
            ['Statut', four.statut], ['Score qualité', `${four.scoreQualite}/100`],
            ['Délai paiement', `${four.delaiPaiement} jours`], ['Mode paiement', four.modePaiement],
            ['Ville', four.villeFact || '—'], ['Pays', four.paysFact],
          ].map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ color: '#3A6278', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{k}</div>
              <div style={{ color: '#C4DCF0', fontSize: '0.9rem' }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'contacts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(contacts || []).length === 0 ? (
            <p style={{ color: '#2D4A5E', textAlign: 'center', padding: '20px' }}>Aucun contact</p>
          ) : (contacts || []).map((c: any) => (
            <div key={c.id} style={{
              background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '14px',
              border: c.principal ? '1px solid rgba(79,195,247,0.2)' : '1px solid transparent',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#C4DCF0', fontWeight: 600 }}>{c.prenom} {c.nom}</span>
                  {c.principal && <Badge variant="info" style={{ marginLeft: '8px' }}>Principal</Badge>}
                </div>
                <Badge variant="neutral">{c.role}</Badge>
              </div>
              <div style={{ color: '#5A7A90', fontSize: '0.82rem', marginTop: '6px' }}>
                {c.email && <span>{c.email}</span>}
                {c.telephone && <span style={{ marginLeft: '12px' }}>📞 {c.telephone}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'catalogue' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {(catalogue || []).length === 0 ? (
            <p style={{ color: '#2D4A5E', textAlign: 'center', padding: '20px' }}>Aucun article au catalogue</p>
          ) : (catalogue || []).map((c: any) => (
            <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ color: '#4FC3F7', fontFamily: 'monospace', fontSize: '0.82rem' }}>{c.article?.reference}</span>
                  <span style={{ color: '#C4DCF0', marginLeft: '10px' }}>{c.article?.designation}</span>
                </div>
                <span style={{ color: '#4ADE80', fontWeight: 700 }}>{Number(c.prixUnitaire).toFixed(2)} €/{c.article?.uniteMesure}</span>
              </div>
              {c.paliers?.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {c.paliers.map((p: any) => (
                    <span key={p.id} style={{ background: 'rgba(74,222,128,0.08)', color: '#4ADE80', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px' }}>
                      ≥{p.quantiteMin}: {Number(p.prixUnitaire).toFixed(2)} €
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'score' && score && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Score global', value: `${score.scoreGlobal}/100`, color: score.scoreGlobal >= 90 ? '#4ADE80' : score.scoreGlobal >= 70 ? '#4FC3F7' : '#FCA5A5' },
              { label: 'OTD (30%)', value: `${score.otd}%`, color: '#4FC3F7' },
              { label: 'Qualité (70%)', value: `${score.tauxQualite}%`, color: '#4FC3F7' },
            ].map(item => (
              <div key={item.label} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: '#3A6278', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>{item.label}</div>
                <div style={{ color: item.color, fontSize: '1.8rem', fontWeight: 800 }}>{item.value}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ color: '#3A6278', fontSize: '0.78rem', marginBottom: '8px' }}>Niveau · {score.periode}</div>
            <Badge variant={NIVEAU_VARIANTS[score.niveau] || 'neutral'}>{score.niveau}</Badge>
            <div style={{ marginTop: '12px', color: '#5A7A90', fontSize: '0.82rem' }}>
              {score.totalLivraisons} livraisons · {score.nbNonConformites} NC de réception
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function FournisseursPage() {
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);

  const { data: fournisseurs, isLoading } = useFournisseurs({
    search: search || undefined,
    statut: statutFilter || undefined,
  });

  const createFour = useCreateFournisseur();
  const updateFour = useUpdateFournisseur(editingId || '');

  const set = (k: string) => (v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = { ...form, delaiPaiement: Number(form.delaiPaiement) };
      if (editingId) {
        await updateFour.mutateAsync(payload);
      } else {
        await createFour.mutateAsync(payload);
      }
      setShowModal(false);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fournisseurs</h1>
          <p className="page-subtitle">{(fournisseurs || []).length} fournisseurs</p>
        </div>
        <Button onClick={openCreate}>+ Nouveau fournisseur</Button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Code, raison sociale..." />
        <Select value={statutFilter} onChange={setStatutFilter} options={STATUTS} placeholder="Tous les statuts" />
      </div>

      <Table<any>
        loading={isLoading}
        data={fournisseurs || []}
        emptyText="Aucun fournisseur"
        onRowClick={r => setDetailId(r.id)}
        columns={[
          { key: 'code', header: 'Code', width: '120px',
            render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.code}</span> },
          { key: 'raisonSociale', header: 'Raison sociale' },
          { key: 'villeFact', header: 'Ville', width: '120px',
            render: r => <span style={{ color: '#5A7A90' }}>{r.villeFact || '—'}</span> },
          { key: 'statut', header: 'Statut', width: '110px',
            render: r => <Badge variant={STATUT_VARIANTS[r.statut]}>{r.statut}</Badge> },
          { key: 'scoreQualite', header: 'Score qualité', width: '160px',
            render: r => <ScoreJauge score={Number(r.scoreQualite)} /> },
          { key: 'delaiPaiement', header: 'Délai pmt', width: '90px',
            render: r => <span style={{ color: '#5A7A90' }}>{r.delaiPaiement}j</span> },
          { key: 'actions', header: '', width: '80px',
            render: r => (
              <Button size="sm" variant="secondary" onClick={e => { e.stopPropagation(); setDetailId(r.id); }}>
                Détail
              </Button>
            )},
        ]}
      />

      {/* Modal création */}
      {showModal && (
        <Modal title="Nouveau fournisseur" onClose={() => setShowModal(false)} width="620px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Code" required><Input value={form.code} onChange={set('code')} placeholder="FOUR-001" /></FormField>
            <FormField label="Statut"><Select value={form.statut} onChange={set('statut')} options={STATUTS} /></FormField>
            <div style={{ gridColumn: '1 / -1' }}>
              <FormField label="Raison sociale" required><Input value={form.raisonSociale} onChange={set('raisonSociale')} placeholder="Aciers du Nord SAS" /></FormField>
            </div>
            <FormField label="SIRET (14 chiffres)"><Input value={form.siret} onChange={set('siret')} placeholder="12345678901234" /></FormField>
            <FormField label="Ville"><Input value={form.villeFact} onChange={set('villeFact')} placeholder="Paris" /></FormField>
            <FormField label="Code postal"><Input value={form.cpFact} onChange={set('cpFact')} placeholder="75001" /></FormField>
            <FormField label="Pays"><Input value={form.paysFact} onChange={set('paysFact')} placeholder="France" /></FormField>
            <FormField label="Délai paiement (jours)"><Input value={form.delaiPaiement} onChange={set('delaiPaiement')} type="number" /></FormField>
            <FormField label="Mode paiement">
              <Select value={form.modePaiement} onChange={set('modePaiement')}
                options={[
                  { value: 'VIREMENT', label: 'Virement' },
                  { value: 'CHEQUE', label: 'Chèque' },
                  { value: 'PRELEVEMENT', label: 'Prélèvement' },
                ]} />
            </FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={createFour.isPending}>Créer</Button>
          </div>
        </Modal>
      )}

      {/* Fiche détail */}
      {detailId && <FournisseurDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
