import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import api from '../utils/api';
import { saveWallet } from '../utils/wallet'; // Assuming saveWallet is still needed for localStorage fallback

// Helper functions (moved from YogiWallet.jsx)
const normalizeSupabaseId = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return String(value.id || value.user_id || value.sub || '').trim();
  return String(value || '').trim();
};
const isCleanFilterValue = (value) => Boolean(value && value !== 'undefined' && value !== 'null' && value !== '[object Object]');
const normalizeWallet = (walletData = {}) => ({
  ...walletData,
  balance: Number(walletData.balance ?? 0),
  is_first_recharge: walletData.is_first_recharge ?? true,
  welcome_gift_active: walletData.welcome_gift_active ?? false,
  current_plan: walletData.current_plan || 'starter',
  plan_tier: walletData.plan_tier || 'starter',
  runtime_plan: walletData.runtime_plan || walletData.current_plan || walletData.plan_tier || 'starter',
  has_trial_expired: Boolean(walletData.has_trial_expired),
  plan_limits: walletData.plan_limits || null,
});

const applyRuntimePlan = (walletData = {}, profile = {}) => {
  const hasTrialExpired = Boolean(profile.has_trial_expired);
  const runtimePlan = String(profile.runtime_plan || profile.current_plan || profile.plan_tier || walletData.runtime_plan || '').trim();
  const effectivePlan = hasTrialExpired ? 'basic' : (runtimePlan || walletData.current_plan || walletData.plan_tier || 'starter');

  return normalizeWallet({
    ...walletData,
    current_plan: effectivePlan,
    plan_tier: effectivePlan,
    runtime_plan: effectivePlan,
    has_trial_expired: hasTrialExpired,
    plan_limits: profile.plan_limits || walletData.plan_limits || null,
  });
};

const WalletContext = createContext(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState(normalizeWallet({ balance: 0, is_first_recharge: true, welcome_gift_active: false, current_plan: 'starter', plan_tier: 'starter' }));
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);

  // Function to get the current user ID
  const getUserId = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = normalizeSupabaseId(user?.id || localStorage.getItem('user_id'));
    setUserId(currentUserId);
    return currentUserId;
  }, []);

  const fetchWalletData = useCallback(async (currentUserId) => {
    if (!isCleanFilterValue(currentUserId)) return { balance: 0 };

    try {
      const profileResult = await api
        .get('/profile/context', { params: { userId: currentUserId } })
        .catch(() => ({ data: null }));
      const runtimeProfile = profileResult.data?.profile || {};

      const { data, error } = await supabase
        .from('wallets')
        .select('balance,is_first_recharge,welcome_gift_active,current_plan,plan_tier')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (!error && data) {
        const safeWallet = applyRuntimePlan(data, runtimeProfile);
        saveWallet(safeWallet); // Update localStorage for initial hydration/fallback
        return safeWallet;
      }

      if (!data && !error) {
        const defaultWallet = {
          user_id: currentUserId,
          balance: 50.00, // The sign-up bonus
          is_first_recharge: true,
          welcome_gift_active: true,
          current_plan: 'starter',
          plan_tier: 'starter',
          lifetime_contacts_count: 0,
        };

        const { data: createdWallet, error: createError } = await supabase
          .from('wallets')
          .upsert(defaultWallet, { onConflict: 'user_id', ignoreDuplicates: true })
          .select('balance, is_first_recharge, welcome_gift_active, current_plan, plan_tier')
          .single();

        if (!createError && createdWallet) {
          const safeWallet = applyRuntimePlan(createdWallet, runtimeProfile);
          saveWallet(safeWallet);
          return safeWallet;
        }
      }
    } catch (error) {
      console.warn('Wallet table unavailable; continuing with local fallback.', error?.message || error);
    }
    return normalizeWallet({ balance: 0, is_first_recharge: true, welcome_gift_active: false, current_plan: 'starter', plan_tier: 'starter' });
  }, []);

  const fetchTransactions = useCallback(async (currentUserId) => {
    if (!isCleanFilterValue(currentUserId)) return [];
    try {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Wallet transactions unavailable; continuing without history.', error.message);
        return [];
      }
      return data || [];
    } catch (error) {
      console.warn('Wallet transactions unavailable; continuing without history.', error?.message || error);
      return [];
    }
  }, []);

  const refreshWalletData = useCallback(async (targetUserId = userId) => {
    const resolvedUserId = targetUserId || await getUserId();
    const currentUserId = normalizeSupabaseId(resolvedUserId);
    if (!isCleanFilterValue(currentUserId)) return;

    setLoading(true);
    const [walletData, transactionData] = await Promise.all([
      fetchWalletData(currentUserId),
      fetchTransactions(currentUserId)
    ]);

    setWallet(walletData);
    setTransactions(transactionData);
    setLoading(false);
  }, [fetchTransactions, fetchWalletData, getUserId, userId]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      let currentUserId = null;
      try {
        currentUserId = await getUserId();
      } catch (error) {
        console.warn('Unable to resolve Supabase user for wallet context.', error?.message || error);
      }
      if (!isMounted || !currentUserId) {
        setLoading(false);
        return;
      }

      const [walletData, transactionData] = await Promise.all([
        fetchWalletData(currentUserId),
        fetchTransactions(currentUserId)
      ]);

      if (isMounted) {
        setWallet(walletData);
        setTransactions(transactionData);
        setLoading(false);
      }
    };

    init();

    // Supabase Auth State Change Listener
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        init(); // Re-initialize data on auth state change
      }
    });

    // Realtime Subscriptions for Instant UI Updates
    const walletSubscription = isCleanFilterValue(userId)
      ? supabase
        .channel(`wallet_realtime_${userId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'wallets',
          filter: `user_id=eq.${userId}`
        }, (payload) => {
          if (payload.new && isMounted) {
            setWallet((current) => normalizeWallet({
              ...payload.new,
              runtime_plan: current.runtime_plan,
              has_trial_expired: current.has_trial_expired,
              plan_limits: current.plan_limits,
            }));
          }
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'wallet_transactions',
          filter: `user_id=eq.${userId}`
        }, async () => {
          if (isMounted) {
            const freshTx = await fetchTransactions(userId);
            setTransactions(freshTx);
          }
        })
        .subscribe()
      : null;

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      if (walletSubscription) supabase.removeChannel(walletSubscription);
    };
  }, [userId, getUserId, fetchWalletData, fetchTransactions]);

  const value = { wallet, transactions, loading, userId, fetchWalletData, fetchTransactions, refreshWalletData };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
