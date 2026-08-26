import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import api, { setTokens, clearTokens } from '../services/api';

export interface AuthUser {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  role: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
  const saved = localStorage.getItem('sc_user');
  return saved ? JSON.parse(saved) : null;
});
  const [isLoading, setIsLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      localStorage.setItem('sc_user', JSON.stringify(data.user));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    localStorage.removeItem('sc_user');
    setUser(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

// Matrice des droits par rôle
export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  DIRECTEUR: 'Directeur',
  RESP_ACHATS: 'Resp. Achats',
  GEST_STOCK: 'Gest. Stock',
  RESP_PROD: 'Resp. Production',
  OPERATEUR: 'Opérateur',
  QUALITE: 'Qualité',
  LOGISTICIEN: 'Logisticien',
  LECTURE: 'Lecture seule',
};

export const canAccess = (role: string, module: string): boolean => {
  const fullAccess = ['ADMIN', 'DIRECTEUR'];
  if (fullAccess.includes(role)) return true;

  const permissions: Record<string, string[]> = {
    achats:      ['RESP_ACHATS', 'GEST_STOCK'],
    stock:       ['GEST_STOCK', 'RESP_PROD', 'RESP_ACHATS'],
    production:  ['RESP_PROD', 'OPERATEUR'],
    qualite:     ['QUALITE', 'RESP_PROD'],
    expeditions: ['LOGISTICIEN', 'RESP_ACHATS'],
    reporting:   ['RESP_ACHATS', 'RESP_PROD', 'LOGISTICIEN'],
    referentiels:['RESP_ACHATS', 'RESP_PROD', 'GEST_STOCK'],
  };

  return permissions[module]?.includes(role) ?? false;
};
