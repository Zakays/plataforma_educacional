import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User, Profile } from '@/lib/index';
import {
  supabase,
  getCurrentUser,
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  signOut as supabaseSignOut,
} from '@/lib/supabase';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nome: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
  refreshUser: () => Promise<void>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

const isSessionError = (error: Error | null): boolean => {
  if (!error) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('refresh token') ||
    message.includes('invalid jwt') ||
    message.includes('jwt expired') ||
    message.includes('session')
  );
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const refreshUser = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const { user, profile, error } = await getCurrentUser();

    if (error && isSessionError(error)) {
      await supabase.auth.signOut({ scope: 'local' });
      setState({ user: null, profile: null, loading: false, error: null });
      return;
    }

    setState({ user, profile, loading: false, error });
  }, []);

  useEffect(() => {
    refreshUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }

      void refreshUser();
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { error } = await supabaseSignIn(email, password);

    if (error) {
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }

    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (email: string, password: string, nome: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { error } = await supabaseSignUp(email, password, nome);

    if (error) {
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }

    await refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { error } = await supabaseSignOut();

    if (error) {
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }

    setState({ user: null, profile: null, loading: false, error: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      isAdmin: () => state.profile?.role === 'admin',
      refreshUser,
    }),
    [state, login, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider');
  }

  return context;
};
