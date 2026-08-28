import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../services/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: any[];
}

interface Alerte {
  type: string;
  severity: 'critical' | 'warning';
  message: string;
  action: string;
}

interface ContextData {
  module: string;
  label: string;
  systemPrompt: string;
  quickActions: string[];
  icon: string;
}

// ── Contexte par module ───────────────────────────────────────
const getContext = (path: string): ContextData => {
  if (path.includes('/stock'))
    return {
      module: 'stock', label: 'Stock', icon: '📦',
      systemPrompt: `Tu es un expert en gestion de stocks industriels pour une usine de fabrication de vannes et robinets. Analyse les niveaux de stock, identifie les risques de rupture, propose des réapprovisionnements optimaux.`,
      quickActions: ['Quels articles sont en rupture ?', 'Analyser les alertes DLUO', 'Valeur totale du stock', 'Articles sous le stock mini'],
    };
  if (path.includes('/achats'))
    return {
      module: 'achats', label: 'Achats', icon: '🛒',
      systemPrompt: `Tu es un expert acheteur industriel. Tu gères les achats pour une usine de vannes. Tu peux créer des demandes d'achat automatiquement.`,
      quickActions: ['Commandes en cours', 'Fournisseurs par score qualité', 'Créer une DA pour MP-ACIER-001', 'DA en attente de validation'],
    };
  if (path.includes('/production'))
    return {
      module: 'production', label: 'Production', icon: '🏭',
      systemPrompt: `Tu es un expert en planification de production. Tu peux créer des ordres de fabrication et analyser les performances.`,
      quickActions: ['OF en cours et avancement', 'TRS par poste de charge', 'Créer un OF pour PF-VANNE-001', 'Composants manquants pour les OF'],
    };
  if (path.includes('/qualite'))
    return {
      module: 'qualite', label: 'Qualité', icon: '✅',
      systemPrompt: `Tu es un expert qualité ISO 9001. Tu analyses les non-conformités, proposes des actions correctives et suis les plans de contrôle.`,
      quickActions: ['NC ouvertes par sévérité', 'NC les plus anciennes', 'Taux de rebut par article', 'Plans de contrôle actifs'],
    };
  if (path.includes('/expeditions'))
    return {
      module: 'expeditions', label: 'Expéditions', icon: '🚚',
      systemPrompt: `Tu es un expert logistique. Tu analyses les commandes clients, les expéditions et le taux de service.`,
      quickActions: ['Commandes à expédier', 'Retards potentiels', 'Taux de service clients', 'BL en attente'],
    };
  if (path.includes('/reporting'))
    return {
      module: 'reporting', label: 'Reporting', icon: '📊',
      systemPrompt: `Tu es un analyste data industriel. Tu fournis des KPIs, analyses de tendances et recommandations stratégiques chiffrées.`,
      quickActions: ['KPIs du mois', 'Performance vs objectifs', 'Classement fournisseurs', 'Analyse des écarts production'],
    };
  return {
    module: 'dashboard', label: 'Assistant', icon: '🤖',
    systemPrompt: `Tu es l'assistant IA de Supply Chain Industrielle, une application de gestion pour une usine de fabrication de vannes et robinets. Tu as accès complet à toutes les données et tu peux créer des DA et des OF.`,
    quickActions: ['Risques prioritaires aujourd\'hui', 'Vue d\'ensemble de l\'activité', 'Actions recommandées', 'Créer une DA urgente'],
  };
};

// ── Mémoire persistante (localStorage) ───────────────────────
const MEMORY_KEY = 'sc_ai_memory';
const MAX_MEMORY = 2000; // chars

function loadMemory(): string {
  try { return localStorage.getItem(MEMORY_KEY) || ''; } catch { return ''; }
}

function saveMemory(messages: Message[]) {
  try {
    const summary = messages
      .slice(-6) // garder les 6 derniers échanges
      .map(m => `[${m.role === 'user' ? 'Utilisateur' : 'Agent'}]: ${m.content.substring(0, 200)}`)
      .join('\n');
    localStorage.setItem(MEMORY_KEY, summary.substring(0, MAX_MEMORY));
  } catch {}
}

// ── Appel API ─────────────────────────────────────────────────
// On utilise l'instance axios partagée (services/api.ts) plutôt que fetch() :
// elle pointe déjà vers la bonne origine (VITE_API_URL en production, au lieu
// d'une origine relative qui toucherait le frontend au lieu du backend), et
// elle rafraîchit automatiquement le token d'accès expiré (15 min) avant de
// rejouer la requête — un fetch() brut avec un token en cache ne le fait pas.
async function callAgent(
  messages: { role: string; content: string }[],
  systemPrompt: string,
  module: string,
  memory: string
): Promise<{ content: string; actions: any[] }> {
  try {
    const { data } = await api.post('/ai/chat', { messages, system: systemPrompt, module, memory });
    return data;
  } catch (e: any) {
    throw new Error(`Erreur serveur : ${e.response?.status || e.message}`);
  }
}

async function fetchAlertes(): Promise<Alerte[]> {
  try {
    const { data } = await api.get('/ai/alertes');
    return data.alertes || [];
  } catch { return []; }
}

