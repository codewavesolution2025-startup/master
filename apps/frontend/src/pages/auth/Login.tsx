import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/auth.context';
import './Login.css';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Email ou mot de passe incorrect'
      );
    }
  };

  return (
    <div className="login-root">
      <div className="login-bg">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-grid" />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <rect width="36" height="36" rx="10" fill="#0F4C81"/>
              <path d="M8 26 L18 10 L28 26 Z" fill="none" stroke="#4FC3F7" strokeWidth="2" strokeLinejoin="round"/>
              <circle cx="18" cy="18" r="3" fill="#4FC3F7"/>
              <path d="M12 22 H24" stroke="#4FC3F7" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className="login-title">Supply Chain</h1>
            <p className="login-subtitle">Gestion industrielle</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <h2 className="login-heading">Connexion</h2>
          <p className="login-desc">Accédez à votre espace de travail</p>

          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zm.75-4.5a.75.75 0 01-1.5 0V5a.75.75 0 011.5 0v2z"/>
              </svg>
              {error}
            </div>
          )}

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="login-field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="login-spinner" />
            ) : (
              'Se connecter'
            )}
          </button>
        </form>

        <p className="login-footer">
          Supply Chain Industrielle v1.0
        </p>
      </div>
    </div>
  );
}
