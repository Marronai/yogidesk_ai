import React from 'react';

const HiddenNotFound = () => (
  <div className="flex min-h-screen items-center justify-center bg-white px-6 text-slate-900">
    <div className="text-center">
      <p className="text-sm font-black uppercase tracking-widest text-slate-400">404</p>
      <h1 className="mt-3 text-3xl font-black">Page not found</h1>
      <p className="mt-2 text-sm font-semibold text-slate-500">The page you requested does not exist.</p>
    </div>
  </div>
);

export default HiddenNotFound;
