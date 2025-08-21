import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { info } from '@/lib/logger';
import { handleError, AuthenticationError } from '@/lib/errorHandler';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    error: null,
  });

  const signOut = useCallback(async (): Promise<void> => {
    try {
      info('User signing out', { userId: state.user?.id });

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        throw new AuthenticationError(`Failed to sign out: ${signOutError.message}`, {
          userId: state.user?.id,
          error: signOutError
        });
      }

      setState(prev => ({
        ...prev,
        user: null,
        session: null,
        error: null,
      }));

      info('User signed out successfully');

    } catch (err) {
      handleError(err, {
        userId: state.user?.id,
        operation: 'signOut'
      });

      if (err instanceof AuthenticationError) {
        setState(prev => ({ ...prev, error: err.message }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Une erreur s\'est produite lors de la déconnexion.'
        }));
      }
    }
  }, [state.user?.id]);

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      info('User attempting to sign in', { email });

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new AuthenticationError(`Failed to sign in: ${signInError.message}`, {
          email,
          error: signInError
        });
      }

      if (!data.user || !data.session) {
        throw new AuthenticationError('No user or session returned from sign in');
      }

      setState(prev => ({
        ...prev,
        user: data.user,
        session: data.session,
        isLoading: false,
        error: null,
      }));

      info('User signed in successfully', { userId: data.user.id });

    } catch (err) {
      handleError(err, {
        email,
        operation: 'signIn'
      });

      if (err instanceof AuthenticationError) {
        setState(prev => ({ ...prev, error: err.message, isLoading: false }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Une erreur s\'est produite lors de la connexion.',
          isLoading: false
        }));
      }
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      info('User attempting to sign up', { email });

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        throw new AuthenticationError(`Failed to sign up: ${signUpError.message}`, {
          email,
          error: signUpError
        });
      }

      if (!data.user) {
        throw new AuthenticationError('No user returned from sign up');
      }

      setState(prev => ({
        ...prev,
        user: data.user,
        session: data.session,
        isLoading: false,
        error: null,
      }));

      info('User signed up successfully', { userId: data.user.id });

    } catch (err) {
      handleError(err, {
        email,
        operation: 'signUp'
      });

      if (err instanceof AuthenticationError) {
        setState(prev => ({ ...prev, error: err.message, isLoading: false }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Une erreur s\'est produite lors de l\'inscription.',
          isLoading: false
        }));
      }
    }
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      info('User requesting password reset', { email });

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (resetError) {
        throw new AuthenticationError(`Failed to send password reset: ${resetError.message}`, {
          email,
          error: resetError
        });
      }

      setState(prev => ({ ...prev, isLoading: false, error: null }));
      info('Password reset email sent successfully', { email });

    } catch (err) {
      handleError(err, {
        email,
        operation: 'resetPassword'
      });

      if (err instanceof AuthenticationError) {
        setState(prev => ({ ...prev, error: err.message, isLoading: false }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Une erreur s\'est produite lors de l\'envoi de l\'email de réinitialisation.',
          isLoading: false
        }));
      }
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string): Promise<void> => {
    try {
      if (!state.user) {
        throw new AuthenticationError('No authenticated user');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      info('User updating password', { userId: state.user.id });

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        throw new AuthenticationError(`Failed to update password: ${updateError.message}`, {
          userId: state.user.id,
          error: updateError
        });
      }

      setState(prev => ({ ...prev, isLoading: false, error: null }));
      info('Password updated successfully', { userId: state.user.id });

    } catch (err) {
      handleError(err, {
        userId: state.user?.id,
        operation: 'updatePassword'
      });

      if (err instanceof AuthenticationError) {
        setState(prev => ({ ...prev, error: err.message, isLoading: false }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Une erreur s\'est produite lors de la mise à jour du mot de passe.',
          isLoading: false
        }));
      }
    }
  }, [state.user]);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async (): Promise<void> => {
      try {
        debug('Initializing auth state');

        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw new AuthenticationError(`Failed to get session: ${sessionError.message}`, {
            error: sessionError
          });
        }

        if (mounted) {
          setState(prev => ({
            ...prev,
            user: session?.user ?? null,
            session,
            isLoading: false,
            error: null,
          }));

          if (session?.user) {
            info('User session restored', { userId: session.user.id });
          } else {
            debug('No active session found');
          }
        }
      } catch (err) {
        handleError(err, { operation: 'initializeAuth' });

        if (mounted) {
          if (err instanceof AuthenticationError) {
            setState(prev => ({ ...prev, error: err.message, isLoading: false }));
          } else {
            setState(prev => ({
              ...prev,
              error: 'Une erreur s\'est produite lors de l\'initialisation de l\'authentification.',
              isLoading: false
            }));
          }
        }
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        debug('Auth state change', { event, userId: session?.user?.id });

        if (!mounted) return;

        try {
          switch (event) {
            case 'SIGNED_IN':
              info('User signed in', { userId: session?.user?.id });
              break;
            case 'SIGNED_OUT':
              info('User signed out');
              break;
            case 'TOKEN_REFRESHED':
              debug('Token refreshed', { userId: session?.user?.id });
              break;
            case 'USER_UPDATED':
              info('User updated', { userId: session?.user?.id });
              break;
            case 'USER_DELETED':
              info('User deleted', { userId: session?.user?.id });
              break;
            default:
              debug('Unknown auth event', { event });
          }

          setState(prev => ({
            ...prev,
            user: session?.user ?? null,
            session,
            isLoading: false,
            error: null,
          }));
        } catch (err) {
          handleError(err, {
            event,
            userId: session?.user?.id,
            operation: 'authStateChange'
          });
        }
      }
    );

    // Initialize auth state
    void initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    user: state.user,
    session: state.session,
    isLoading: state.isLoading,
    error: state.error,
    signOut,
    signIn,
    signUp,
    resetPassword,
    updatePassword,
    isAuthenticated: !!state.user,
    clearError: () => setState(prev => ({ ...prev, error: null })),
  };
};
