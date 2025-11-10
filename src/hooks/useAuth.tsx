import React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { jwtDecode } from 'jwt-decode';


interface JWTClaims {
  user_role?: string;
  org_id?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: string | null;
  orgId: string | null;
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
  const [orgId, setOrgId] = useState<string | null>(null);

  // Function to decode JWT and extract claims
  const decodeJWTClaims = (token: string) => {
    try {
      const decoded = jwtDecode<JWTClaims>(token);
      setUserRole(decoded.user_role || null);
      setOrgId(decoded.org_id || null);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      setUserRole(null);
      setOrgId(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Decode JWT claims if session exists
        if (session?.access_token) {
          decodeJWTClaims(session.access_token);
        } else {
          setUserRole(null);
          setOrgId(null);
        }
        
        setLoading(false);

       
        if (event === "PASSWORD_RECOVERY") {
          const newPassword = prompt("What would you like your new password to be?");
          if (newPassword) {
            const { data, error } = await supabase.auth.updateUser({ 
              password: newPassword 
            });
            
            if (data) {
              alert("Password updated successfully!");
            }
            if (error) {
              alert("There was an error updating your password.");
            }
          }
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Decode JWT claims if session exists
      if (session?.access_token) {
        decodeJWTClaims(session.access_token);
      } else {
        setUserRole(null);
        setOrgId(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
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
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/dashboard`,
    });
    return { error };
  };

  const updateUserMetadata = async (metadata: { [key: string]: any }) => {
    const { error } = await supabase.auth.updateUser({
      data: metadata,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      userRole,
      orgId,
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
