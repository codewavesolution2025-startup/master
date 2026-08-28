import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// ── Types ─────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: '📊 Dashboard RH' },
  { id: 'employes', label: '👥 Employés' },
  { id: 'presences', label: '🕐 Présences' },
  { id: 'conges', label: '🏖️ Congés' },
  { id: 'competences', label: '🎯 Compétences' },
  { id: 'formations', label: '📚 Formations' },
  { id: 'paie', label: '💶 Fiches de paie' },
  { id: 'couts', label: '💰 Coûts MO' },
];

const CONTRAT_COLORS: Record<string, string> = {
  CDI: '#34D399', CDD: '#FCD34D', INTERIM: '#FB923C',
  APPRENTISSAGE: '#A78BFA', STAGE: '#4FC3F7',
};
const STATUT_COLORS: Record<string, string> = {
  EN_ATTENTE: '#FCD34D', APPROUVE: '#34D399', REFUSE: '#F87171', ANNULE: '#4A6880',
  ACTIF: '#34D399', INACTIF: '#4A6880', BROUILLON: '#FCD34D', VALIDEE: '#34D399',
  PLANIFIEE: '#4FC3F7', TERMINEE: '#34D399',
};
const sc = {
  bg: '#080F1C', card: '#111E2E', border: 'rgba(79,195,247,0.10)',
  text: '#E8F4FD', muted: '#4A6880', muted2: '#7A9AB5', blue: '#4FC3F7',
};

const Card = ({ children, style = {} }: any) => (
  <div style={{ background: sc.card, border: `1px solid ${sc.border}`, borderRadius: 12, padding: 16, ...style }}>
    {children}
  </div>
);

const Badge = ({ label, color }: { label: string; color?: string }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
    background: `${color || sc.blue}18`, color: color || sc.blue,
    textTransform: 'uppercase', whiteSpace: 'nowrap',
  }}>{label}</span>
);

const KpiCard = ({ icon, label, value, unit = '', sub, color = sc.blue }: any) => (
  <Card>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 10, color: sc.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 18 }}>{icon}</span>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 6 }}>
      <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value ?? '—'}</span>
      {unit && <span style={{ fontSize: 12, color: sc.muted }}>{unit}</span>}
    </div>
    {sub && <div style={{ fontSize: 11, color: sc.muted2, marginTop: 4 }}>{sub}</div>}
  </Card>
);

const SectionTitle = ({ children, tag }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
    <h2 style={{ fontSize: 11, fontWeight: 700, color: sc.text, textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>{children}</h2>
    {tag && <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'rgba(79,195,247,0.08)', color: sc.blue, border: `1px solid rgba(79,195,247,0.15)` }}>{tag}</span>}
  </div>
);

