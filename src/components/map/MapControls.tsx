import React from 'react';
import { Plus, Minus, Navigation } from 'lucide-react';
import { MapStyleType } from '../../types/location';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateUser: () => void;
  onFitAllLocations?: () => void;
  mapStyle: MapStyleType;
  onToggleMapStyle: () => void;
  isCalibrated?: boolean;
}

export const MapControls: React.FC<MapControlsProps> = ({
  onZoomIn,
  onZoomOut,
  onLocateUser,
  onFitAllLocations,
  mapStyle,
  onToggleMapStyle,
  isCalibrated,
}) => {
  return (
    <div id="map-controls-group" className="flex flex-row items-end gap-3 select-none pointer-events-auto">
      {/* Vertical Zoom, Locate & Fit All Pill */}
      <div className="flex flex-col items-center liquid-glass rounded-2xl p-1 shadow-2xl">
        <button
          id="zoom-in-btn"
          onClick={onZoomIn}
          aria-label="Zoom In"
          title="Zoom in"
          className="w-9 h-9 flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="w-6 h-[1px] bg-white/10 my-0.5" />

        <button
          id="zoom-out-btn"
          onClick={onZoomOut}
          aria-label="Zoom Out"
          title="Zoom out"
          className="w-9 h-9 flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/10 rounded-xl transition-all active:scale-95 cursor-pointer"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="w-6 h-[1px] bg-white/10 my-0.5" />

        <button
          id="my-location-btn"
          onClick={onLocateUser}
          aria-label="My Location"
          title={isCalibrated ? 'Center on My Location (Calibrated Exact Position)' : 'Center on My Location'}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95 cursor-pointer relative ${
            isCalibrated
              ? 'text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20'
              : 'text-slate-200 hover:text-blue-400 hover:bg-white/10'
          }`}
        >
          <Navigation className="w-4 h-4 -rotate-45" />
          {isCalibrated && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-950" />
          )}
        </button>
      </div>

      {/* Map Style Inset Thumbnail Preview */}
      <button
        id="map-style-toggle-btn"
        onClick={onToggleMapStyle}
        title={`Current style: ${mapStyle}. Click to cycle map style`}
        aria-label="Toggle map style"
        className="w-11 h-11 rounded-2xl overflow-hidden border-2 border-white/30 hover:border-blue-400/80 shadow-2xl shadow-black/80 transition-all active:scale-95 group relative cursor-pointer flex-shrink-0"
      >
        <img
          src="https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=120&q=80"
          alt="Map style"
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
      </button>
    </div>
  );
};
