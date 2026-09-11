import React from 'react';
import { Compass, Bookmark, Sliders, Database, ArrowRight } from 'lucide-react';

interface FeaturesGridSectionProps {
  onLaunchClick: () => void;
}

export const FeaturesGridSection: React.FC<FeaturesGridSectionProps> = ({ onLaunchClick }) => {
  const subTextShadowStyle = { textShadow: '0 3px 14px rgba(0, 0, 0, 0.95), 0 1px 6px rgba(0, 0, 0, 0.95)' };

  const leftCards = [
    {
      num: '01',
      badge: 'EXPLORE',
      icon: Compass,
      title: 'The World at Your Fingertips',
      description: 'Move freely across the map, discover new places, and choose exactly where you want to leave your mark.',
    },
    {
      num: '02',
      badge: 'SAVE',
      icon: Bookmark,
      title: 'Make Every Place Yours',
      description: 'Save a location with its name and coordinates, creating a personal collection that belongs entirely to you.',
    },
  ];

  const rightCards = [
    {
      num: '03',
      badge: 'MANAGE',
      icon: Sliders,
      title: 'Everything in Its Place',
      description: 'Search your collection, edit your favorites, and move effortlessly between your saved places.',
    },
    {
      num: '04',
      badge: 'PERSIST',
      icon: Database,
      title: 'Nothing Worth Keeping Gets Lost',
      description: 'Your places remain saved and ready to revisit, even after you leave and return to Maply.',
    },
  ];

  return (
    <section id="launch" className="w-full bg-transparent text-white pt-16 pb-8 px-4 sm:px-8 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#0066FF]/10 blur-[140px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto relative z-10 flex flex-col items-center">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center mb-16 max-w-3xl">
          <span
            className="text-[#8CB8FF] font-semibold text-xs sm:text-sm tracking-widest uppercase mb-3 block"
            style={subTextShadowStyle}
          >
            THE MAPLY EXPERIENCE
          </span>

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-medium tracking-tight text-white leading-[1.12]">
            A Smarter Way to <br className="hidden sm:block" />
            <span className="text-slate-100">Keep Your World Close</span>
          </h2>

          <p
            className="mt-5 text-xs sm:text-sm md:text-base text-slate-200 font-normal leading-relaxed max-w-2xl mx-auto"
            style={subTextShadowStyle}
          >
            Discover a place. Mark it. Make it yours. Everything you choose to remember lives together on one map.
          </p>
        </div>

        {/* 3-Column Layout */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {leftCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div
                  key={idx}
                  className="w-full bg-white/[0.07] backdrop-blur-xl border border-white/15 p-6 rounded-[22px] shadow-2xl transition-all duration-300 hover:border-white/25 hover:bg-white/10 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#0066FF] shadow-md">
                      <Icon className="w-4 h-4 text-[#0066FF] stroke-[2.2]" />
                    </div>
                    <span className="inline-block bg-white/10 border border-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-200 tracking-widest uppercase">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight mb-2">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed">
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Center Spatial Balance */}
          <div className="hidden lg:block lg:col-span-4 h-full min-h-[360px]" />

          {/* Right Column */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {rightCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div
                  key={idx}
                  className="w-full bg-white/[0.07] backdrop-blur-xl border border-white/15 p-6 rounded-[22px] shadow-2xl transition-all duration-300 hover:border-white/25 hover:bg-white/10 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[#0066FF] shadow-md">
                      <Icon className="w-4 h-4 text-[#0066FF] stroke-[2.2]" />
                    </div>
                    <span className="inline-block bg-white/10 border border-white/20 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-200 tracking-widest uppercase">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight mb-2">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed">
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Final Bottom Center Launch CTA Button */}
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <button
            onClick={onLaunchClick}
            className="group relative inline-flex items-center space-x-3 bg-white hover:bg-slate-100 text-black px-8 py-4 rounded-full font-semibold text-sm sm:text-base tracking-wide transition-all duration-200 cursor-pointer shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] active:scale-95"
          >
            <span>Launch Maply</span>
            <ArrowRight className="w-4 h-4 text-black group-hover:translate-x-1 transition-transform" />
          </button>
          <p
            className="mt-3 text-xs text-slate-200 font-medium tracking-wide"
            style={subTextShadowStyle}
          >
            Personal map for discovering, saving &amp; revisiting the places that matter
          </p>
        </div>
      </div>
    </section>
  );
};
