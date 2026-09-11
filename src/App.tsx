import { useState, useEffect } from 'react';
import { LandingPageContainer } from './components/landing/LandingPageContainer';
import { LoginPage } from './pages/Auth/LoginPage';
import { LandingPage as MaplyAppView } from './pages/LandingPage/LandingPage';
import { authService } from './services/authService';
import { AuthUser } from './types/authTypes';

export default function App() {
  const [activeView, setActiveView] = useState<'landing' | 'login' | 'map'>('landing');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Restore user session on initial load
  useEffect(() => {
    const session = authService.getSession();
    if (session) {
      setCurrentUser(session);
    }
  }, []);

  // Update body scroll classes based on active view
  useEffect(() => {
    if (activeView === 'map') {
      document.body.classList.add('map-view-active');
    } else {
      document.body.classList.remove('map-view-active');
    }
  }, [activeView]);

  const handleLaunchMaply = () => {
    if (currentUser) {
      setActiveView('map');
    } else {
      setActiveView('login');
    }
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setActiveView('map');
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setActiveView('landing');
  };

  if (activeView === 'landing') {
    return <LandingPageContainer onLaunchMaply={handleLaunchMaply} />;
  }

  if (activeView === 'login') {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onBackToLanding={() => setActiveView('landing')}
      />
    );
  }

  return (
    <MaplyAppView
      currentUser={currentUser}
      onLogout={handleLogout}
      onBackToLanding={() => setActiveView('landing')}
    />
  );
}
