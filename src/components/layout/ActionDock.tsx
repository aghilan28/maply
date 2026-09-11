import React from 'react';
import { Plus, Search, Crosshair, Layers } from 'lucide-react';
import { MapStyleType } from '../../types/location';

interface ActionDockProps {
  onAddPlaceClick: () => void;
  isAddingMode: boolean;
  onSearchClick: () => void;
  onMyLocationClick: () => void;
  onToggleMapStyle: () => void;
  currentMapStyle: MapStyleType;
}

export const ActionDock: React.FC<ActionDockProps> = ({
  onAddPlaceClick,
  isAddingMode,
  onSearchClick,
  onMyLocationClick,
  onToggleMapStyle,
}) => {
  return (
    <div className="w-[calc(100vw-24px)] sm:w-[390px] sm:min-w-[390px] sm:max-w-[390px] h-[105px] min-h-[105px] max-h-[105px] shrink-0 px-3.5 py-2 rounded-[20px] overflow-hidden liquid-glass-dock border border-white/16 shadow-[0_16px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] flex flex-col justify-between select-none z-21 box-border">
      {/* Helper Banner: "Click on the map to add a new location" */}
      <div className="w-full flex items-center justify-center pb-1 border-b border-white/10 px-0.5 text-slate-300">
        <span className="font-medium text-slate-200 text-[11px] text-center">
          Click on the map to add a new location
        </span>
      </div>

      {/* Action Buttons Row - 4 equal columns */}
      <div className="w-full grid grid-cols-4 gap-1 items-center text-center mt-auto pb-0.5">
        {/* Add Place (Highlighted glowing blue button) */}
        <button
          onClick={onAddPlaceClick}
          className="w-full min-w-0 flex flex-col items-center justify-center group cursor-pointer"
        >
          <div
            className={`w-[42px] h-[42px] mx-auto rounded-xl flex items-center justify-center transition-all duration-300 ${
              isAddingMode
                ? 'bg-blue-600 text-white ring-2 ring-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.5)] scale-105'
                : 'bg-gradient-to-tr from-blue-600 to-blue-500 text-white shadow-[0_0_14px_rgba(59,130,246,0.35)] group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]'
            }`}
          >
            <Plus className="w-4 h-4" />
          </div>
          <span className="text-[10px] whitespace-nowrap font-semibold text-slate-200 group-hover:text-blue-300 mt-1">
            {isAddingMode ? 'Cancel' : 'Add Place'}
          </span>
        </button>

        {/* Search */}
        <button
          onClick={onSearchClick}
          className="w-full min-w-0 flex flex-col items-center justify-center group cursor-pointer"
        >
          <div className="w-[42px] h-[42px] mx-auto rounded-xl bg-white/[0.06] group-hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-white transition-all">
            <Search className="w-4 h-4" />
          </div>
          <span className="text-[10px] whitespace-nowrap font-medium text-slate-300 group-hover:text-white mt-1">
            Search
          </span>
        </button>

        {/* My Location */}
        <button
          onClick={onMyLocationClick}
          className="w-full min-w-0 flex flex-col items-center justify-center group cursor-pointer"
        >
          <div className="w-[42px] h-[42px] mx-auto rounded-xl bg-white/[0.06] group-hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-white transition-all">
            <Crosshair className="w-4 h-4" />
          </div>
          <span className="text-[10px] whitespace-nowrap font-medium text-slate-300 group-hover:text-white mt-1">
            My Location
          </span>
        </button>

        {/* Map Style */}
        <button
          onClick={onToggleMapStyle}
          className="w-full min-w-0 flex flex-col items-center justify-center group cursor-pointer"
        >
          <div className="w-[42px] h-[42px] mx-auto rounded-xl bg-white/[0.06] group-hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 group-hover:text-white transition-all">
            <Layers className="w-4 h-4" />
          </div>
          <span className="text-[10px] whitespace-nowrap font-medium text-slate-300 group-hover:text-white capitalize mt-1">
            Map Style
          </span>
        </button>
      </div>
    </div>
  );
};
