import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../services/supabase/client';
import type { ProfileRow, DepartmentRow, UserRole } from '../types/database.types';

export type UserProfile = ProfileRow & {
  departments?: DepartmentRow | null;
};

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  role: UserRole | null;
  departmentCode: string | null;
  isAdmin: boolean;
  isReviewer: boolean;
  isOfficer: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isConfigured = isSupabaseConfigured();

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          departments(*)
        `)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Could not load profile from profiles table:', error.message);
        return null;
      }

      return data as unknown as UserProfile;
    } catch (err) {
      console.warn('Exception during profile fetch:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  };

  useEffect(() => {
    let mounted = true;

    // Remove the legacy client-only demo login cache. It was not a real
    // Supabase Auth session, so requests ran as `anon` and were correctly
    // blocked by the complaints table's RLS policies. Only trust a Supabase
    // Auth session for dashboard data access.
    sessionStorage.removeItem('aicte_session_user');
    sessionStorage.removeItem('aicte_session_profile');

    const timeoutTimer = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 2000);

    if (!isConfigured) {
      setIsLoading(false);
      clearTimeout(timeoutTimer);
      return;
    }

    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) console.warn('Auth getSession error:', error.message);

        if (mounted) {
          setSession(session ?? null);
          setUser(session?.user ?? null);

          if (session?.user) {
            const p = await fetchProfile(session.user.id);
            if (mounted) setProfile(p);
          }
        }
      } catch (err) {
        console.warn('Failed to retrieve active session:', err);
      } finally {
        if (mounted) {
          setIsLoading(false);
          clearTimeout(timeoutTimer);
        }
      }
    };

    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession ?? null);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const p = await fetchProfile(newSession.user.id);
          if (mounted) setProfile(p);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutTimer);
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    setSession(data.session);
    setUser(data.user);
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      setProfile(p);
    }
  };

  const signOut = async () => {
    sessionStorage.removeItem('aicte_session_user');
    sessionStorage.removeItem('aicte_session_profile');
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      setSession(null);
      setIsLoading(false);
    }
  };

  const role = profile?.role ?? null;
  const departmentCode = profile?.departments?.code ?? null;
  const isAdmin = role === 'Administrator';
  const isReviewer = role === 'Cross-Department Reviewer';
  const isOfficer = role === 'Bureau Officer';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        isConfigured,
        role,
        departmentCode,
        isAdmin,
        isReviewer,
        isOfficer,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
