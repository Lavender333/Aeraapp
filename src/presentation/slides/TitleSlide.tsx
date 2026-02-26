import React from 'react';
import { Church } from 'lucide-react';

export const TitleSlide: React.FC = () => {
  return (
    <div className="h-full w-full flex items-center justify-center p-8">
      <div className="w-full max-w-4xl text-center">
        <div className="mx-auto w-28 h-28 rounded-2xl border-2 border-amber-300/80 flex items-center justify-center shadow-xl bg-slate-900/70">
          <Church className="w-14 h-14 text-amber-300" />
        </div>
        <h1 className="mt-8 text-5xl font-bold tracking-wide text-slate-100">AERA</h1>
        <div className="w-24 h-1 mx-auto mt-6 mb-6 bg-amber-300/80" />
        <h2 className="text-2xl text-slate-300 font-light tracking-[0.1em] uppercase">Preparedness Architecture</h2>
        <p className="mt-4 text-slate-400 text-base tracking-wide">Before, During, and After Disaster</p>
      </div>
    </div>
  );
};
