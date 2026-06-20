import React, { useEffect, useMemo, useState } from 'react';
import { Play, Video, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { getVideoHelpId } from '../config/videoHelpRegistry';

const VideoHelpGuide = () => {
  const { pathname } = useLocation();
  const [showHint, setShowHint] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const currentVideoId = useMemo(() => getVideoHelpId(pathname), [pathname]);

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      setShowHint(true);
      setIsModalOpen(false);
    }, 0);
    const hintTimer = window.setTimeout(() => setShowHint(false), 4000);
    return () => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(hintTimer);
    };
  }, [pathname]);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsModalOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen]);

  return (
    <>
      <div className="fixed right-0 top-20 z-50 flex items-center md:top-6">
        <div
          role="status"
          aria-live="polite"
          className={`absolute right-full mr-3 whitespace-nowrap rounded-xl border border-[#FF6B00]/20 bg-[#FFFFFF] px-3 py-2 text-xs font-extrabold text-[#111827] shadow-xl shadow-slate-950/10 transition-all duration-300 ${
            showHint ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-2 opacity-0'
          }`}
        >
          💡 Need help? Watch a 1-minute tutorial!
          <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-r border-t border-[#FF6B00]/20 bg-[#FFFFFF]" />
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="group flex h-12 w-12 touch-manipulation items-center justify-center rounded-l-2xl border-2 border-r-0 border-[#FF6B00] bg-[#111827] text-[#FFFFFF] shadow-xl shadow-slate-950/25 transition duration-200 hover:w-14 hover:bg-[#FF6B00] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6B00]/30 active:scale-95 sm:h-14 sm:w-14 sm:hover:w-16"
          aria-label="Open page tutorial video"
          aria-haspopup="dialog"
          title="Open video help"
        >
          <Video size={24} strokeWidth={2.5} className="transition-transform group-hover:scale-110 sm:h-7 sm:w-7" />
        </button>
      </div>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-help-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsModalOpen(false);
          }}
        >
          <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-white/10 bg-[#111827] shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-white sm:px-6 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF6B00]">
                  <Play size={18} fill="currentColor" />
                </span>
                <h2 id="video-help-title" className="truncate text-sm font-black sm:text-lg">
                  Page Tutorial
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl bg-white/10 text-white transition hover:bg-[#FF6B00] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]"
                aria-label="Close tutorial video"
              >
                <X size={22} />
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              <iframe
                key={`${pathname}-${currentVideoId}`}
                className="h-full w-full border-0"
                src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1`}
                title="YogiDesk page tutorial"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VideoHelpGuide;
