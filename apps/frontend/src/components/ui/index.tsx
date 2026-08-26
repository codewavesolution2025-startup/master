// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANTS UI PARTAGÉS — Design System Supply Chain
// ═══════════════════════════════════════════════════════════════════════════

import { ReactNode, useState, useCallback } from 'react';

// ── Badge ────────────────────────────────────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

const BADGE_STYLES: Record<BadgeVariant, string> = {
  success: 'background:rgba(34,197,94,0.12);color:#4ADE80;border:1px solid rgba(34,197,94,0.2)',
  warning: 'background:rgba(234,179,8,0.12);color:#FCD34D;border:1px solid rgba(234,179,8,0.2)',
  danger:  'background:rgba(239,68,68,0.12);color:#FCA5A5;border:1px solid rgba(239,68,68,0.2)',
  info:    'background:rgba(79,195,247,0.12);color:#4FC3F7;border:1px solid rgba(79,195,247,0.2)',
  neutral: 'background:rgba(100,116,139,0.12);color:#94A3B8;border:1px solid rgba(100,116,139,0.2)',
  accent:  'background:rgba(124,58,237,0.12);color:#A78BFA;border:1px solid rgba(124,58,237,0.2)',
};

export function Badge({ children, variant = 'neutral' }: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: '0.72rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      padding: '2px 8px',
      borderRadius: '6px',
      whiteSpace: 'nowrap',
      ...(Object.fromEntries(
        BADGE_STYLES[variant].split(';')
          .filter(Boolean)
          .map(s => {
            const [k, v] = s.split(':');
            const camel = k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            return [camel, v?.trim()];
          })
      ) as any),
    }}>
      {children}
    </span>
  );
}

// ── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  children, onClick, variant = 'primary', disabled, size = 'md', type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  disabled?: boolean;
  size?: 'sm' | 'md';
  type?: 'button' | 'submit';
}) {
  const styles: Record<BtnVariant, object> = {
    primary:   { background: 'linear-gradient(135deg,#0F4C81,#1976D2)', color: '#fff', border: 'none' },
    secondary: { background: 'rgba(79,195,247,0.08)', color: '#4FC3F7', border: '1px solid rgba(79,195,247,0.2)' },
    danger:    { background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.25)' },
    ghost:     { background: 'transparent', color: '#5A7A90', border: '1px solid rgba(79,195,247,0.1)' },
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[variant],
        padding: size === 'sm' ? '5px 12px' : '8px 16px',
        fontSize: size === 'sm' ? '0.8rem' : '0.875rem',
        fontWeight: 600,
        fontFamily: 'inherit',
        borderRadius: '8px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────
export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
}

export function Table<T extends { id?: string }>({
  columns, data, onRowClick, loading, emptyText = 'Aucune donnée',
}: {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyText?: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(79,195,247,0.08)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(79,195,247,0.08)' }}>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '11px 16px',
                textAlign: 'left',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#3A6278',
                width: col.width,
                whiteSpace: 'nowrap',
              }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '40px', textAlign: 'center', color: '#2D4A5E' }}>
                <span style={{
                  display: 'inline-block',
                  width: '24px', height: '24px',
                  border: '2px solid rgba(79,195,247,0.2)',
                  borderTopColor: '#4FC3F7',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }} />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: '40px', textAlign: 'center', color: '#2D4A5E', fontSize: '0.875rem' }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={(row as any).id || i}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: i < data.length - 1 ? '1px solid rgba(79,195,247,0.05)' : 'none',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  if (onRowClick) (e.currentTarget as HTMLElement).style.background = 'rgba(79,195,247,0.04)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {columns.map(col => (
                  <td key={col.key} style={{
                    padding: '12px 16px',
                    fontSize: '0.875rem',
                    color: '#C4DCF0',
                    verticalAlign: 'middle',
                  }}>
                    {col.render ? col.render(row) : (row as any)[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
export function Pagination({ page, pages, total, onPage }: {
  page: number; pages: number; total: number; onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
      <span style={{ color: '#3A6278', fontSize: '0.8rem' }}>{total} résultats</span>
      <Button variant="ghost" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>‹</Button>
      <span style={{ color: '#5A7A90', fontSize: '0.85rem' }}>{page} / {pages}</span>
      <Button variant="ghost" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>›</Button>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ title, children, onClose, width = '520px' }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  width?: string;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width, maxWidth: '95vw', maxHeight: '90vh',
        background: '#0A1628',
        border: '1px solid rgba(79,195,247,0.15)',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.2s ease',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(79,195,247,0.08)',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#E8F4FD' }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#3A6278',
            cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1,
            borderRadius: '6px', padding: '2px 6px',
          }}>✕</button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── SearchInput ───────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Rechercher...' }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#2D4A5E', fontSize: '0.875rem' }}>🔍</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(79,195,247,0.1)',
          borderRadius: '8px',
          padding: '7px 12px 7px 32px',
          color: '#E8F4FD',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          outline: 'none',
          width: '220px',
          transition: 'border-color 0.2s',
        }}
        onFocus={e => (e.target.style.borderColor = 'rgba(79,195,247,0.4)')}
        onBlur={e => (e.target.style.borderColor = 'rgba(79,195,247,0.1)')}
      />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(79,195,247,0.1)',
        borderRadius: '8px',
        padding: '7px 28px 7px 12px',
        color: value ? '#E8F4FD' : '#2D4A5E',
        fontSize: '0.875rem',
        fontFamily: 'inherit',
        outline: 'none',
        cursor: 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%233A6278' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

// ── FormField ─────────────────────────────────────────────────────────────────
export function FormField({ label, error, children, required }: {
  label: string; error?: string; children: ReactNode; required?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#5A7A90', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label} {required && <span style={{ color: '#EF4444' }}>*</span>}
      </label>
      {children}
      {error && <span style={{ fontSize: '0.78rem', color: '#FCA5A5' }}>{error}</span>}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = 'text', required }: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(79,195,247,0.12)',
        borderRadius: '8px',
        padding: '9px 12px',
        color: '#E8F4FD',
        fontSize: '0.875rem',
        fontFamily: 'inherit',
        outline: 'none',
        width: '100%',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onFocus={e => {
        e.target.style.borderColor = 'rgba(79,195,247,0.4)';
        e.target.style.boxShadow = '0 0 0 3px rgba(79,195,247,0.08)';
      }}
      onBlur={e => {
        e.target.style.borderColor = 'rgba(79,195,247,0.12)';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, unit, variant = 'neutral', icon }: {
  label: string; value: string | number; unit?: string; variant?: BadgeVariant; icon?: string;
}) {
  const colors: Record<BadgeVariant, string> = {
    success: '#4ADE80', warning: '#FCD34D', danger: '#FCA5A5',
    info: '#4FC3F7', neutral: '#94A3B8', accent: '#A78BFA',
  };
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(79,195,247,0.08)',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.78rem', color: '#3A6278', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: '1.2rem' }}>{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '1.8rem', fontWeight: 800, color: colors[variant], letterSpacing: '-0.03em' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: '0.85rem', color: '#3A6278' }}>{unit}</span>}
      </div>
    </div>
  );
}

// CSS global à ajouter dans index.css
export const UI_KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
`;
