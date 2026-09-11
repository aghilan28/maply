import React, { useState, useEffect } from 'react';
import { CloudSun, Sun, Moon, Bell, Check, Sparkles, MapPin } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  icon?: 'map' | 'place' | 'gps';
}

interface TopRightControlsProps {
  cityName?: string;
  weatherText?: string;
  onToggleTheme?: () => void;
  isDarkMode?: boolean;
  savedCount?: number;
}

export const TopRightControls: React.FC<TopRightControlsProps> = ({
  cityName = 'Current Region',
  weatherText = 'Aerial HD View',
  onToggleTheme,
  isDarkMode = false,
  savedCount = 0,
}) => {
  const [now, setNow] = useState(() => Date.now());

  // Real-time tick interval to update relative timestamps live
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => [
    {
      id: '1',
      title: 'Satellite HD Map Ready',
      message: `Live aerial satellite view active for ${cityName}.`,
      timestamp: Date.now(),
      icon: 'map',
    },
    {
      id: '2',
      title: 'Maply Places Collection',
      message:
        savedCount > 0
          ? `${savedCount} saved location(s) synced in your collection.`
          : 'Click any place on the map to save it to your collection.',
      timestamp: Date.now() - 2 * 60 * 1000,
      icon: 'place',
    },
    {
      id: '3',
      title: 'Live GPS Sensor',
      message: 'High accuracy device location tracking active.',
      timestamp: Date.now() - 5 * 60 * 1000,
      icon: 'gps',
    },
  ]);

  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const unreadCount = notifications.length;

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleDismissOne = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const formatNotificationTime = (timestamp: number): string => {
    const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
    if (diffSec < 45) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="flex items-center gap-2.5 select-none h-[50px]">
      {/* Weather Pill matching reference screenshot */}
      <div className="flex items-center gap-3 h-[42px] px-4 rounded-full liquid-glass border border-white/16 shadow-[0_10px_28px_rgba(0,0,0,0.32)] max-w-[190px]">
        <div className="flex items-center justify-center text-slate-200 shrink-0">
          <CloudSun className="w-4 h-4 text-slate-200" />
        </div>
        <div className="flex flex-col text-left leading-tight truncate">
          <span className="text-[12px] font-bold text-white tracking-tight truncate">{cityName}</span>
          <span className="text-[10px] text-slate-300 font-normal truncate">{weatherText}</span>
        </div>
      </div>

      {/* Theme Toggle Pill (Sun / Moon Switch matching reference slider) */}
      <div className="relative flex items-center liquid-glass border border-white/16 rounded-full p-1 shadow-[0_10px_28px_rgba(0,0,0,0.32)] hover:border-white/25 transition-all h-[42px] px-1">
        <button
          type="button"
          onClick={() => {
            if (isDarkMode && onToggleTheme) {
              onToggleTheme();
            }
          }}
          title="Switch to Real-time Satellite View (Sun)"
          aria-label="Switch to Real-time Satellite View"
          className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 cursor-pointer ${
            !isDarkMode
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/50 scale-105'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!isDarkMode && onToggleTheme) {
              onToggleTheme();
            }
          }}
          title="Switch to Dark Theme Map (Moon)"
          aria-label="Switch to Dark Theme Map"
          className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 cursor-pointer ${
            isDarkMode
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/50 scale-105'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Moon className="w-4 h-4" />
        </button>
      </div>

      {/* Notifications Button */}
      <div className="relative">
        <button
          onClick={() => {
            setNow(Date.now());
            setShowNotificationMenu(!showNotificationMenu);
          }}
          aria-label="Notifications"
          className="relative w-[42px] h-[42px] rounded-full liquid-glass border border-white/16 shadow-[0_10px_28px_rgba(0,0,0,0.32)] flex items-center justify-center text-slate-200 hover:text-white hover:border-white/25 transition-all active:scale-95 cursor-pointer"
        >
          <Bell className="w-5 h-5 text-slate-200" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 ring-2 ring-[#0a1624]" />
            </span>
          )}
        </button>

        {showNotificationMenu && (
          <div className="absolute right-0 top-14 w-72 rounded-2xl bg-[#0a1624]/95 backdrop-blur-2xl border border-white/16 shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 text-xs">
            <div className="flex items-center justify-between font-semibold text-white mb-2.5 pb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-blue-400" />
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] bg-blue-500/20 text-blue-300 rounded-full font-mono border border-blue-400/30">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[10px] text-slate-400 hover:text-cyan-300 font-medium transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>

            {notifications.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {notifications.map((item) => (
                  <div
                    key={item.id}
                    className="group relative p-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] text-slate-300 text-[11px] leading-snug transition-all"
                  >
                    <div className="flex items-center justify-between text-white font-medium mb-1">
                      <div className="flex items-center gap-1.5 text-slate-100">
                        {item.icon === 'map' ? (
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                        ) : item.icon === 'place' ? (
                          <MapPin className="w-3 h-3 text-blue-400" />
                        ) : (
                          <CloudSun className="w-3 h-3 text-emerald-400" />
                        )}
                        <span className="truncate max-w-[150px]">{item.title}</span>
                      </div>
                      <span
                        className="text-[9.5px] text-slate-400 font-mono shrink-0"
                        title={new Date(item.timestamp).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      >
                        {formatNotificationTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-300">{item.message}</p>
                    <button
                      onClick={() => handleDismissOne(item.id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white rounded transition-opacity cursor-pointer"
                      aria-label="Dismiss notification"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-[11px]">
                <p className="font-medium text-slate-300">No new notifications</p>
                <p className="text-[10px] text-slate-500 mt-0.5">You're all caught up!</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Profile Avatar matching reference screenshot */}
      <div className="relative w-[42px] h-[42px] rounded-full overflow-hidden border border-white/25 shadow-xl cursor-pointer hover:scale-105 transition-transform shrink-0 ring-1 ring-white/10">
        <img
          src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=160&q=80"
          alt="User Profile"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
};

