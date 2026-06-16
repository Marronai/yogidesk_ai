import React from 'react';
import Lottie from 'lottie-react';
import doctorLoadingAnimation from '../assets/animations/doctor-loading.json';

const AuthLoadingScreen = ({ tone = 'light', message = 'Preparing your secure workspace...' }) => {
  const isDark = tone === 'dark';

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center overflow-visible transition-opacity duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
      <div className="flex flex-col items-center justify-center gap-4 overflow-visible px-8 pr-10 text-center">
        <div className="flex items-center justify-center gap-3 overflow-visible pr-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-lg font-black text-white shadow-lg shadow-orange-200">
            Y
          </div>
          <span className="whitespace-nowrap pr-1 text-2xl font-black tracking-normal text-current">
            YogiDesk
          </span>
        </div>
        <div className="flex h-48 w-48 items-center justify-center overflow-visible">
          <Lottie
            animationData={doctorLoadingAnimation}
            loop
            autoplay
            style={{ width: 190, height: 190, margin: 0 }}
          />
        </div>
        <div className="h-1 w-48 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-orange-500" />
        </div>
        <p className={`max-w-xs text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
          {message}
        </p>
      </div>
    </div>
  );
};

export default AuthLoadingScreen;