// ── Dashboard ─────────────────────────────────────────────────
function DashboardRH({ kpis }: { kpis: any }) {
  if (!kpis) return null;
  const { effectif, couts, conges, formations, presences } = kpis;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        <KpiCard icon="👥" label="Effectif actif" value={effectif?.actifs} sub={`${effectif?.nb_services} services`} color={sc.blue} />
        <KpiCard icon="📋" label="CDI" value={effectif?.cdi} sub={`${effectif?.cdd} CDD · ${effectif?.interim} Intérim`} color="#34D399" />
        <KpiCard icon="💶" label="Masse salariale" value={couts?.masse_salariale ? `${Number(couts.masse_salariale).toLocaleString('fr-FR')}` : '—'} unit="€/mois" color="#A78BFA" />
        <KpiCard icon="💰" label="Coût total MO" value={couts?.cout_mo_mois ? `${Number(couts.cout_mo_mois).toLocaleString('fr-FR')}` : '—'} unit="€/mois" color="#F87171" sub={`Moy. ${Number(couts?.cout_mo_moyen || 0).toFixed(0)}€/pers`} />
        <KpiCard icon="🏖️" label="Congés en attente" value={conges?.en_attente} sub={`${conges?.a_venir} à venir`} color="#FCD34D" />
        <KpiCard icon="📚" label="Formations" value={formations?.total} sub={`${formations?.planifiees} planifiées · ${Number(formations?.cout_total || 0).toFixed(0)}€`} color="#4FC3F7" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Card>
          <SectionTitle>Répartition par type de contrat</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'CDI', val: parseInt(effectif?.cdi) || 0, color: '#34D399' },
              { label: 'CDD', val: parseInt(effectif?.cdd) || 0, color: '#FCD34D' },
              { label: 'Intérim', val: parseInt(effectif?.interim) || 0, color: '#FB923C' },
              { label: 'Apprentissage', val: parseInt(effectif?.apprentis) || 0, color: '#A78BFA' },
            ].map(item => {
              const total = parseInt(effectif?.actifs) || 1;
              const pct = Math.round((item.val / total) * 100);
              return (
                <div key={item.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: sc.text }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: sc.muted2 }}>{item.val} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3 }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: item.color, borderRadius: 3, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <SectionTitle>Indicateurs RH clés</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Âge moyen', value: `${effectif?.age_moyen || '—'} ans`, icon: '🎂' },
              { label: 'Heures sup (30j)', value: `${Number(presences?.total_heures_sup || 0).toFixed(1)} h`, icon: '⏰' },
              { label: 'Employés présents (30j)', value: presences?.employes_presents || '—', icon: '✅' },
              { label: 'Jours congés pris (année)', value: `${Number(conges?.jours_pris_annee || 0).toFixed(0)} jours`, icon: '📅' },
              { label: 'Charges patronales', value: `${Number(couts?.charges_totales || 0).toLocaleString('fr-FR')} €`, icon: '🏛️' },
              { label: 'Coût moyen/employé', value: `${Number(couts?.cout_mo_moyen || 0).toFixed(0)} €`, icon: '💼' },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid rgba(79,195,247,0.04)` }}>
                <span style={{ fontSize: 12, color: sc.muted2 }}>{icon} {label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: sc.text }}>{value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ── Employés ──────────────────────────────────────────────────
function EmployesTab({ employes, onSelect, showCreate, setShowCreate, onRefresh }: any) {
  const [form, setForm] = useState<any>({
    matricule: '', nom: '', prenom: '', email: '', poste: '', service: '',
    date_embauche: new Date().toISOString().slice(0, 10),
    taux_horaire: '', nb_heures_semaine: '35', type_contrat: 'CDI',
    cout_charges_pct: '45',
  });
  const [search, setSearch] = useState('');

  const filtered = employes.filter((e: any) =>
    !search || `${e.nom} ${e.prenom} ${e.matricule} ${e.poste}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    try {
      await api.post('/rh/employes', { ...form, taux_horaire: parseFloat(form.taux_horaire) });
      setShowCreate(false);
      onRefresh();
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${sc.border}`,
    borderRadius: 8, padding: '7px 11px', color: sc.text, fontFamily: 'inherit',
    fontSize: 13, width: '100%', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <input placeholder="🔍 Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, flex: 1 }} />
        <button onClick={() => setShowCreate(true)} style={{
          padding: '7px 16px', background: sc.blue, border: 'none', borderRadius: 8,
          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>+ Nouvel employé</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {filtered.map((e: any) => (
          <div key={e.id} onClick={() => onSelect(e.id)} style={{
            background: sc.card, border: `1px solid ${sc.border}`, borderRadius: 12,
            padding: 16, cursor: 'pointer', transition: 'border-color 0.15s',
          }}
            onMouseEnter={el => (el.currentTarget.style.borderColor = 'rgba(79,195,247,0.3)')}
            onMouseLeave={el => (el.currentTarget.style.borderColor = sc.border)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: `rgba(79,195,247,0.15)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 800, color: sc.blue, flexShrink: 0,
              }}>{e.prenom[0]}{e.nom[0]}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Badge label={e.type_contrat} color={CONTRAT_COLORS[e.type_contrat]} />
                <Badge label={e.statut} color={STATUT_COLORS[e.statut]} />
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: sc.text }}>{e.prenom} {e.nom}</div>
            <div style={{ fontSize: 11, color: sc.muted2, marginTop: 2 }}>{e.matricule} · {e.poste}</div>
            {e.service && <div style={{ fontSize: 11, color: sc.muted, marginTop: 2 }}>{e.service}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: `1px solid rgba(79,195,247,0.06)` }}>
              <span style={{ fontSize: 11, color: sc.muted2 }}>💶 {Number(e.taux_horaire).toFixed(2)} €/h</span>
              <span style={{ fontSize: 11, color: sc.muted2 }}>⏰ {e.nb_heures_semaine}h/sem</span>
              <span style={{ fontSize: 11, color: sc.blue }}>🎯 {e.nb_competences} comp.</span>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: sc.card, border: `1px solid ${sc.border}`, borderRadius: 14, padding: 24, width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: sc.text, margin: 0 }}>Nouvel employé</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: sc.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { key: 'matricule', label: 'Matricule *' },
                { key: 'nom', label: 'Nom *' },
                { key: 'prenom', label: 'Prénom *' },
                { key: 'email', label: 'Email' },
                { key: 'poste', label: 'Poste *' },
                { key: 'service', label: 'Service' },
                { key: 'date_embauche', label: 'Date embauche *', type: 'date' },
                { key: 'taux_horaire', label: 'Taux horaire (€/h) *', type: 'number' },
                { key: 'nb_heures_semaine', label: 'Heures/semaine', type: 'number' },
                { key: 'cout_charges_pct', label: 'Charges patronales (%)', type: 'number' },
              ].map(({ key, label, type }) => (
                <div key={key}>
                  <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, fontWeight: 600 }}>{label}</div>
                  <input type={type || 'text'} value={form[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))} style={inputStyle} />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5, fontWeight: 600 }}>Type contrat</div>
                <select value={form.type_contrat} onChange={e => setForm((f: any) => ({ ...f, type_contrat: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {['CDI','CDD','INTERIM','STAGE','APPRENTISSAGE'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
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

// ── Congés ────────────────────────────────────────────────────
function CongesTab({ conges, employes, onRefresh }: any) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ employe_id: '', type_absence: 'CONGE_PAYE', date_debut: '', date_fin: '', motif: '' });

  const handleCreate = async () => {
    try {
      await api.post('/rh/conges', form);
      setShowCreate(false);
      onRefresh();
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleApprouver = async (id: string, approuve: boolean) => {
    try {
      await api.put(`/rh/conges/${id}/approuver`, { approuve });
      onRefresh();
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${sc.border}`,
    borderRadius: 8, padding: '7px 11px', color: sc.text, fontFamily: 'inherit', fontSize: 13, width: '100%', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowCreate(true)} style={{ padding: '7px 16px', background: sc.blue, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>+ Nouvelle demande</button>
      </div>

      <Card>
        <SectionTitle tag={`${conges.length} demandes`}>Demandes de congés</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>{['Employé','Type','Du','Au','Jours','Statut','Actions'].map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: sc.muted, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid rgba(79,195,247,0.08)` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {conges.map((c: any) => (
              <tr key={c.id}>
                <td style={{ padding: '9px 12px', color: sc.text, fontWeight: 600, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{c.prenom} {c.nom}</td>
                <td style={{ padding: '9px 12px', borderBottom: `1px solid rgba(79,195,247,0.04)` }}><Badge label={c.type_absence.replace('_',' ')} color={sc.blue} /></td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{new Date(c.date_debut).toLocaleDateString('fr-FR')}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{new Date(c.date_fin).toLocaleDateString('fr-FR')}</td>
                <td style={{ padding: '9px 12px', color: sc.text, fontWeight: 600, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(c.nb_jours).toFixed(0)}j</td>
                <td style={{ padding: '9px 12px', borderBottom: `1px solid rgba(79,195,247,0.04)` }}><Badge label={c.statut} color={STATUT_COLORS[c.statut]} /></td>
                <td style={{ padding: '9px 12px', borderBottom: `1px solid rgba(79,195,247,0.04)` }}>
                  {c.statut === 'EN_ATTENTE' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => handleApprouver(c.id, true)} style={{ padding: '3px 10px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 6, color: '#34D399', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Approuver</button>
                      <button onClick={() => handleApprouver(c.id, false)} style={{ padding: '3px 10px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 6, color: '#F87171', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✗ Refuser</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: sc.card, border: `1px solid ${sc.border}`, borderRadius: 14, padding: 24, width: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: sc.text, margin: 0 }}>Nouvelle demande de congé</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: sc.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Employé</div>
                <select value={form.employe_id} onChange={e => setForm(f => ({ ...f, employe_id: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Sélectionner...</option>
                  {employes.map((e: any) => <option key={e.id} value={e.id}>{e.prenom} {e.nom} ({e.matricule})</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Type d'absence</div>
                <select value={form.type_absence} onChange={e => setForm(f => ({ ...f, type_absence: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {['CONGE_PAYE','RTT','MALADIE','MATERNITE','FORMATION','AUTRE'].map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Du</div>
                  <input type="date" value={form.date_debut} onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Au</div>
                  <input type="date" value={form.date_fin} onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Motif</div>
                <input value={form.motif} onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} style={inputStyle} />
              </div>
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

// ── Coûts MO ─────────────────────────────────────────────────
function CoutsMoTab({ coutsMensuel, coutsMoOf }: any) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card>
        <SectionTitle>Évolution du coût main d'œuvre (12 mois)</SectionTitle>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>{['Période','Masse salariale','Charges patronales','Coût total MO','Nb employés'].map(h => (
                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: sc.muted, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid rgba(79,195,247,0.08)` }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {coutsMensuel.map((row: any) => (
                <tr key={`${row.periode_annee}-${row.periode_mois}`}>
                  <td style={{ padding: '9px 12px', color: sc.text, fontWeight: 600, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>
                    {new Date(row.periode_annee, row.periode_mois - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(row.masse_salariale).toLocaleString('fr-FR')} €</td>
                  <td style={{ padding: '9px 12px', color: '#FB923C', borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(row.charges).toLocaleString('fr-FR')} €</td>
                  <td style={{ padding: '9px 12px', color: '#A78BFA', fontWeight: 700, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(row.cout_total).toLocaleString('fr-FR')} €</td>
                  <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{row.nb_employes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle>Coût MO par ordre de fabrication</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>{['OF','Article','Qté prévue','Qté produite','Heures prod.','Coût MO estimé'].map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: sc.muted, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid rgba(79,195,247,0.08)` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {coutsMoOf.map((row: any) => (
              <tr key={row.of_ref}>
                <td style={{ padding: '9px 12px', color: sc.blue, fontWeight: 600, borderBottom: `1px solid rgba(79,195,247,0.04)`, fontFamily: 'monospace' }}>{row.of_ref}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{row.article}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{row.quantite_prevue}</td>
                <td style={{ padding: '9px 12px', color: sc.text, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{row.quantite_produite}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(row.heures_prod).toFixed(2)} h</td>
                <td style={{ padding: '9px 12px', color: '#A78BFA', fontWeight: 700, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(row.cout_mo_estime).toLocaleString('fr-FR')} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ── Fiches de paie ────────────────────────────────────────────
function FichesPaieTab({ fiches, employes, onRefresh }: any) {
  const [showGenerer, setShowGenerer] = useState(false);
  const [form, setForm] = useState({ employe_id: '', periode_mois: String(new Date().getMonth() + 1), periode_annee: String(new Date().getFullYear()), primes: '0' });

  const handleGenerer = async () => {
    try {
      await api.post('/rh/fiches-paie/generer', { ...form, periode_mois: parseInt(form.periode_mois), periode_annee: parseInt(form.periode_annee), primes: parseFloat(form.primes) });
      setShowGenerer(false);
      onRefresh();
    } catch (e: any) { alert(e.response?.data?.message || 'Erreur'); }
  };

  const handleValider = async (id: string) => {
    try { await api.put(`/rh/fiches-paie/${id}/valider`); onRefresh(); }
    catch (e: any) { alert('Erreur'); }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)', border: `1px solid ${sc.border}`,
    borderRadius: 8, padding: '7px 11px', color: sc.text, fontFamily: 'inherit', fontSize: 13, width: '100%', outline: 'none',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowGenerer(true)} style={{ padding: '7px 16px', background: sc.blue, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>⚙️ Générer fiche de paie</button>
      </div>
      <Card>
        <SectionTitle tag={`${fiches.length} fiches`}>Fiches de paie</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>{['Employé','Période','Heures','Heures sup','Salaire brut','Charges','Coût MO total','Statut','Action'].map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: sc.muted, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid rgba(79,195,247,0.08)` }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {fiches.map((f: any) => (
              <tr key={f.id}>
                <td style={{ padding: '9px 12px', color: sc.text, fontWeight: 600, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{f.prenom} {f.nom}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{String(f.periode_mois).padStart(2,'0')}/{f.periode_annee}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(f.nb_heures_travaillees).toFixed(1)}h</td>
                <td style={{ padding: '9px 12px', color: Number(f.nb_heures_sup) > 0 ? '#FCD34D' : sc.muted, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(f.nb_heures_sup).toFixed(1)}h</td>
                <td style={{ padding: '9px 12px', color: sc.text, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(f.salaire_brut).toLocaleString('fr-FR')} €</td>
                <td style={{ padding: '9px 12px', color: '#FB923C', borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(f.charges_patronales).toLocaleString('fr-FR')} €</td>
                <td style={{ padding: '9px 12px', color: '#A78BFA', fontWeight: 700, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(f.cout_total_mo).toLocaleString('fr-FR')} €</td>
                <td style={{ padding: '9px 12px', borderBottom: `1px solid rgba(79,195,247,0.04)` }}><Badge label={f.statut} color={STATUT_COLORS[f.statut]} /></td>
                <td style={{ padding: '9px 12px', borderBottom: `1px solid rgba(79,195,247,0.04)` }}>
                  {f.statut === 'BROUILLON' && (
                    <button onClick={() => handleValider(f.id)} style={{ padding: '3px 10px', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 6, color: '#34D399', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>✓ Valider</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showGenerer && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: sc.card, border: `1px solid ${sc.border}`, borderRadius: 14, padding: 24, width: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: sc.text, margin: 0 }}>Générer fiche de paie</h3>
              <button onClick={() => setShowGenerer(false)} style={{ background: 'none', border: 'none', color: sc.muted, fontSize: 18, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Employé</div>
                <select value={form.employe_id} onChange={e => setForm(f => ({ ...f, employe_id: e.target.value }))} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Sélectionner...</option>
                  {employes.map((e: any) => <option key={e.id} value={e.id}>{e.prenom} {e.nom}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Mois</div>
                  <input type="number" min="1" max="12" value={form.periode_mois} onChange={e => setForm(f => ({ ...f, periode_mois: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Année</div>
                  <input type="number" value={form.periode_annee} onChange={e => setForm(f => ({ ...f, periode_annee: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: sc.muted2, textTransform: 'uppercase', marginBottom: 5, fontWeight: 600 }}>Primes (€)</div>
                <input type="number" value={form.primes} onChange={e => setForm(f => ({ ...f, primes: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ fontSize: 11, color: sc.muted, padding: 10, background: 'rgba(79,195,247,0.04)', borderRadius: 8 }}>
                💡 Le salaire brut sera calculé automatiquement à partir des présences du mois et du taux horaire de l'employé.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowGenerer(false)} style={{ padding: '7px 16px', background: 'none', border: `1px solid ${sc.border}`, borderRadius: 8, color: sc.muted2, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
              <button onClick={handleGenerer} style={{ padding: '7px 16px', background: sc.blue, border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Générer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────
export default function RhPage() {
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState<any>({ kpis: null, employes: [], conges: [], formations: [], competences: [], fiches: [], presences: [], coutsMensuel: [], coutsMoOf: [] });
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [, setSelectedEmploye] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [kpis, employes, conges, formations, competences, fiches, presences, coutsMensuel, coutsMoOf] = await Promise.all([
        api.get('/rh/dashboard').then(r => r.data).catch(() => null),
        api.get('/rh/employes').then(r => r.data).catch(() => []),
        api.get('/rh/conges').then(r => r.data).catch(() => []),
        api.get('/rh/formations').then(r => r.data).catch(() => []),
        api.get('/rh/competences').then(r => r.data).catch(() => []),
        api.get('/rh/fiches-paie').then(r => r.data).catch(() => []),
        api.get('/rh/presences').then(r => r.data).catch(() => []),
        api.get('/rh/cout-mo-mensuel').then(r => r.data).catch(() => []),
        api.get('/rh/cout-mo-of').then(r => r.data).catch(() => []),
      ]);
      setData({ kpis, employes, conges, formations, competences, fiches, presences, coutsMensuel, coutsMoOf });
      setLoading(false);
    } catch { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: sc.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(79,195,247,0.15)', borderTopColor: sc.blue, animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100%', background: sc.bg, padding: '20px 24px', fontFamily: "'DM Sans', system-ui, sans-serif", color: sc.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Ressources Humaines</h1>
          <div style={{ fontSize: 12, color: sc.muted, marginTop: 3 }}>{data.employes.filter((e: any) => e.statut === 'ACTIF').length} employés actifs</div>
        </div>
        <button onClick={fetchAll} style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid rgba(79,195,247,0.15)`, background: 'rgba(79,195,247,0.06)', color: sc.blue, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>↻ Actualiser</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${sc.border}`, marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 14px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === t.id ? sc.blue : 'transparent'}`,
            color: tab === t.id ? sc.blue : sc.muted2, cursor: 'pointer', fontSize: 12,
            fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard' && <DashboardRH kpis={data.kpis} />}
      {tab === 'employes' && <EmployesTab employes={data.employes} onSelect={setSelectedEmploye} showCreate={showCreate} setShowCreate={setShowCreate} onRefresh={fetchAll} />}
      {tab === 'conges' && <CongesTab conges={data.conges} employes={data.employes} onRefresh={fetchAll} />}
      {tab === 'presences' && (
        <Card>
          <SectionTitle tag={`${data.presences.length} pointages`}>Présences récentes</SectionTitle>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['Employé','Poste','Date','Entrée','Sortie','Heures','H.Sup','Validé'].map(h => (
              <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: sc.muted, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: `1px solid rgba(79,195,247,0.08)` }}>{h}</th>
            ))}</tr></thead>
            <tbody>{data.presences.map((p: any) => (
              <tr key={p.id}>
                <td style={{ padding: '9px 12px', color: sc.text, fontWeight: 600, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{p.prenom} {p.nom}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{p.poste}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{new Date(p.date_presence).toLocaleDateString('fr-FR')}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{p.heure_entree || '—'}</td>
                <td style={{ padding: '9px 12px', color: sc.muted2, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{p.heure_sortie || '—'}</td>
                <td style={{ padding: '9px 12px', color: sc.text, fontWeight: 600, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{p.heures_travaillees ? `${Number(p.heures_travaillees).toFixed(2)}h` : '—'}</td>
                <td style={{ padding: '9px 12px', color: Number(p.heures_sup) > 0 ? '#FCD34D' : sc.muted, borderBottom: `1px solid rgba(79,195,247,0.04)` }}>{Number(p.heures_sup).toFixed(2)}h</td>
                <td style={{ padding: '9px 12px', borderBottom: `1px solid rgba(79,195,247,0.04)` }}><Badge label={p.valide ? 'OUI' : 'NON'} color={p.valide ? '#34D399' : '#F87171'} /></td>
              </tr>
            ))}</tbody>
          </table>
        </Card>
      )}
      {tab === 'competences' && (
        <Card>
          <SectionTitle tag={`${data.competences.length} compétences`}>Référentiel des compétences</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
            {data.competences.map((c: any) => (
              <div key={c.id} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${sc.border}`, borderRadius: 10, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sc.text }}>{c.libelle}</span>
                  <Badge label={c.categorie} color={sc.blue} />
                </div>
                <div style={{ fontSize: 11, color: sc.muted, fontFamily: 'monospace' }}>{c.code}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10, fontSize: 11, color: sc.muted2 }}>
                  <span>👥 {c.nb_employes} employés</span>
                  <span>⭐ {c.nb_experts} experts</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
      {tab === 'formations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {data.formations.map((f: any) => (
              <div key={f.id} style={{ background: sc.card, border: `1px solid ${sc.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: sc.text, flex: 1 }}>{f.intitule}</span>
                  <Badge label={f.statut} color={STATUT_COLORS[f.statut]} />
                </div>
                <div style={{ fontSize: 11, color: sc.muted2 }}>🏢 {f.organisme || '—'}</div>
                {f.date_debut && <div style={{ fontSize: 11, color: sc.muted2, marginTop: 4 }}>📅 {new Date(f.date_debut).toLocaleDateString('fr-FR')} → {f.date_fin ? new Date(f.date_fin).toLocaleDateString('fr-FR') : '?'}</div>}
                <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11 }}>
                  <span style={{ color: sc.muted2 }}>⏰ {f.duree_jours}j</span>
                  <span style={{ color: '#A78BFA', fontWeight: 600 }}>💶 {Number(f.cout_total || f.cout_unitaire).toLocaleString('fr-FR')} €</span>
                  <span style={{ color: sc.blue }}>👥 {f.nb_inscrits} inscrits</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === 'paie' && <FichesPaieTab fiches={data.fiches} employes={data.employes} onRefresh={fetchAll} />}
      {tab === 'couts' && <CoutsMoTab coutsMensuel={data.coutsMensuel} coutsMoOf={data.coutsMoOf} />}
    </div>
  );
}
