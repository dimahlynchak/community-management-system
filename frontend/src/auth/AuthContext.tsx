import { createContext, ReactNode, useEffect, useState } from 'react';
import {
  getAccessToken,
  setAccessToken,
  setUnauthorizedHandler,
} from '../api/client';
import { getMe, login as apiLogin, logout as apiLogout } from '../api/auth';
import type { User } from '../types/api';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<User | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface Props {
  children: ReactNode;
}

export function AuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setUnauthorizedHandler(() => {
      setUser(null);
    });

    (async () => {
      const token = getAccessToken();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await getMe();
        if (!cancelled) setUser(me);
      } catch {
        setAccessToken(null);
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<User> => {
    const { access_token } = await apiLogin(email, password);
    setAccessToken(access_token);
    const me = await getMe();
    setUser(me);
    return me;
  };

  const signOut = async (): Promise<void> => {
    try {
      await apiLogout();
    } catch {
      // ignore — refresh-token cookie буде очищений сервером або застаріє
    }
    setAccessToken(null);
    setUser(null);
  };

  const refreshUser = async (): Promise<User | null> => {
    try {
      const me = await getMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  };

  const value: AuthContextValue = {
    user,
    loading,
    signIn,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
