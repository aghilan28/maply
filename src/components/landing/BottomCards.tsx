import React from 'react';
import { MapPin, Layers } from 'lucide-react';

export const BottomCards: React.FC = () => {
  return (
    <div className="w-full relative z-10 flex flex-col md:flex-row items-stretch md:items-end justify-between gap-6 pb-2">
      {/* Card 1: Capture Every Place */}
      <div className="w-full md:max-w-[350px] lg:max-w-[380px] bg-white/[0.07] backdrop-blur-xl border border-white/15 p-6 rounded-[22px] shadow-2xl transition-all duration-300 hover:border-white/25 hover:bg-white/10">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#0066FF] mb-3.5 shadow-md">
          <MapPin className="w-4 h-4 fill-[#0066FF] stroke-[#0066FF]" />
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight mb-2">
          Capture Every Place
        </h3>

        <p className="text-xs sm:text-sm text-white/70 font-normal leading-relaxed">
          Drop a pin anywhere on the map and turn meaningful places into personal favorites you'll never lose.
        </p>
      </div>

      {/* Card 2: Everything in One Map */}
      <div className="w-full md:max-w-[350px] lg:max-w-[380px] bg-white/[0.07] backdrop-blur-xl border border-white/15 p-6 rounded-[22px] shadow-2xl transition-all duration-300 hover:border-white/25 hover:bg-white/10">
        <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#0066FF] mb-3.5 shadow-md">
          <Layers className="w-4 h-4 text-[#0066FF] stroke-[2.2]" />
        </div>

        <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight mb-2">
          Everything in One Map
        </h3>

        <p className="text-xs sm:text-sm text-white/70 font-normal leading-relaxed">
          Find, edit, and revisit your saved places effortlessly, with your map and collection always in sync.
        </p>
      </div>
    </div>
  );
};
