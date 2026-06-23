import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '@/api';

export interface AuthUser {
  username: string;
  role: 'admin' | 'viewer';
  displayName?: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  isAdmin: false,
  isLoggedIn: false,
});

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // 启动时从 localStorage 恢复登录态（token 未过期才恢复）
  useEffect(() => {
    const saved = localStorage.getItem('auth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.token && !isTokenExpired(parsed.token)) {
          setUser(parsed.user);
          setToken(parsed.token);
        } else {
          localStorage.removeItem('auth');
        }
      } catch {
        localStorage.removeItem('auth');
      }
    }
  }, []);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const res = await api.post('/api/auth/login', { username, password, rememberMe });
    const auth = { user: res.data.user, token: res.data.access_token };
    localStorage.setItem('auth', JSON.stringify(auth));
    if (rememberMe) {
      localStorage.setItem('__saved_creds', JSON.stringify({ username }));
    }
    setUser(auth.user);
    setToken(auth.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth');
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAdmin: user?.role === 'admin',
        isLoggedIn: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
