import { useState } from 'react';
import {
  useSites, useClients, usePostesCharge,
  useCreateSite, useCreateClient, useUpdateClient, useCreatePosteCharge,
  useCreateEmplacement,
} from '../../hooks/useReferentiels';
import { Table, Badge, Button, Modal, SearchInput, Select, FormField, Input } from '../../components/ui';

const ZONES = [
  { value: 'RECEPTION', label: 'Réception' },
  { value: 'MP', label: 'Matières premières' },
  { value: 'PF', label: 'Produits finis' },
  { value: 'QUARANTAINE', label: 'Quarantaine' },
];

const ZONE_VARIANTS: Record<string, any> = {
  RECEPTION: 'info', MP: 'neutral', PF: 'success', QUARANTAINE: 'warning',
};

// ── Sites ─────────────────────────────────────────────────────────────────────
export function SitesPage() {
  const { data: sites, isLoading } = useSites();
  const [showModal, setShowModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState<any>(null);
  const [showEmpModal, setShowEmpModal] = useState(false);
  const [form, setForm] = useState({ code: '', nom: '', adresse: '', ville: '', pays: 'France' });
  const [empForm, setEmpForm] = useState({ code: '', zone: 'MP', description: '', capacite: '' });

  const createSite = useCreateSite();
  const createEmp = useCreateEmplacement(selectedSite?.id || '');

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const setEmp = (k: string) => (v: string) => setEmpForm(f => ({ ...f, [k]: v }));

  const handleCreateSite = async () => {
    try {
      await createSite.mutateAsync(form);
      setShowModal(false);
      setForm({ code: '', nom: '', adresse: '', ville: '', pays: 'France' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleCreateEmp = async () => {
    try {
      await createEmp.mutateAsync({ ...empForm, capacite: empForm.capacite ? Number(empForm.capacite) : undefined });
      setShowEmpModal(false);
      setEmpForm({ code: '', zone: 'MP', description: '', capacite: '' });
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sites & Emplacements</h1>
          <p className="page-subtitle">{(sites || []).length} sites</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nouveau site</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {(sites || []).map((site: any) => (
          <div key={site.id} style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(79,195,247,0.08)',
            borderRadius: '12px', overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              borderBottom: '1px solid rgba(79,195,247,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontWeight: 700 }}>{site.code}</span>
                <span style={{ color: '#C4DCF0' }}>{site.nom}</span>
                {site.ville && <span style={{ color: '#3A6278', fontSize: '0.82rem' }}>📍 {site.ville}</span>}
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setSelectedSite(site); setShowEmpModal(true); }}>
                + Emplacement
              </Button>
            </div>
            {/* Emplacements */}
            <div style={{ padding: '12px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(site.emplacements || []).length === 0 ? (
                <span style={{ color: '#2D4A5E', fontSize: '0.82rem' }}>Aucun emplacement</span>
              ) : (site.emplacements || []).map((emp: any) => (
                <div key={emp.id} style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px 12px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontFamily: 'monospace', color: '#C4DCF0', fontSize: '0.82rem' }}>{emp.code}</span>
                  <Badge variant={ZONE_VARIANTS[emp.zone] || 'neutral'}>{emp.zone}</Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title="Nouveau site" onClose={() => setShowModal(false)}>
          <FormField label="Code" required><Input value={form.code} onChange={set('code')} placeholder="USINE-A" /></FormField>
          <FormField label="Nom" required><Input value={form.nom} onChange={set('nom')} placeholder="Usine principale Paris" /></FormField>
          <FormField label="Adresse"><Input value={form.adresse} onChange={set('adresse')} placeholder="12 rue de l'industrie" /></FormField>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Ville"><Input value={form.ville} onChange={set('ville')} placeholder="Paris" /></FormField>
            <FormField label="Pays"><Input value={form.pays} onChange={set('pays')} placeholder="France" /></FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleCreateSite}>Créer le site</Button>
          </div>
        </Modal>
      )}

      {showEmpModal && selectedSite && (
        <Modal title={`Emplacement — ${selectedSite.nom}`} onClose={() => setShowEmpModal(false)}>
          <FormField label="Code emplacement" required>
            <Input value={empForm.code} onChange={setEmp('code')} placeholder="A-R03-N2" />
          </FormField>
          <FormField label="Zone" required>
            <Select value={empForm.zone} onChange={setEmp('zone')} options={ZONES} />
          </FormField>
          <FormField label="Description"><Input value={empForm.description} onChange={setEmp('description')} /></FormField>
          <FormField label="Capacité (m³)"><Input value={empForm.capacite} onChange={setEmp('capacite')} type="number" placeholder="optionnel" /></FormField>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" onClick={() => setShowEmpModal(false)}>Annuler</Button>
            <Button onClick={handleCreateEmp}>Créer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Clients ───────────────────────────────────────────────────────────────────
export function ClientsPage() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '', raisonSociale: '', siret: '', ville: '', pays: 'France', email: '', telephone: '', delaiPaiement: 30,
  });

  const { data: clients, isLoading } = useClients({ search: search || undefined });
  const createClient = useCreateClient();
  const updateClient = useUpdateClient(editingId || '');

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    try {
      const payload = { ...form, delaiPaiement: Number(form.delaiPaiement) };
      editingId ? await updateClient.mutateAsync(payload) : await createClient.mutateAsync(payload);
      setShowModal(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{(clients || []).length} clients</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm({ code: '', raisonSociale: '', siret: '', ville: '', pays: 'France', email: '', telephone: '', delaiPaiement: 30 }); setShowModal(true); }}>
          + Nouveau client
        </Button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Code, raison sociale..." />
      <div style={{ marginTop: '16px' }}>
        <Table loading={isLoading} data={clients || []} emptyText="Aucun client"
          columns={[
            { key: 'code', header: 'Code', width: '120px', render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.code}</span> },
            { key: 'raisonSociale', header: 'Raison sociale' },
            { key: 'ville', header: 'Ville', width: '120px', render: r => <span style={{ color: '#5A7A90' }}>{r.ville || '—'}</span> },
            { key: 'email', header: 'Email', render: r => <span style={{ color: '#5A7A90', fontSize: '0.82rem' }}>{r.email || '—'}</span> },
            { key: 'delaiPaiement', header: 'Délai pmt', width: '90px', render: r => <span style={{ color: '#5A7A90' }}>{r.delaiPaiement}j</span> },
            { key: 'actif', header: 'Statut', width: '80px', render: r => r.actif ? <Badge variant="success">Actif</Badge> : <Badge variant="neutral">Inactif</Badge> },
            { key: 'actions', header: '', width: '80px', render: r => <Button size="sm" variant="secondary" onClick={() => { setEditingId(r.id); setForm(r); setShowModal(true); }}>Modifier</Button> },
          ]}
        />
      </div>

      {showModal && (
        <Modal title={editingId ? 'Modifier client' : 'Nouveau client'} onClose={() => setShowModal(false)} width="580px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Code" required><Input value={form.code} onChange={set('code')} placeholder="CLI-001" /></FormField>
            <FormField label="SIRET"><Input value={form.siret} onChange={set('siret')} placeholder="14 chiffres" /></FormField>
            <div style={{ gridColumn: '1 / -1' }}>
              <FormField label="Raison sociale" required><Input value={form.raisonSociale} onChange={set('raisonSociale')} placeholder="Renault SAS" /></FormField>
            </div>
            <FormField label="Email"><Input value={form.email} onChange={set('email')} type="email" /></FormField>
            <FormField label="Téléphone"><Input value={form.telephone} onChange={set('telephone')} /></FormField>
            <FormField label="Ville"><Input value={form.ville} onChange={set('ville')} /></FormField>
            <FormField label="Délai paiement (j)"><Input value={form.delaiPaiement} onChange={set('delaiPaiement')} type="number" /></FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleSubmit}>{editingId ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Postes de charge ──────────────────────────────────────────────────────────
export function PostesChargePage() {
  const { data: sites } = useSites();
  const [siteFilter, setSiteFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', libelle: '', type: 'MACHINE', siteId: '', capaciteHJour: 8, coutHoraire: 0, tauxRendement: 85 });

  const { data: postes, isLoading } = usePostesCharge(siteFilter || undefined);
  const createPoste = useCreatePosteCharge();
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    try {
      await createPoste.mutateAsync({
        ...form,
        capaciteHJour: Number(form.capaciteHJour),
        coutHoraire: Number(form.coutHoraire),
        tauxRendement: Number(form.tauxRendement),
      });
      setShowModal(false);
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const siteOptions = (sites || []).map((s: any) => ({ value: s.id, label: `${s.code} — ${s.nom}` }));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Postes de charge</h1>
          <p className="page-subtitle">Machines et centres de travail</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nouveau poste</Button>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <Select value={siteFilter} onChange={setSiteFilter} options={siteOptions} placeholder="Tous les sites" />
      </div>

      <Table loading={isLoading} data={postes || []} emptyText="Aucun poste de charge"
        columns={[
          { key: 'code', header: 'Code', width: '120px', render: r => <span style={{ fontFamily: 'monospace', color: '#4FC3F7', fontSize: '0.82rem' }}>{r.code}</span> },
          { key: 'libelle', header: 'Libellé' },
          { key: 'type', header: 'Type', width: '120px', render: r => <Badge variant={r.type === 'MACHINE' ? 'info' : r.type === 'MOD' ? 'accent' : 'neutral'}>{r.type}</Badge> },
          { key: 'capaciteHJour', header: 'Capacité', width: '100px', render: r => <span style={{ color: '#5A7A90' }}>{r.capaciteHJour}h/j</span> },
          { key: 'coutHoraire', header: 'Coût/h', width: '90px', render: r => `${Number(r.coutHoraire).toFixed(2)} €` },
          { key: 'tauxRendement', header: 'TRS cible', width: '90px', render: r => {
            const v = Number(r.tauxRendement);
            return <Badge variant={v >= 85 ? 'success' : v >= 70 ? 'warning' : 'danger'}>{v}%</Badge>;
          }},
          { key: 'actif', header: 'Statut', width: '80px', render: r => r.actif ? <Badge variant="success">Actif</Badge> : <Badge variant="neutral">Inactif</Badge> },
        ]}
      />

      {showModal && (
        <Modal title="Nouveau poste de charge" onClose={() => setShowModal(false)} width="580px">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <FormField label="Code" required><Input value={form.code} onChange={set('code')} placeholder="TOUR-001" /></FormField>
            <FormField label="Type">
              <Select value={form.type} onChange={set('type')} options={[
                { value: 'MACHINE', label: 'Machine' },
                { value: 'MOD', label: 'Main d\'œuvre' },
                { value: 'SOUS_TRAITANCE', label: 'Sous-traitance' },
              ]} />
            </FormField>
            <div style={{ gridColumn: '1 / -1' }}>
              <FormField label="Libellé" required><Input value={form.libelle} onChange={set('libelle')} placeholder="Tour CNC n°1" /></FormField>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <FormField label="Site" required><Select value={form.siteId} onChange={set('siteId')} options={siteOptions} placeholder="Sélectionner un site" /></FormField>
            </div>
            <FormField label="Capacité (h/jour)"><Input value={form.capaciteHJour} onChange={set('capaciteHJour')} type="number" /></FormField>
            <FormField label="Coût horaire (€)"><Input value={form.coutHoraire} onChange={set('coutHoraire')} type="number" /></FormField>
            <FormField label="TRS cible (%)"><Input value={form.tauxRendement} onChange={set('tauxRendement')} type="number" /></FormField>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button variant="ghost" onClick={() => setShowModal(false)}>Annuler</Button>
            <Button onClick={handleSubmit}>Créer</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
