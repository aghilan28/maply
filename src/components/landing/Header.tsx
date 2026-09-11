import React, { useEffect } from 'react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMenu: () => void;
  onLaunchMaply: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenMenu,
  onLaunchMaply,
}) => {
  const navItems = [
    { label: 'Home', id: 'home' },
    { label: 'Technology', id: 'technology' },
    { label: 'About', id: 'workflow' },
    { label: 'Launch', id: 'launch' },
  ];

  const handleNavClick = (label: string, id: string) => {
    setActiveTab(label);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const sections = navItems.map((item) => document.getElementById(item.id));
      const scrollPosition = window.scrollY + 200;

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section) {
          const sectionTop = section.offsetTop;
          if (scrollPosition >= sectionTop) {
            setActiveTab(navItems[i].label);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [setActiveTab]);

  return (
    <header className="w-full relative z-20 grid grid-cols-2 md:grid-cols-3 items-center py-2">
      {/* Brand Logo - Left Aligned */}
      <div className="flex items-center justify-start">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            handleNavClick('Home', 'home');
          }}
          className="text-xl sm:text-2xl font-extrabold tracking-widest text-white hover:opacity-90 transition-opacity"
          style={{ letterSpacing: '0.08em', textShadow: '0 4px 18px rgba(0, 0, 0, 0.95), 0 2px 8px rgba(0, 0, 0, 0.95)' }}
        >
          MAPLY
        </a>
      </div>

      {/* Center Pill Navigation Bar */}
      <nav className="hidden md:flex items-center justify-center">
        <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 p-1.5 rounded-full shadow-2xl space-x-1">
          {navItems.map((item) => {
            const isActive = activeTab.toLowerCase() === item.label.toLowerCase();
            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.label, item.id)}
                className={`px-5 py-2 text-xs lg:text-sm font-medium rounded-full transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-white text-black shadow-md font-semibold'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
                style={!isActive ? { textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)' } : undefined}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right Side Action Button */}
      <div className="flex items-center justify-end space-x-3">
        <button
          onClick={onLaunchMaply}
          className="bg-white text-black hover:bg-slate-100 active:scale-95 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xl shrink-0 flex items-center space-x-2"
        >
          <span>Launch Maply</span>
        </button>
        <button
          onClick={onOpenMenu}
          className="md:hidden bg-white/10 hover:bg-white/20 active:bg-white/30 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-full text-xs font-semibold text-white transition-all cursor-pointer shadow-md shrink-0"
        >
          Menu
        </button>
      </div>
    </header>
  );
};
