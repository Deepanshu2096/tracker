import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any, data: any }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
  updateUserMetadata: (metadata: { [key: string]: any }) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  // Memoized function to fetch role from profiles table
  const fetchUserRole = useCallback(async (userId: string) => {
    if (!userId) {
      setUserRole(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching user role from profiles:', error);
        setUserRole(null);
        return;
      }

      if (data) {
        const role = data.role || null;
        console.log('🔐 User Role fetched:', role);
        console.log('👤 User ID:', userId);
        setUserRole(role);
      } else {
        console.log('⚠️ No profile data found for user:', userId);
        setUserRole(null);
      }
    } catch (error) {
      console.error('Error fetching user role from profiles:', error);
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    // Initialize auth state - set loading to false quickly
    const initializeAuth = async () => {
      try {
        // Get initial session with timeout protection
        const sessionPromise = supabase.auth.getSession();
        
        // Race with a timeout to prevent hanging
        const timeoutPromise = new Promise<{ data: { session: null }, error: null }>((resolve) => {
          setTimeout(() => resolve({ data: { session: null }, error: null }), 5000);
        });

        const result = await Promise.race([sessionPromise, timeoutPromise]);
        const { data: { session }, error } = result as any;
        
        // Handle network errors gracefully
        if (error && (error.message?.includes('hostname') || error.message?.includes('could not be found') || error.message?.includes('Failed to fetch'))) {
          console.error('❌ Supabase connection error:', error.message);
          console.error('💡 Please check:');
          console.error('   1. Your internet connection');
          console.error('   2. Supabase project URL in .env file');
          console.error('   3. If your Supabase project is active (not paused)');
          // Don't throw, just log and continue without session
        }

        if (!mounted) return;

        if (error) {
          console.error('Error getting initial session:', error);
          if (mounted) setLoading(false);
          return;
        }

        if (session?.user) {
          console.log('✅ Session found for user:', session.user.id);
          setSession(session);
          setUser(session.user);
          // Fetch role in background, don't block
          fetchUserRole(session.user.id).catch(console.error);
        } else {
          console.log('❌ No session found');
          setSession(null);
          setUser(null);
          setUserRole(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        // Always set loading to false, even if there's an error
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Set up auth state change listener
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        try {
          console.log('🔄 Auth state changed:', event);
          console.log('👤 User:', session?.user?.id || 'None');
          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user?.id) {
            // Fetch role in background
            fetchUserRole(session.user.id).catch(console.error);
          } else {
            console.log('❌ No user in session, clearing role');
            setUserRole(null);
          }

          // Handle password recovery
        if (event === "PASSWORD_RECOVERY") {
          const newPassword = prompt("What would you like your new password to be?");
          if (newPassword) {
            const { data, error } = await supabase.auth.updateUser({ 
              password: newPassword 
            });
            
              if (error) {
                alert("There was an error updating your password: " + error.message);
              } else if (data) {
              alert("Password updated successfully!");
            }
            }
          }
        } catch (error) {
          console.error('Error in auth state change:', error);
        }
      }
    );

    subscription = authSubscription;

    // Initialize auth
    initializeAuth();

    // Safety timeout: always set loading to false after max 3 seconds
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('Auth initialization timeout - forcing loading to false');
      setLoading(false);
      }
    }, 3000);

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fetchUserRole]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error, data };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard`,
    });
    return { error };
  }, []);

  const updateUserMetadata = useCallback(async (metadata: { [key: string]: any }) => {
    const { error } = await supabase.auth.updateUser({
      data: metadata,
    });
    return { error };
  }, []);

  // Log role changes to console for debugging
  useEffect(() => {
    console.log('📋 Current Auth State:');
    console.log('  - User:', user?.email || 'None');
    console.log('  - User ID:', user?.id || 'None');
    console.log('  - Role:', userRole || 'None');
    console.log('  - Loading:', loading);
    console.log('  - Has Session:', !!session);
  }, [user, userRole, loading, session]);

  // Always render children - loading state is handled by individual pages
  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      userRole,
      signIn,
      signUp,
      signOut,
      resetPasswordForEmail,
      updateUserMetadata,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
