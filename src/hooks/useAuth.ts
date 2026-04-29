import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const clearInvalidSession = async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* ignore */
      }
      if (mounted) {
        setSession(null);
        setUser(null);
        setIsLoading(false);
      }
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
        window.location.href = '/auth';
      }
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      const msg = error?.message?.toLowerCase() ?? '';
      if (
        error &&
        (msg.includes('refresh token') ||
          msg.includes('refresh_token') ||
          msg.includes('invalid refresh'))
      ) {
        void clearInvalidSession();
        return;
      }
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return {
    user,
    session,
    isLoading,
    signOut,
    isAuthenticated: !!user,
  };
};

