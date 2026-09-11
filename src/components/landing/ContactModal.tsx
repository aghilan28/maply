import React, { useState, FormEvent } from 'react';
import { X, CheckCircle2 } from 'lucide-react';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchMaply: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, onLaunchMaply }) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    city: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleLaunch = () => {
    setSubmitted(false);
    onClose();
    onLaunchMaply();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-lg bg-zinc-950 border border-white/20 rounded-3xl p-6 sm:p-8 text-white shadow-2xl z-10">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {!submitted ? (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
              Launch Maply
            </h2>
            <p className="text-sm text-white/70 mb-6">
              Start your personal map for discovering, saving &amp; revisiting the places that matter most to you.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Vance"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="alex@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
                  Home City / Region
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. San Francisco, CA"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="w-full bg-white/5 border border-white/20 rounded-2xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-4 py-3.5 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all text-center cursor-pointer shadow-lg active:scale-95"
              >
                Get Started with Maply
              </button>
            </form>
          </div>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-white/10 text-white rounded-full flex items-center justify-center mx-auto mb-2 border border-white/20">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold">Welcome to Maply!</h3>
            <p className="text-sm text-white/80 max-w-sm mx-auto leading-relaxed">
              Thank you, {formData.name || 'friend'}. Your personal Maply access is ready. Start saving and pinning your favorite discoveries.
            </p>
            <button
              onClick={handleLaunch}
              className="mt-4 px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-white/90 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              Open Application
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
