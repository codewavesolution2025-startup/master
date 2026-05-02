import { Routes, Route, Navigate } from 'react-router-dom';

// Pages (à créer au fil des sprints)
// Sprint 1 : Login, Articles, Fournisseurs, Sites
// Sprint 2 : Stock, Lots
// etc.

function HealthPage() {
  return (
    <div style={{ fontFamily: 'monospace', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#1E3A5F' }}>⚙ Supply Chain Industrielle</h1>
      <p style={{ color: '#374151' }}>
        Frontend opérationnel — Sprint 0 terminé.
      </p>
      <div style={{
        background: '#F0FDF4', border: '1px solid #86EFAC',
        borderRadius: '8px', padding: '1rem', marginTop: '1rem',
      }}>
        <strong style={{ color: '#166534' }}>✓ US-000 — Monorepo NestJS + React/Vite</strong>
        <ul style={{ color: '#15803D', marginTop: '0.5rem' }}>
          <li>Structure monorepo créée</li>
          <li>TypeScript configuré (backend + frontend)</li>
          <li>ESLint + Prettier partagés</li>
          <li>Proxy Vite → NestJS configuré (/api)</li>
          <li>React Query + React Router initialisés</li>
        </ul>
      </div>
      <div style={{ marginTop: '1.5rem', color: '#6B7280', fontSize: '0.85rem' }}>
        <strong>Prochaine étape :</strong> US-001 — Docker Compose (PostgreSQL + Redis + MinIO)
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HealthPage />} />
      {/* Sprint 1 — Auth */}
      {/* <Route path="/login" element={<LoginPage />} /> */}
      {/* Sprint 1 — M1 Référentiels */}
      {/* <Route path="/articles" element={<ArticlesPage />} /> */}
      {/* <Route path="/fournisseurs" element={<FournisseursPage />} /> */}
      {/* Sprint 2 — M2 Stocks */}
      {/* <Route path="/stock" element={<StockPage />} /> */}
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
