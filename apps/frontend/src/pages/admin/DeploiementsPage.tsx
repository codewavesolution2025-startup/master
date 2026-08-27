import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../store/auth.context';

// ── Types ─────────────────────────────────────────────────────
interface Deploiement {
  id: string;
  client_nom: string;
  client_secteur: string;
  client_ville: string;
  client_contact: string;
  client_email: string;
  client_tel: string;
  date_deploiement: string;
  statut: 'PILOTE' | 'ACTIF' | 'SUSPENDU' | 'RESILIE';
  modules_actifs: string[];
  nb_utilisateurs: number;
  formule: string;
  mrr: number;
  nps: number | null;
  derniere_connexion: string | null;
  nb_connexions_mois: number;
  convention_url: string | null;
  convention_signee: boolean;
  date_signature: string | null;
  notes: string;
}

interface Stats {
  total_clients: number;
  actifs: number;
  pilotes: number;
  suspendus: number;
  mrr_total: number;
  nps_moyen: number;
  total_utilisateurs: number;
  conventions_signees: number;
}

// ── Couleurs ──────────────────────────────────────────────────
const sc = {
  bg: '#080F1C', card: '#111E2E', surface: '#0D1929',
  border: 'rgba(79,195,247,0.10)', blue: '#4FC3F7',
  green: '#34D399', red: '#F87171', orange: '#FB923C',
  yellow: '#FCD34D', purple: '#A78BFA',
  text: '#E8F4FD', muted: '#4A6880', muted2: '#7A9AB5',
};

const STATUT_COLOR: Record<string, string> = {
  ACTIF: '#34D399', PILOTE: '#4FC3F7', SUSPENDU: '#FB923C', RESILIE: '#F87171',
};

const FORMULE_COLOR: Record<string, string> = {
  STARTER: '#7A9AB5', STANDARD: '#4FC3F7', PREMIUM: '#A78BFA',
};

const NPS_COLOR = (n: number | null) => {
  if (!n) return '#4A6880';
  if (n >= 9) return '#34D399';
  if (n >= 7) return '#FCD34D';
  return '#F87171';
};

// ── Helpers ───────────────────────────────────────────────────
const Badge = ({ label, color }: { label: string; color: string }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
    background: `${color}18`, color, textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  }}>{label}</span>
);

const KpiCard = ({ icon, label, value, unit = '', color = sc.blue, sub }: any) => (
  <div style={{
    background: sc.card, border: `1px solid ${sc.border}`,
    borderRadius: 10, padding: '14px 16px',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: sc.muted, textTransform: 'uppercase' as const, fontWeight: 600, letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 18 }}>{icon}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
      <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</span>
      {unit && <span style={{ fontSize: 12, color: sc.muted }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 11, color: sc.muted2, marginTop: 3 }}>{sub}</div>}
  </div>
);

