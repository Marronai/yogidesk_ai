import React from 'react';
import { Loader2 } from 'lucide-react';

const AuthLoadingScreen = ({ tone = 'light' }) => {
  const isDark = tone === 'dark';

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className={`flex h-16 w-16 items-center justify-center rounded-md ${isDark ? 'bg-slate-900 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
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
