import { useState, useEffect } from 'react';
import { LandingPageContainer } from './components/landing/LandingPageContainer';
import { LandingPage as MaplyAppView } from './pages/LandingPage/LandingPage';

export default function App() {
  const [activeView, setActiveView] = useState<'landing' | 'map'>('landing');

  useEffect(() => {
    if (activeView === 'map') {
      document.body.classList.add('map-view-active');
    } else {
      document.body.classList.remove('map-view-active');
    }
  }, [activeView]);

  if (activeView === 'landing') {
    return <LandingPageContainer onLaunchMaply={() => setActiveView('map')} />;
  }

  return <MaplyAppView onBackToLanding={() => setActiveView('landing')} />;
}
