import React from 'react';

export const PlaceholderPanel: React.FC = () => {
  return (
    <div className="h-full w-full p-8">
      <div className="h-full w-full rounded-2xl border border-dashed border-slate-600 bg-slate-900/70 flex flex-col items-center justify-center text-center px-6">
        <p className="text-xs tracking-[0.18em] uppercase text-amber-300 font-semibold">Visual Placeholder</p>
        <p className="mt-3 text-2xl font-bold text-slate-100">Next Release</p>
        <p className="mt-2 text-slate-300">Feature not yet implemented in the live app.</p>
      </div>
    </div>
  );
};
