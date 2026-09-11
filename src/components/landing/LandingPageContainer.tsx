import React, { useState, useEffect } from 'react';
import Lenis from 'lenis';
import { BackgroundCanvas } from './BackgroundCanvas';
import { Header } from './Header';
import { HeroCenter } from './HeroCenter';
import { BottomCards } from './BottomCards';
import { TrustedBrandsSection } from './TrustedBrandsSection';
import { AboutSpectraSection } from './AboutSpectraSection';
import { FeaturesGridSection } from './FeaturesGridSection';
import { MenuDrawer } from './MenuDrawer';
import { ContactModal } from './ContactModal';

interface LandingPageContainerProps {
  onLaunchMaply: () => void;
}

export const LandingPageContainer: React.FC<LandingPageContainerProps> = ({ onLaunchMaply }) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isContactOpen, setIsContactOpen] = useState(false);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.6,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1.1,
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="bg-black text-white min-h-screen flex flex-col relative selection:bg-white selection:text-black font-sans antialiased overflow-x-hidden w-full">
      {/* Background Frame Sequence Canvas Animation */}
      <BackgroundCanvas />

      {/* Main Content Overlay Layer - 100% Transparent */}
      <div className="relative z-10 w-full flex flex-col">
        {/* First Fold Banner Section */}
        <div id="home" className="w-full max-w-7xl mx-auto min-h-screen flex flex-col justify-between py-6 px-4 sm:px-8">
          {/* Top Header */}
          <Header
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onOpenMenu={() => setIsMenuOpen(true)}
            onLaunchMaply={onLaunchMaply}
          />

          {/* Center Hero */}
          <main className="my-auto pt-10 sm:pt-16 md:pt-20 pb-4 flex flex-col items-center justify-center">
            <HeroCenter onLaunchMaply={onLaunchMaply} />
          </main>

          {/* Bottom Feature Cards */}
          <BottomCards />
        </div>

        {/* Second Section: Trusted Brands */}
        <div className="w-full bg-transparent border-t border-white/10 py-12">
          <TrustedBrandsSection />
        </div>

        {/* Third Section: About Maply */}
        <div className="w-full bg-transparent border-t border-white/10 py-16">
          <AboutSpectraSection />
        </div>

        {/* Fourth Section: Features Grid & CTA */}
        <div className="w-full bg-transparent border-t border-white/10 pt-16 pb-6">
          <FeaturesGridSection onLaunchClick={onLaunchMaply} />
        </div>
      </div>

      {/* Drawers and Modals */}
      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLaunchMaply={onLaunchMaply}
      />

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
        onLaunchMaply={onLaunchMaply}
      />
    </div>
  );
};
