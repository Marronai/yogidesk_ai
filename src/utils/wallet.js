const WALLET_STORAGE_KEY = 'yogi_wallet';

export const MESSAGE_RATES = {
  utility: 0.2,
  marketing: 0.9,
};

export const getWallet = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(WALLET_STORAGE_KEY) || '{}');
    return {
      balance: Number(stored.balance ?? 0),
      is_first_recharge: stored.is_first_recharge ?? true,
      welcome_gift_active: stored.welcome_gift_active ?? false,
      last_cashback: Number(stored.last_cashback ?? 0),
    };
  } catch {
    return {
      balance: 0,
      is_first_recharge: true,
      welcome_gift_active: false,
      last_cashback: 0,
    };
  }
};

export const saveWallet = (wallet) => {
  const safeWallet = {
    balance: Number(wallet.balance ?? 0),
    is_first_recharge: wallet.is_first_recharge ?? true,
    welcome_gift_active: wallet.welcome_gift_active ?? false,
    last_cashback: Number(wallet.last_cashback ?? 0),
  };

  localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(safeWallet));
  localStorage.setItem('wallet_balance', safeWallet.balance.toFixed(2));
  localStorage.setItem('wallet_is_first_recharge', String(safeWallet.is_first_recharge));
  return safeWallet;
};

export const ensureWallet = ({ welcomeGift = false } = {}) => {
  const hasWallet = localStorage.getItem(WALLET_STORAGE_KEY);
  const wallet = getWallet();

  if (!hasWallet && welcomeGift) {
    return saveWallet({
      ...wallet,
      balance: 50,
      welcome_gift_active: true,
      is_first_recharge: true,
    });
  }

  if (!hasWallet) {
    return saveWallet(wallet);
  }

  return wallet;
};

export const calculateRechargeCashback = (amount, isFirstRecharge) => {
  const rechargeAmount = Number(amount);
  if (!Number.isFinite(rechargeAmount) || rechargeAmount < 200) return 0;

  if (isFirstRecharge) {
    return Number((rechargeAmount * 0.05).toFixed(2));
  }

  return Math.floor(Math.random() * 5) + 2;
};

export const rechargeWallet = (amount) => {
  const rechargeAmount = Number(amount);
  if (!Number.isFinite(rechargeAmount) || rechargeAmount < 100) {
    throw new Error('Minimum recharge amount is Rs. 100.');
  }

  const wallet = getWallet();
  const cashback = calculateRechargeCashback(rechargeAmount, wallet.is_first_recharge);
  return saveWallet({
    ...wallet,
    balance: wallet.balance + rechargeAmount + cashback,
    is_first_recharge: false,
    last_cashback: cashback,
  });
};

export const calculateMessageCost = (templateType, count = 1) => {
  const rate = MESSAGE_RATES[templateType] ?? MESSAGE_RATES.utility;
  return Number((rate * Number(count || 1)).toFixed(2));
};
