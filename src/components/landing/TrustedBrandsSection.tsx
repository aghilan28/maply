import React from 'react';
import { Compass, Bookmark, Layers, RotateCcw, Heart } from 'lucide-react';

export const TrustedBrandsSection: React.FC = () => {
  const subTextShadowStyle = { textShadow: '0 3px 14px rgba(0, 0, 0, 0.95), 0 1px 6px rgba(0, 0, 0, 0.95)' };

  return (
    <section id="technology" className="w-full bg-transparent text-white py-20 px-4 sm:px-8 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-white/5 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-6xl mx-auto flex flex-col items-center text-center relative z-10">
        <h2 className="text-3xl sm:text-5xl md:text-6xl font-medium text-white tracking-tight leading-[1.12] max-w-4xl">
          Your Favorite Places <br className="hidden sm:block" />
          <span className="text-slate-100">Deserve More Than a Pin</span>
        </h2>

        <p
          className="mt-6 text-sm sm:text-base md:text-lg text-slate-200 font-medium leading-relaxed max-w-2xl mx-auto"
          style={subTextShadowStyle}
        >
          Maply turns the places you discover into a personal map — saved, organized, and ready whenever you want to return.
        </p>

        {/* Feature Row Divider */}
        <div className="w-full border-t border-white/15 mt-16 pt-10">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 items-center justify-items-center opacity-90 hover:opacity-100 transition-opacity">
            <div className="flex items-center space-x-2.5 text-white hover:text-slate-100 transition-colors cursor-pointer group" style={subTextShadowStyle}>
              <Compass className="w-6 h-6 stroke-[1.8] group-hover:scale-105 transition-transform text-white" />
              <div className="text-left leading-tight">
                <span className="block text-xs font-bold tracking-widest uppercase text-white" style={subTextShadowStyle}>DISCOVER</span>
                <span className="block text-[10px] text-slate-200 tracking-wider uppercase" style={subTextShadowStyle}>NEW PLACES</span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-white hover:text-slate-100 transition-colors cursor-pointer group" style={subTextShadowStyle}>
              <Bookmark className="w-6 h-6 stroke-[1.8] group-hover:scale-105 transition-transform text-white" />
              <div className="text-left leading-tight">
                <span className="block text-xs font-bold tracking-widest uppercase text-white" style={subTextShadowStyle}>SAVE</span>
                <span className="block text-[10px] text-slate-200 tracking-wider uppercase" style={subTextShadowStyle}>FAVORITES</span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-white hover:text-slate-100 transition-colors cursor-pointer group" style={subTextShadowStyle}>
              <Layers className="w-6 h-6 stroke-[1.8] group-hover:scale-105 transition-transform text-white" />
              <div className="text-left leading-tight">
                <span className="block text-xs font-bold tracking-widest uppercase text-white" style={subTextShadowStyle}>ORGANIZE</span>
                <span className="block text-[10px] text-slate-200 tracking-wider uppercase" style={subTextShadowStyle}>YOUR WORLD</span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-white hover:text-slate-100 transition-colors cursor-pointer group" style={subTextShadowStyle}>
              <RotateCcw className="w-6 h-6 stroke-[1.8] group-hover:scale-105 transition-transform text-white" />
              <div className="text-left leading-tight">
                <span className="block text-xs font-bold tracking-widest uppercase text-white" style={subTextShadowStyle}>REVISIT</span>
                <span className="block text-[10px] text-slate-200 tracking-wider uppercase" style={subTextShadowStyle}>ANYTIME</span>
              </div>
            </div>

            <div className="flex items-center space-x-2.5 text-white hover:text-slate-100 transition-colors cursor-pointer group col-span-2 sm:col-span-1" style={subTextShadowStyle}>
              <Heart className="w-6 h-6 stroke-[1.8] group-hover:scale-105 transition-transform text-white" />
              <div className="text-left leading-tight">
                <span className="block text-xs font-bold tracking-widest uppercase text-white" style={subTextShadowStyle}>REMEMBER</span>
                <span className="block text-[10px] text-slate-200 tracking-wider uppercase" style={subTextShadowStyle}>EVERY PLACE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
