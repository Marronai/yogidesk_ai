import React from 'react';
import Lottie from 'lottie-react';
import doctorLoadingAnimation from '../assets/animations/doctor-loading.json';

const AuthLoadingScreen = ({ tone = 'light', message = 'Preparing your secure workspace...' }) => {
  const isDark = tone === 'dark';

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center overflow-visible transition-opacity duration-300 ${isDark ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
      <div className="flex flex-col items-center justify-center gap-5 overflow-visible px-6 text-center">
        <div className="flex h-[min(62vw,440px)] w-[min(62vw,440px)] min-h-72 min-w-72 items-center justify-center overflow-visible">
          <Lottie
            animationData={doctorLoadingAnimation}
            loop
            autoplay
            style={{ width: '100%', height: '100%', margin: 0 }}
          />
        </div>
        <div className="h-1.5 w-64 overflow-hidden rounded-full bg-slate-200">
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
