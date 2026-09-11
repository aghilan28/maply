import React from 'react';
import { ArrowRight } from 'lucide-react';

interface HeroCenterProps {
  onLaunchMaply: () => void;
}

export const HeroCenter: React.FC<HeroCenterProps> = ({ onLaunchMaply }) => {
  return (
    <div className="flex flex-col items-center text-center px-4 max-w-4xl mx-auto relative z-10">
      {/* Headline */}
      <h1
        className="text-4xl sm:text-5xl md:text-[56px] lg:text-[62px] font-bold tracking-tight text-white leading-[1.12] max-w-3xl"
        style={{ textShadow: '0 6px 24px rgba(0, 0, 0, 0.95), 0 2px 10px rgba(0, 0, 0, 0.95)' }}
      >
        Your World.
        <br />
        <span
          className="text-slate-100"
          style={{ textShadow: '0 6px 24px rgba(0, 0, 0, 0.95), 0 2px 10px rgba(0, 0, 0, 0.95)' }}
        >
          Saved Beautifully.
        </span>
      </h1>

      {/* Subheading */}
      <p
        className="mt-5 text-sm sm:text-base md:text-lg text-slate-100 font-medium leading-relaxed max-w-xl mx-auto"
        style={{ textShadow: '0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.95)' }}
      >
        Discover the places worth remembering. Save them on your map, organize your favorites, and come back whenever you want.
      </p>

      {/* Primary CTA Button */}
      <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={onLaunchMaply}
          className="group bg-white hover:bg-slate-100 text-black font-semibold rounded-full pl-6 pr-2 py-2 flex items-center space-x-3 text-sm sm:text-base transition-all duration-300 shadow-2xl hover:scale-[1.02] active:scale-95 cursor-pointer"
        >
          <span>Explore your map</span>
          <div className="w-8 h-8 rounded-full bg-[#0066FF] group-hover:bg-[#0052CC] text-white flex items-center justify-center transition-all duration-300 transform group-hover:translate-x-0.5 shadow-md">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </button>
      </div>
    </div>
  );
};
