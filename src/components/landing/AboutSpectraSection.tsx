import React from 'react';

export const AboutSpectraSection: React.FC = () => {
  const subTextShadowStyle = { textShadow: '0 3px 14px rgba(0, 0, 0, 0.95), 0 1px 6px rgba(0, 0, 0, 0.95)' };

  const cards = [
    {
      num: '01',
      badge: 'DISCOVERY',
      title: 'Find the Places Worth Keeping',
      description: 'From familiar favorites to places you stumble upon, Maply gives every discovery a place on your map.',
      height: 'min-h-[300px] sm:min-h-[340px]',
    },
    {
      num: '02',
      badge: 'MEMORY',
      title: "Save What You Don't Want to Lose",
      description: 'Mark a place in an instant and keep its name, location, and story together for whenever you return.',
      height: 'min-h-[260px] sm:min-h-[290px]',
    },
    {
      num: '03',
      badge: 'ORGANIZATION',
      title: 'Your Places. One Living Map.',
      description: 'Keep your favorites together, searchable and beautifully organized instead of scattered across notes and screenshots.',
      height: 'min-h-[280px] sm:min-h-[320px]',
    },
    {
      num: '04',
      badge: 'REVISIT',
      title: 'Always Know Your Way Back',
      description: 'Search your collection, find the place again, and let the map take you exactly where you want to go.',
      height: 'min-h-[250px] sm:min-h-[270px]',
    },
  ];

  return (
    <section id="workflow" className="w-full bg-transparent text-white py-20 px-4 sm:px-8 relative overflow-hidden">
      <div className="max-w-7xl mx-auto flex flex-col items-center text-center relative z-10">
        <span
          className="text-slate-300 font-semibold text-xs sm:text-sm tracking-wider uppercase mb-3 block"
          style={subTextShadowStyle}
        >
          ABOUT MAPLY
        </span>

        <h2 className="text-3xl sm:text-5xl md:text-6xl font-medium tracking-tight text-white leading-[1.12] max-w-4xl mx-auto">
          A Personal Map for <br className="hidden sm:block" />
          <span className="text-slate-100">
            Every Place That Matters
          </span>
        </h2>

        <p
          className="mt-5 text-xs sm:text-sm md:text-base text-slate-200 font-normal leading-relaxed max-w-xl mx-auto"
          style={subTextShadowStyle}
        >
          Save the places you discover, keep the ones you love close, and build a map that becomes uniquely yours.
        </p>

        <div className="w-full mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-end text-left">
          {cards.map((card, index) => (
            <div
              key={index}
              className={`w-full bg-white/[0.07] backdrop-blur-xl border border-white/15 p-6 rounded-[22px] shadow-2xl flex flex-col justify-between transition-all duration-300 hover:border-white/25 hover:bg-white/10 ${card.height}`}
            >
              <div className="flex items-center justify-between">
                <span className="inline-block bg-white/10 border border-white/20 px-3 py-1 rounded-full text-[11px] font-semibold text-white/90 backdrop-blur-md tracking-wider uppercase">
                  {card.badge}
                </span>
                <span className="text-xs font-mono font-medium text-white/40 tracking-wider">
                  {card.num}
                </span>
              </div>

              <div className="mt-8">
                <div className="w-2.5 h-2.5 rounded-full bg-gray-300 mb-3" />
                <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight leading-snug mb-2">
                  {card.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 font-normal leading-relaxed">
                  {card.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