// ── Composant ─────────────────────────────────────────────────
export default function AiAgent() {
  const location = useLocation();
  const ctx = getContext(location.pathname);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'alertes'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [nbAlertes, setNbAlertes] = useState(0);
  const memory = useRef(loadMemory());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Charger alertes toutes les 2 minutes
  useEffect(() => {
    const load = async () => {
      const a = await fetchAlertes();
      setAlertes(a);
      setNbAlertes(a.filter(x => x.severity === 'critical').length);
      if (a.filter(x => x.severity === 'critical').length > 0) {
        setPulse(true);
        setTimeout(() => setPulse(false), 3000);
      }
    };
    load();
    const interval = setInterval(load, 120_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text?: string) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', content: userText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const { content, actions } = await callAgent(history, ctx.systemPrompt, ctx.module, memory.current);
      const assistantMsg: Message = { role: 'assistant', content, timestamp: new Date(), actions };
      setMessages(prev => {
        const updated = [...prev, assistantMsg];
        saveMemory(updated);
        memory.current = loadMemory();
        return updated;
      });
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${e.message}`, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, ctx]);

  const clearMemory = () => {
    localStorage.removeItem(MEMORY_KEY);
    memory.current = '';
    setMessages([]);
  };

  return (
    <>
      {/* ── Bouton flottant ── */}
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'fixed', bottom: '24px', right: '24px',
        width: '56px', height: '56px', borderRadius: '50%',
        background: open ? '#0F4C81' : 'linear-gradient(135deg,#0F4C81,#1976D2)',
        border: 'none', cursor: 'pointer', fontSize: '1.4rem',
        boxShadow: pulse ? '0 0 0 8px rgba(239,68,68,0.3),0 8px 24px rgba(15,76,129,0.5)' : '0 8px 24px rgba(15,76,129,0.4)',
        transition: 'all 0.3s', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {open ? '✕' : ctx.icon}
        {nbAlertes > 0 && !open && (
          <div style={{
            position: 'absolute', top: '-4px', right: '-4px',
            width: '20px', height: '20px', borderRadius: '50%',
            background: '#EF4444', color: '#fff', fontSize: '0.7rem',
            fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #080F1C',
          }}>{nbAlertes}</div>
        )}
      </button>

      {/* ── Panneau ── */}
      {open && (
        <div style={{
          position: 'fixed', bottom: '92px', right: '24px',
          width: '420px', maxWidth: 'calc(100vw - 48px)', height: '580px',
          background: '#080F1C', border: '1px solid rgba(79,195,247,0.2)',
          borderRadius: '16px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)', zIndex: 9998,
          animation: 'slideUpAI 0.2s ease', overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid rgba(79,195,247,0.1)',
            background: 'rgba(15,76,129,0.3)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{
                width: '32px', height: '32px',
                background: 'linear-gradient(135deg,#0F4C81,#4FC3F7)',
                borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
              }}>{ctx.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#E8F4FD', fontWeight: 700, fontSize: '0.875rem' }}>Agent IA — {ctx.label}</div>
                <div style={{ color: '#4FC3F7', fontSize: '0.68rem' }}>Claude · SQL dynamique · Mémoire active</div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {memory.current && (
                  <button onClick={clearMemory} title="Effacer la mémoire" style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(79,195,247,0.1)',
                    borderRadius: '6px', padding: '3px 8px', color: '#5A7A90',
                    fontSize: '0.7rem', cursor: 'pointer', fontFamily: 'inherit',
                  }}>🧠 Effacer</button>
                )}
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 6px #4ADE80' }} />
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {['chat', 'alertes'].map(t => (
                <button key={t} onClick={() => setTab(t as any)} style={{
                  padding: '5px 14px', borderRadius: '6px', border: 'none',
                  background: tab === t ? 'rgba(79,195,247,0.15)' : 'transparent',
                  color: tab === t ? '#4FC3F7' : '#5A7A90',
                  cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'inherit',
                  position: 'relative',
                }}>
                  {t === 'chat' ? '💬 Chat' : `🔔 Alertes ${nbAlertes > 0 ? `(${nbAlertes})` : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Alertes */}
          {tab === 'alertes' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {alertes.length === 0 ? (
                <div style={{ color: '#4ADE80', textAlign: 'center', padding: '40px', fontSize: '0.875rem' }}>
                  ✅ Aucune alerte — tout est sous contrôle
                </div>
              ) : alertes.map((a, i) => (
                <div key={i} style={{
                  background: a.severity === 'critical' ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.08)',
                  border: `1px solid ${a.severity === 'critical' ? 'rgba(239,68,68,0.25)' : 'rgba(234,179,8,0.25)'}`,
                  borderRadius: '8px', padding: '10px 12px',
                }}>
                  <div style={{ color: '#E8F4FD', fontSize: '0.82rem', marginBottom: '4px' }}>{a.message}</div>
                  <button onClick={() => { setTab('chat'); sendMessage(`${a.action} — contexte: ${a.message}`); }} style={{
                    background: 'rgba(79,195,247,0.1)', border: '1px solid rgba(79,195,247,0.2)',
                    borderRadius: '4px', padding: '3px 10px', color: '#4FC3F7',
                    fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', marginTop: '2px',
                  }}>⚡ {a.action}</button>
                </div>
              ))}
            </div>
          )}

          {/* Tab Chat */}
          {tab === 'chat' && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {messages.length === 0 && (
                  <div style={{ padding: '4px 0' }}>
                    {memory.current && (
                      <div style={{
                        background: 'rgba(79,195,247,0.05)', border: '1px solid rgba(79,195,247,0.1)',
                        borderRadius: '8px', padding: '8px 12px', marginBottom: '10px', fontSize: '0.75rem', color: '#4FC3F7',
                      }}>
                        🧠 Mémoire active — je me souviens de nos échanges précédents
                      </div>
                    )}
                    <div style={{ color: '#5A7A90', fontSize: '0.82rem', textAlign: 'center', marginBottom: '10px' }}>
                      Je peux interroger la base de données, créer des DA et des OF.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {ctx.quickActions.map((action, i) => (
                        <button key={i} onClick={() => sendMessage(action)} style={{
                          background: 'rgba(79,195,247,0.05)', border: '1px solid rgba(79,195,247,0.12)',
                          borderRadius: '8px', padding: '8px 12px', color: '#C4DCF0',
                          fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left',
                          transition: 'all 0.15s', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(79,195,247,0.12)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(79,195,247,0.05)'; }}
                        >⚡ {action}</button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: '8px', alignItems: 'flex-start' }}>
                      {msg.role === 'assistant' && (
                        <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'linear-gradient(135deg,#0F4C81,#4FC3F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', flexShrink: 0, marginTop: '2px' }}>🤖</div>
                      )}
                      <div style={{
                        maxWidth: '82%',
                        background: msg.role === 'user' ? 'linear-gradient(135deg,#0F4C81,#1976D2)' : 'rgba(255,255,255,0.04)',
                        border: msg.role === 'user' ? 'none' : '1px solid rgba(79,195,247,0.1)',
                        borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        padding: '10px 12px', color: '#E8F4FD', fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                      }}>
                        {msg.content}
                        <div style={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.4)' : '#2D4A5E', fontSize: '0.65rem', marginTop: '4px' }}>
                          {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    {/* Badges actions créées */}
                    {msg.actions?.map((action, j) => (
                      <div key={j} style={{
                        marginLeft: '32px', marginTop: '6px',
                        background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                        borderRadius: '8px', padding: '8px 12px', fontSize: '0.78rem', color: '#4ADE80',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}>
                        <span>
                          {action.type === 'DA_CREATED' && `✅ Demande d'achat créée : ${action.data.reference}`}
                          {action.type === 'OF_CREATED' && `✅ Ordre de fabrication créé : ${action.data.reference}`}
                          {action.type === 'REPORT_GENERATED' && `✅ Rapport ${action.data.format.toUpperCase()} généré`}
                        </span>
                        {action.type === 'REPORT_GENERATED' && (
                          <a
                            href={action.data.downloadUrl}
                            download
                            onClick={e => {
                              // Ajouter le token dans l'URL n'est pas possible — on passe par
                              // l'instance axios partagée (bonne origine + token toujours à jour).
                              e.preventDefault();
                              const path = action.data.downloadUrl.replace(/^\/api\/v1/, '');
                              api.get(path, { responseType: 'blob' })
                                .then(({ data: blob }) => {
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement('a');
                                  a.href = url;
                                  a.download = `rapport.${action.data.format === 'excel' ? 'xlsx' : 'doc'}`;
                                  a.click();
                                  URL.revokeObjectURL(url);
                                });
                            }}
                            style={{
                              background: '#0F4C81', color: '#fff', textDecoration: 'none',
                              padding: '4px 12px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600,
                            }}
                          >
                            ⬇ Télécharger
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {loading && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'linear-gradient(135deg,#0F4C81,#4FC3F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>🤖</div>
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(79,195,247,0.1)', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: '#5A7A90', fontSize: '0.75rem', marginRight: '6px' }}>Interrogation de la base</span>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4FC3F7', animation: `dotbounce 1.2s ease-in-out ${i*0.2}s infinite` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: '12px', borderTop: '1px solid rgba(79,195,247,0.08)', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)' }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder="Posez votre question ou demandez une action... (Entrée)"
                  rows={2}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(79,195,247,0.15)',
                    borderRadius: '8px', padding: '8px 10px', color: '#E8F4FD',
                    fontSize: '0.82rem', fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5,
                  }}
                />
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading} style={{
                  background: !input.trim() || loading ? 'rgba(79,195,247,0.1)' : 'linear-gradient(135deg,#0F4C81,#1976D2)',
                  border: 'none', borderRadius: '8px', width: '40px',
                  cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                  color: '#fff', fontSize: '1rem', transition: 'all 0.15s', flexShrink: 0,
                }}>
                  {loading ? '⏳' : '➤'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideUpAI { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes dotbounce { 0%,80%,100%{transform:scale(0.8);opacity:0.5} 40%{transform:scale(1.2);opacity:1} }
      `}</style>
    </>
  );
}
