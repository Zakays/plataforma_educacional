import { useState, useEffect } from 'react';
import { User, Profile, ROUTE_PATHS } from '@/lib/index';
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

export const useAuth = (): AuthState & AuthActions => {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const refreshUser = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { user, profile, error } = await getCurrentUser();
    setState({ user, profile, loading: false, error });
  };

  useEffect(() => {
    refreshUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await refreshUser();
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, profile: null, loading: false, error: null });
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { user, error } = await supabaseSignIn(email, password);
    
    if (error) {
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }

    await refreshUser();
  };

  const register = async (email: string, password: string, nome: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { user, error } = await supabaseSignUp(email, password, nome);
    
    if (error) {
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }

    await refreshUser();
  };

  const logout = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const { error } = await supabaseSignOut();
    
    if (error) {
      setState((prev) => ({ ...prev, loading: false, error }));
      throw error;
    }

    setState({ user: null, profile: null, loading: false, error: null });
  };

  const isAdmin = (): boolean => {
    return state.profile?.role === 'admin';
  };

  return {
    ...state,
    login,
    register,
    logout,
    isAdmin,
    refreshUser,
  };
};