// ── Page principale ───────────────────────────────────────────
export default function DeploiementsPage() {
  const { user } = useAuth();
  // Compte démo (LECTURE) : masque MRR, NPS, notes internes, PDF et création —
  // ne montre que la preuve de traction (client, statut, modules, convention signée).
  const readOnly = user?.role === 'LECTURE';
  const [deps, setDeps] = useState<Deploiement[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Deploiement | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_nom: '', client_secteur: '', client_ville: '',
    client_contact: '', client_email: '', client_tel: '',
    date_deploiement: new Date().toISOString().slice(0, 10),
    statut: 'PILOTE', formule: 'STARTER',
    nb_utilisateurs: '1', mrr: '0', notes: '',
    modules_actifs: [] as string[],
  });

  const ALL_MODULES = ['Stocks', 'Achats', 'Production', 'Qualité', 'Expéditions', 'RH', 'Reporting', 'Agent IA', 'Dashboard'];

  const fetchAll = useCallback(async () => {
    try {
      const [dRes, sRes] = await Promise.all([
        api.get('/admin/deploiements').then(r => r.data),
        api.get('/admin/deploiements/stats').then(r => r.data),
      ]);
      setDeps(Array.isArray(dRes) ? dRes : []);
      setStats(Array.isArray(sRes) ? sRes[0] : sRes);
      setLoading(false);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    try {
      await api.post('/admin/deploiements', {
        ...form,
        nb_utilisateurs: parseInt(form.nb_utilisateurs),
        mrr: parseFloat(form.mrr),
      });
      setShowCreate(false);
      fetchAll();
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleUploadConvention = async (id: string, file: File) => {
    setUploading(id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/admin/deploiements/${id}/convention`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchAll();
      if (selected?.id === id) {
        const updated = await api.get(`/admin/deploiements/${id}`).then(r => r.data);
        setSelected(updated);
      }
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur upload'); }
    setUploading(null);
  };

  const handleViewConvention = (id: string) => {
    // Passe par l'instance axios `api` (pas fetch()) pour bénéficier de
    // l'intercepteur qui rafraîchit automatiquement le token s'il a expiré —
    // sinon un token expiré (15 min) provoque un 401 sans jamais se rafraîchir.
    api.get(`/admin/deploiements/${id}/convention/download`, { responseType: 'blob' })
      .then(r => {
        const url = URL.createObjectURL(r.data);
        window.open(url, '_blank');
      }).catch(() => alert('Convention non disponible'));
  };

  const filtered = deps.filter(d =>
    !filter || d.client_nom.toLowerCase().includes(filter.toLowerCase()) ||
    d.client_secteur?.toLowerCase().includes(filter.toLowerCase())
  );

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${sc.border}`,
    borderRadius: 8, padding: '7px 11px', color: sc.text,
    fontFamily: 'inherit', fontSize: 13, width: '100%', outline: 'none',
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: sc.bg }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(79,195,247,0.15)', borderTopColor: sc.blue, animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100%', background: sc.bg, padding: '20px 24px', fontFamily: "'DM Sans', system-ui, sans-serif", color: sc.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Portefeuille Clients</h1>
          <div style={{ fontSize: 12, color: sc.muted, marginTop: 3 }}>Suivi des déploiements Supply Chain Industrielle</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={fetchAll} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${sc.border}`, background: 'rgba(79,195,247,0.06)', color: sc.blue, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>↻ Actualiser</button>
          {!readOnly && (
            <button onClick={() => setShowCreate(true)} style={{ padding: '7px 16px', background: sc.blue, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nouveau client</button>
          )}
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 16 }}>
          <KpiCard icon="🏭" label="Total clients" value={stats.total_clients} color={sc.blue} sub={`${stats.pilotes} pilotes`} />
          <KpiCard icon="✅" label="Clients actifs" value={stats.actifs} color={sc.green} sub="Contrats signés" />
          {!readOnly && (
            <KpiCard icon="💶" label="MRR Total" value={`${Number(stats.mrr_total).toLocaleString('fr-FR')}`} unit="DT/mois" color={sc.purple} />
          )}
          <KpiCard icon="👥" label="Utilisateurs" value={stats.total_utilisateurs} color={sc.blue} sub="Tous clients" />
          {!readOnly && (
            <KpiCard icon="⭐" label="NPS Moyen" value={Number(stats.nps_moyen).toFixed(1)} unit="/10" color={NPS_COLOR(stats.nps_moyen)} />
          )}
          <KpiCard icon="📄" label="Conventions" value={stats.conventions_signees} color={sc.green} sub={`/ ${stats.total_clients} clients`} />
        </div>
      )}

      {/* Filtre */}
      <div style={{ marginBottom: 14 }}>
        <input placeholder="🔍 Rechercher un client..." value={filter} onChange={e => setFilter(e.target.value)}
          style={{ ...inputStyle, maxWidth: 400 }} />
      </div>

      {/* Liste clients */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map(dep => (
          <div key={dep.id} style={{
            background: sc.card, border: `1px solid ${sc.border}`,
            borderRadius: 12, padding: 16, animation: 'fadeIn 0.2s ease',
            cursor: 'pointer', transition: 'border-color 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(79,195,247,0.25)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = sc.border)}
            onClick={() => setSelected(dep)}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              {/* Info client */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, background: `${STATUT_COLOR[dep.statut]}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800, color: STATUT_COLOR[dep.statut], flexShrink: 0,
                  }}>{dep.client_nom[0]}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: sc.text }}>{dep.client_nom}</div>
                    <div style={{ fontSize: 11, color: sc.muted2 }}>{dep.client_secteur} · {dep.client_ville}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginLeft: 8 }}>
                    <Badge label={dep.statut} color={STATUT_COLOR[dep.statut]} />
                    <Badge label={dep.formule} color={FORMULE_COLOR[dep.formule] || sc.blue} />
                  </div>
                </div>

                {/* Modules */}
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 8 }}>
                  {dep.modules_actifs.map(m => (
                    <span key={m} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(79,195,247,0.08)', color: sc.blue, fontWeight: 600 }}>{m}</span>
                  ))}
                </div>

                {/* Métriques */}
                <div style={{ display: 'flex', gap: 20, fontSize: 11, color: sc.muted2 }}>
                  <span>📅 Déployé le {new Date(dep.date_deploiement).toLocaleDateString('fr-FR')}</span>
                  <span>👥 {dep.nb_utilisateurs} utilisateur(s)</span>
                  <span>🔗 {dep.nb_connexions_mois} connexions/mois</span>
                  {dep.derniere_connexion && (
                    <span>⏱ Dernière : {new Date(dep.derniere_connexion).toLocaleDateString('fr-FR')}</span>
                  )}
                  {!readOnly && dep.nps !== null && (
                    <span style={{ color: NPS_COLOR(dep.nps), fontWeight: 700 }}>⭐ NPS {dep.nps}/10</span>
                  )}
                </div>
              </div>

              {/* Droite : MRR + Convention */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                {!readOnly && (
                  <div style={{ fontSize: 18, fontWeight: 800, color: sc.purple }}>
                    {Number(dep.mrr).toLocaleString('fr-FR')} DT
                    <span style={{ fontSize: 10, color: sc.muted, fontWeight: 400 }}>/mois</span>
                  </div>
                )}

                {/* Convention */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {dep.convention_signee && dep.convention_url ? (
                    <>
                      <span style={{ fontSize: 10, color: sc.green, fontWeight: 600 }}>✅ Convention signée</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleViewConvention(dep.id); }}
                        style={{ padding: '3px 10px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 6, color: sc.green, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >📄 Voir PDF</button>
                    </>
                  ) : dep.convention_signee ? (
                    <span style={{ fontSize: 10, color: sc.green, fontWeight: 600 }}>✅ Signée (pas de PDF)</span>
                  ) : (
                    <span style={{ fontSize: 10, color: sc.orange, fontWeight: 600 }}>⏳ Convention en attente</span>
                  )}

                  {/* Upload convention */}
                  {!readOnly && (
                    <button
                      onClick={e => { e.stopPropagation(); setUploadTarget(dep.id); fileRef.current?.click(); }}
                      disabled={uploading === dep.id}
                      style={{ padding: '3px 10px', background: 'rgba(79,195,247,0.08)', border: `1px solid ${sc.border}`, borderRadius: 6, color: sc.blue, fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >{uploading === dep.id ? '⏳' : '⬆ Upload PDF'}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input fichier caché */}
      <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && uploadTarget) handleUploadConvention(uploadTarget, file);
          e.target.value = '';
        }}
      />

      {/* Modal détail client */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: sc.card, border: `1px solid ${sc.border}`, borderRadius: 14, padding: 24, width: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: sc.text, margin: 0 }}>{selected.client_nom}</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: sc.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                ['Secteur', selected.client_secteur],
                ['Ville', selected.client_ville],
                ['Contact', selected.client_contact],
                ['Email', selected.client_email],
                ['Téléphone', selected.client_tel],
                ['Date déploiement', new Date(selected.date_deploiement).toLocaleDateString('fr-FR')],
                ['Formule', selected.formule],
                ...(readOnly ? [] : [['MRR', `${Number(selected.mrr).toLocaleString('fr-FR')} DT/mois`]]),
                ['Utilisateurs', String(selected.nb_utilisateurs)],
                ...(readOnly ? [] : [['NPS', selected.nps ? `${selected.nps}/10` : '—']]),
                ['Connexions/mois', String(selected.nb_connexions_mois)],
                ['Convention signée', selected.convention_signee ? `✅ Oui (${selected.date_signature ? new Date(selected.date_signature).toLocaleDateString('fr-FR') : ''})` : '⏳ Non'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: sc.muted, textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontWeight: 600, marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 13, color: sc.text }}>{v || '—'}</div>
                </div>
              ))}
            </div>

            {/* Modules */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: sc.muted, textTransform: 'uppercase' as const, fontWeight: 600, marginBottom: 8 }}>Modules activés</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {selected.modules_actifs.map(m => (
                  <span key={m} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, background: 'rgba(79,195,247,0.08)', color: sc.blue, fontWeight: 600 }}>{m}</span>
                ))}
              </div>
            </div>

            {/* Notes — internes, jamais montrées au compte démo */}
            {!readOnly && selected.notes && (
              <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: sc.muted, textTransform: 'uppercase' as const, fontWeight: 600, marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 12, color: sc.muted2, lineHeight: 1.6 }}>{selected.notes}</div>
              </div>
            )}

            {/* Actions convention — visualisation ouverte à tous, upload réservé (non démo) */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              {selected.convention_url && (
                <button onClick={() => handleViewConvention(selected.id)} style={{ padding: '7px 16px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 8, color: sc.green, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  📄 Voir convention PDF
                </button>
              )}
              {!readOnly && (
                <button onClick={() => { setUploadTarget(selected.id); fileRef.current?.click(); }} style={{ padding: '7px 16px', background: 'rgba(79,195,247,0.08)', border: `1px solid ${sc.border}`, borderRadius: 8, color: sc.blue, fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ⬆ {selected.convention_url ? 'Remplacer' : 'Uploader'} convention PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal création */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: sc.card, border: `1px solid ${sc.border}`, borderRadius: 14, padding: 24, width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: sc.text, margin: 0 }}>Nouveau déploiement client</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: sc.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { key: 'client_nom', label: 'Nom client *' },
                { key: 'client_secteur', label: 'Secteur' },
                { key: 'client_ville', label: 'Ville' },
                { key: 'client_contact', label: 'Contact' },
                { key: 'client_email', label: 'Email' },
                { key: 'client_tel', label: 'Téléphone' },
                { key: 'date_deploiement', label: 'Date déploiement', type: 'date' },
                { key: 'nb_utilisateurs', label: 'Nb utilisateurs', type: 'number' },
                { key: 'mrr', label: 'MRR (DT/mois)', type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 5, fontWeight: 600 }}>{label}</div>
                  <input type={type || 'text'} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}

              <div>
                <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase' as const, marginBottom: 5, fontWeight: 600 }}>Statut</div>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {['PILOTE', 'ACTIF', 'SUSPENDU', 'RESILIE'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase' as const, marginBottom: 5, fontWeight: 600 }}>Formule</div>
                <select value={form.formule} onChange={e => setForm(f => ({ ...f, formule: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {['STARTER', 'STANDARD', 'PREMIUM'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* Modules */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase' as const, marginBottom: 8, fontWeight: 600 }}>Modules activés</div>
              <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                {ALL_MODULES.map(m => (
                  <button key={m} onClick={() => setForm(f => ({
                    ...f,
                    modules_actifs: f.modules_actifs.includes(m)
                      ? f.modules_actifs.filter(x => x !== m)
                      : [...f.modules_actifs, m],
                  }))} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: form.modules_actifs.includes(m) ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${form.modules_actifs.includes(m) ? sc.blue : sc.border}`,
                    color: form.modules_actifs.includes(m) ? sc.blue : sc.muted2,
                  }}>{m}</button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase' as const, marginBottom: 5, fontWeight: 600 }}>Notes</div>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3} style={{ ...inputStyle, resize: 'vertical' as const }} />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '7px 16px', background: 'none', border: `1px solid ${sc.border}`, borderRadius: 8, color: sc.muted2, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={handleCreate} style={{ padding: '7px 16px', background: sc.blue, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
