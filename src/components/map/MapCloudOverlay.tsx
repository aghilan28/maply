import React, { useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';

interface MapCloudOverlayProps {
  mapRef?: React.MutableRefObject<mapboxgl.Map | null>;
}

export const MapCloudOverlay: React.FC<MapCloudOverlayProps> = ({ mapRef }) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const map = mapRef?.current;
    if (!map) return;

    let lastCenter = map.getCenter();

    const handleMove = () => {
      const center = map.getCenter();
      const dx = (center.lng - lastCenter.lng) * 1400;
      const dy = (center.lat - lastCenter.lat) * 1400;

      setOffset((prev) => ({
        x: (prev.x - dx) % 450,
        y: (prev.y + dy) % 450,
      }));

      lastCenter = center;
    };

    map.on('move', handleMove);
    return () => {
      map.off('move', handleMove);
    };
  }, [mapRef]);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none">
      {/* 1. Left Sidebar Edge Cloud Bank (Bottom-Left to Mid-Left - matching reference image 2) */}
      <div
        className="absolute -bottom-24 -left-28 w-[500px] h-[580px] opacity-45 mix-blend-screen pointer-events-none transition-transform duration-300 ease-out animate-cloud-float-slow"
        style={{
          transform: `translate3d(${offset.x * 0.35}px, ${offset.y * 0.35}px, 0)`,
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=800&q=80"
          alt="Clouds"
          className="w-full h-full object-cover rounded-full filter contrast-125 brightness-110 blur-[8px]"
        />
      </div>

      {/* 2. Top-Left Sidebar Corner Cloud */}
      <div
        className="absolute -top-28 -left-20 w-[440px] h-[380px] opacity-40 mix-blend-screen pointer-events-none transition-transform duration-500 ease-out animate-cloud-float-reverse"
        style={{
          transform: `translate3d(${offset.x * 0.25}px, ${offset.y * 0.25}px, 0)`,
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&w=800&q=80"
          alt="Clouds"
          className="w-full h-full object-cover rounded-full filter contrast-125 brightness-110 blur-[6px]"
        />
      </div>

      {/* 3. Ocean / Coastal Edge Cloud Wisps (Right Side Sea - matching reference image 2) */}
      <div
        className="absolute top-[18%] -right-28 w-[480px] h-[520px] opacity-38 mix-blend-screen pointer-events-none transition-transform duration-400 ease-out animate-cloud-float-slow"
        style={{
          transform: `translate3d(${offset.x * 0.2}px, ${offset.y * 0.2}px, 0)`,
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=800&q=80"
          alt="Clouds"
          className="w-full h-full object-cover rounded-full filter contrast-125 brightness-110 blur-[10px]"
        />
      </div>

      {/* 4. Bottom-Right Corner Cloud Wisp */}
      <div
        className="absolute -bottom-24 -right-24 w-[400px] h-[340px] opacity-35 mix-blend-screen pointer-events-none transition-transform duration-500 ease-out"
        style={{
          transform: `translate3d(${offset.x * 0.18}px, ${offset.y * 0.18}px, 0)`,
        }}
      >
        <img
          src="https://images.unsplash.com/photo-1513002749550-c59d786b8e6c?auto=format&fit=crop&w=800&q=80"
          alt="Clouds"
          className="w-full h-full object-cover rounded-full filter contrast-125 brightness-110 blur-[8px]"
        />
      </div>
    </div>
  );
};
