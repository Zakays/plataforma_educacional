import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User, Profile } from '@/lib/index';
import {
  supabase,
  getCurrentUser,
  signIn as supabaseSignIn,
  signUp as supabaseSignUp,
  signOut as supabaseSignOut,
} from '@/lib/supabase';

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: Error | null;
}

export interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, nome: string) => Promise<{ requiresEmailConfirmation: boolean }>;
  logout: () => Promise<void>;
  isAdmin: () => boolean;
  refreshUser: (opts?: { silent?: boolean }) => Promise<void>;
}

export type AuthContextValue = AuthState & AuthActions;

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const isSessionError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /session|jwt|token|refresh/i.test(error.message);
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const refreshUser = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;

    if (!silent) {
      setState((prev) => ({ ...prev, loading: true, error: null }));
    }

    const { user, profile, error } = await getCurrentUser();

    if (error && isSessionError(error)) {
      await supabase.auth.signOut({ scope: 'local' });
      setState({ user: null, profile: null, loading: false, error: null });
      return;
    }

    setState((prev) => ({
      user,
      profile,
      loading: false,
      error: error ?? (silent ? prev.error : null),
    }));
  }, []);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }

      if (!data.session) {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }

      await refreshUser({ silent: true });
    };

    void bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }

      if (event === 'SIGNED_OUT') {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void refreshUser({ silent: true });
      }
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
    const { error, requiresEmailConfirmation } = await supabaseSignUp(email, password, nome);

    if (error) {
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }

    await refreshUser();
    return { requiresEmailConfirmation };
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

  const isAdmin = useCallback((): boolean => state.profile?.role === 'admin', [state.profile?.role]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login,
      register,
      logout,
      isAdmin,
      refreshUser,
    }),
    [state, login, register, logout, isAdmin, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
