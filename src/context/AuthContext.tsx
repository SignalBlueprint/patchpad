/**
 * Authentication Context
 *
 * Provides authentication state and methods to the entire app.
 * Wraps Supabase auth for a consistent API.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../config/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
  isConfigured: boolean;
}

export interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
  refreshSession: () => Promise<void>;
}

export type AuthContextType = AuthState & AuthActions;

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [isConfigured, setIsConfigured] = useState(isSupabaseConfigured());

  // Check configuration and initialize auth state
  useEffect(() => {
    const configured = isSupabaseConfigured();
    setIsConfigured(configured);

    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      setError(null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in with email/password
  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } as AuthError };
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError);
    }

    return { error: signInError };
  }, []);

  // Sign up with email/password
  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } as AuthError };
    }

    setLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError);
    }

    return { error: signUpError };
  }, []);

  // Sign out
  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setError(null);
    setLoading(false);
  }, []);

  // Reset password
  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } as AuthError };
    }

    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(resetError);
    }

    return { error: resetError };
  }, []);

  // Sign in with OAuth provider
  const signInWithOAuth = useCallback(async (provider: 'google' | 'github') => {
    const supabase = getSupabase();
    if (!supabase) {
      return { error: { message: 'Supabase not configured' } as AuthError };
    }

    setLoading(true);
    setError(null);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    // Note: loading will be reset by the auth state change listener after redirect
    if (oauthError) {
      setLoading(false);
      setError(oauthError);
    }

    return { error: oauthError };
  }, []);

  // Refresh the session
  const refreshSession = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;

    const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
    setSession(refreshedSession);
    setUser(refreshedSession?.user ?? null);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    error,
    isConfigured,
    signIn,
    signUp,
    signOut,
    resetPassword,
    signInWithOAuth,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  const { user, loading } = useAuth();
  return !loading && user !== null;
}
