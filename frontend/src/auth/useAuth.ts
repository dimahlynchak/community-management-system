import { useContext } from 'react';
import { AuthContext, AuthContextValue } from './AuthContext';

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth повинен викликатися всередині AuthProvider');
  }
  return ctx;
}
