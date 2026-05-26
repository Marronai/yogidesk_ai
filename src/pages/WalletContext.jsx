import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabaseClient';
import { saveWallet } from '../utils/wallet'; // Assuming saveWallet is still needed for localStorage fallback
import { Loader } from 'lucide-react'; // For skeleton loader

// Helper functions (moved from YogiWallet.jsx)
const normalizeSupabaseId = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return String(value.id || value.user_id || value.sub || '').trim();
  return String(value || '').trim();
};
const isCleanFilterValue = (value) => Boolean(value && value !== 'undefined' && value !== 'null' && value !== '[object Object]');

const WalletContext = createContext(null);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

export const WalletProvider = ({ children }) => {
  const [wallet, setWallet] = useState({ balance: 0, is_first_recharge: true, welcome_gift_active: false, current_plan: 'starter', plan_tier: 'starter' });
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

    const { data, error } = await supabase
      .from('wallets')
      .select('balance,is_first_recharge,welcome_gift_active,current_plan,plan_tier')
      .eq('user_id', currentUserId)
      .maybeSingle();

    if (!error && data) {
      saveWallet(data); // Update localStorage for initial hydration/fallback
      return data;
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
        saveWallet(createdWallet);
        return createdWallet;
      }
    }
    return { balance: 0, is_first_recharge: true, welcome_gift_active: false, current_plan: 'starter', plan_tier: 'starter' };
  }, []);

  const fetchTransactions = useCallback(async (currentUserId) => {
    if (!isCleanFilterValue(currentUserId)) return [];
    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    return error ? [] : data;
  }, []);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      const currentUserId = await getUserId();
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
    const walletSubscription = supabase
      .channel(`wallet_realtime_${userId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'wallets', 
        filter: `user_id=eq.${userId}` 
      }, (payload) => {
        if (payload.new && isMounted) setWallet(payload.new);
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
      .subscribe();

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      supabase.removeChannel(walletSubscription);
    };
  }, [userId, getUserId, fetchWalletData, fetchTransactions]);

  const value = { wallet, transactions, loading, userId, fetchWalletData, fetchTransactions };

  return (
    <WalletContext.Provider value={value}>
      {loading ? <WalletLoader /> : children}
    </WalletContext.Provider>
  );
};

// Simple skeleton loader for initial wallet data fetch
const WalletLoader = () => (
  <div className="flex h-screen items-center justify-center bg-[#F9FAFB]">
    <div className="flex flex-col items-center gap-4">
      <Loader className="h-10 w-10 animate-spin text-orange-600" />
      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Loading Wallet...</p>
    </div>
  </div>
);