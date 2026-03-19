import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type PlanType = 'pay_per_check' | 'basic' | 'premium';

export interface UserSubscription {
  id: string;
  user_id: string;
  plan: PlanType;
  check_in_count: number;
  plan_limit: number | null;
  is_paused: boolean;
  period_start: string;
  period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

const PLAN_LIMITS: Record<PlanType, number | null> = {
  pay_per_check: null, // Illimité, payé à l'usage
  basic: 15,
  premium: 50,
};

export function useSubscription() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();
      if (error) {
        if (error.code === 'PGRST116') {
          // Pas d'abonnement : créer un par défaut (Pay per Check)
          const { data: inserted, error: insertError } = await supabase
            .from('user_subscriptions')
            .insert({
              user_id: user.id,
              plan: 'pay_per_check',
              check_in_count: 0,
              plan_limit: null,
              is_paused: false,
              period_start: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (insertError) {
            console.warn('Could not create default subscription:', insertError);
            return null;
          }
          return inserted as UserSubscription;
        }
        throw error;
      }
      return data as UserSubscription;
    },
    enabled: !!user?.id,
  });

  const plan = subscription?.plan ?? 'pay_per_check';
  const checkInCount = subscription?.check_in_count ?? 0;
  const planLimit = subscription?.plan_limit ?? PLAN_LIMITS[plan];
  const isOverLimit = planLimit !== null && checkInCount >= planLimit;
  const isPaused = subscription?.is_paused ?? false;

  const incrementCheckIn = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const newCount = (subscription?.check_in_count ?? 0) + 1;
      const payload = {
        user_id: user.id,
        plan: subscription?.plan ?? 'pay_per_check',
        check_in_count: newCount,
        period_start: subscription?.period_start ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from('user_subscriptions')
        .upsert(payload, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] });
    },
  });

  return {
    subscription,
    plan,
    planLimit,
    checkInCount,
    isOverLimit,
    isPaused,
    isLoading,
    incrementCheckIn,
  };
}
