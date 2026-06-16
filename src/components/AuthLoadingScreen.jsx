import React from 'react';
import { Loader2 } from 'lucide-react';

const AuthLoadingScreen = ({ tone = 'light' }) => {
  const isDark = tone === 'dark';

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center overflow-visible ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
      <div className="flex flex-col items-center justify-center gap-4 overflow-visible px-8 pr-10 text-center">
        <div className="flex items-center justify-center gap-3 overflow-visible pr-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-lg font-black text-white shadow-lg shadow-orange-200">
            Y
          </div>
          <span className="whitespace-nowrap pr-1 text-2xl font-black tracking-normal text-current">
            YogiDesk
          </span>
        </div>
        <div className={`flex h-16 w-16 items-center justify-center rounded-md ${isDark ? 'bg-slate-900 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
          <div className="hidden" data-lottie-placeholder="premium-healthcare-loader" />
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-orange-500" />
        </div>
      </div>
    </div>
  );
};

export default AuthLoadingScreen;
