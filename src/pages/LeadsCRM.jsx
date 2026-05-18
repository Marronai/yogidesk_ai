import React from 'react';
import { Megaphone, Sparkles } from 'lucide-react';

const LeadsCRM = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8fafc] p-4 font-sans sm:p-6 lg:p-10">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-orange-100 bg-white p-8 text-center shadow-sm sm:p-12">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-50 text-orange-600">
            <Megaphone size={38} />
          </div>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-orange-700">
            <Sparkles size={14} />
            Coming Soon
          </div>
          <h1 className="mx-auto mt-6 max-w-3xl text-3xl font-black leading-tight text-slate-950 sm:text-4xl">
            Upcoming Project: Yogi Desk Ads CRM.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-500">
            Automatically sync and follow up with Meta & Google Ads leads in real-time. Launching Soon!
          </p>
        </div>
      </div>
    </div>
  );
};

export default LeadsCRM;
