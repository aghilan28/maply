import React from 'react';
import { X, ArrowRight } from 'lucide-react';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLaunchMaply: () => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onLaunchMaply,
}) => {
  if (!isOpen) return null;

  const menuLinks = [
    { name: 'Home', id: 'home', desc: 'Overview of Maply personal places platform' },
    { name: 'Technology', id: 'technology', desc: 'Personal map for every place that matters' },
    { name: 'About', id: 'workflow', desc: 'Discovery, memory, and living map organization' },
    { name: 'Launch', id: 'launch', desc: 'Core platform capabilities & deployment' },
  ];

  const handleNavClick = (name: string, id: string) => {
    setActiveTab(name);
    onClose();
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over Drawer Panel */}
      <div className="relative z-10 w-full max-w-md bg-[#0D0D0D] border-l border-white/10 h-full p-8 flex flex-col justify-between text-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <span className="text-2xl font-extrabold tracking-tight">MAPLY</span>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="mt-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-4">Product Navigation</p>
            {menuLinks.map((link) => {
              const isActive = activeTab.toLowerCase() === link.name.toLowerCase();
              return (
                <button
                  key={link.name}
                  onClick={() => handleNavClick(link.name, link.id)}
                  className={`w-full text-left p-4 rounded-2xl transition-all flex items-center justify-between group ${
                    isActive
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/5 hover:bg-white/10 text-white'
                  }`}
                >
                  <div>
                    <div className="text-lg font-medium">{link.name}</div>
                    <div className={`text-xs mt-0.5 ${isActive ? 'text-black/70' : 'text-white/60'}`}>
                      {link.desc}
                    </div>
                  </div>
                  <ArrowRight className={`w-5 h-5 transition-transform group-hover:translate-x-1 ${isActive ? 'text-black' : 'text-white/40'}`} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="pt-6 border-t border-white/10">
          <button
            onClick={() => {
              onClose();
              onLaunchMaply();
            }}
            className="w-full py-3.5 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all text-center cursor-pointer shadow-xl active:scale-95"
          >
            Launch Maply
          </button>
        </div>
      </div>
    </div>
  );
};
