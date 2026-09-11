import React, { useState } from 'react';
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import { authService } from '../../services/authService';
import { AuthUser } from '../../types/authTypes';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  onBackToLanding: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBackToLanding }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Form states: Name, Email Address, Password
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Feedback & error state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      if (mode === 'login') {
        const result = authService.login({
          usernameOrEmail: email,
          password,
          rememberMe,
        });

        if (result.success && result.user) {
          onLoginSuccess(result.user);
        } else {
          setError(result.error || 'Invalid credentials. Please check your email address and password.');
          setIsLoading(false);
        }
      } else {
        const result = authService.register({
          name,
          email,
          password,
        });

        if (result.success && result.user) {
          onLoginSuccess(result.user);
        } else {
          setError(result.error || 'Registration failed.');
          setIsLoading(false);
        }
      }
    }, 350);
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white flex flex-col justify-between overflow-hidden font-sans selection:bg-blue-500 selection:text-white">
      {/* 1. HIGH-DEFINITION ORBITAL SPACE BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105 transition-transform duration-1000"
          style={{
            backgroundImage: `radial-gradient(circle at 75% 45%, rgba(15, 23, 42, 0.25) 0%, rgba(2, 6, 23, 0.85) 65%, rgba(0, 0, 0, 0.98) 100%), url('https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop')`,
          }}
        />
        {/* Soft Radial Ambient Lighting */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[750px] bg-blue-600/15 blur-[170px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[550px] h-[550px] bg-indigo-500/12 blur-[150px] rounded-full" />
      </div>

      {/* 2. TOP BRAND HEADER */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToLanding}
            className="flex items-center space-x-2 text-white/90 hover:text-white transition-colors group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-400 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform border border-white/20">
              <svg className="w-4 h-4 text-white fill-current" viewBox="0 0 24 24">
                <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13H5.5L12 6.5z" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight text-white drop-shadow-md">
              Maply
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center space-x-3 text-[11px] tracking-[0.25em] text-slate-300 font-medium uppercase drop-shadow">
          <span>EXPLORE</span>
          <span className="text-slate-600">·</span>
          <span>SAVE</span>
          <span className="text-slate-600">·</span>
          <span>REMEMBER</span>
        </div>
      </header>

      {/* 3. CENTER HERO & LIQUID GLASS CARD */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 my-auto grid grid-cols-1 lg:grid-cols-12 items-center gap-12">
        {/* Left Hero Text */}
        <div className="lg:col-span-6 flex flex-col items-start text-left space-y-4">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 drop-shadow">
            YOUR WORLD
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-light tracking-tight text-white leading-[1.12] drop-shadow-lg">
            Places <br />
            <span className="font-normal text-slate-100">tell better</span> <br />
            <span className="font-semibold text-blue-200">stories.</span>
          </h1>

          <div className="w-12 h-[2px] bg-blue-500/50 my-2 rounded-full" />

          <p className="text-sm sm:text-base text-slate-300/90 font-normal leading-relaxed max-w-md drop-shadow">
            Maply helps you discover, save, and revisit the places that matter.
          </p>

          <button
            onClick={onBackToLanding}
            className="mt-4 flex items-center space-x-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer bg-white/5 hover:bg-white/10 border border-white/15 px-4 py-2 rounded-full backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Overview &amp; Features</span>
          </button>
        </div>

        {/* Right Liquid Glass Card (Replicating exact image design) */}
        <div className="lg:col-span-6 flex justify-center lg:justify-end">
          <div className="w-full max-w-[420px] bg-[#0A1320]/45 backdrop-blur-3xl border border-white/20 rounded-[36px] p-8 sm:p-10 shadow-[0_30px_90px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.2)] relative overflow-hidden transition-all duration-300">
            {/* Top Light Flare Reflection */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-36 bg-blue-500/25 blur-3xl pointer-events-none rounded-full" />

            {/* Top Icon & Title */}
            <div className="flex flex-col items-center text-center mb-7">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-blue-600 via-blue-500 to-indigo-400 flex items-center justify-center text-white shadow-xl shadow-blue-500/35 mb-3.5 border border-white/25">
                <svg className="w-7 h-7 text-white fill-current" viewBox="0 0 24 24">
                  <path d="M12 2L2 22h20L12 2zm0 4.5l6.5 13H5.5L12 6.5z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold tracking-tight text-white drop-shadow">Maply</h2>
              <p className="text-xs text-slate-300 font-medium mt-1">
                Your world, saved beautifully.
              </p>
            </div>

            {/* Error Notification */}
            {error && (
              <div className="mb-4 p-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs font-medium text-center">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name Field (Register Mode Only) */}
              {mode === 'register' && (
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="Full Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#050C16]/65 border border-white/15 focus:border-blue-400/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all"
                  />
                </div>
              )}

              {/* Email Address Field */}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#050C16]/65 border border-white/15 focus:border-blue-400/80 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all"
                />
              </div>

              {/* Password Field */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#050C16]/65 border border-white/15 focus:border-blue-400/80 rounded-2xl pl-11 pr-11 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Options Row (Remember me & Forgot Password) */}
              <div className="flex items-center justify-between text-xs text-slate-300 pt-1">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-white/20 text-blue-600 focus:ring-0 cursor-pointer accent-blue-600"
                  />
                  <span>Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setError('Password reset instructions sent to your email.')}
                  className="text-slate-400 hover:text-blue-300 transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {/* Primary CTA Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-4 bg-gradient-to-r from-[#2563EB] via-[#3B82F6] to-[#4F46E5] hover:from-[#1D4ED8] hover:to-[#4338CA] text-white font-semibold py-3.5 px-6 rounded-full shadow-[0_0_30px_rgba(59,130,246,0.45)] flex items-center justify-center space-x-2 text-sm sm:text-base transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <span>{isLoading ? 'Processing...' : mode === 'login' ? 'Sign in' : 'Create Account'}</span>
                {!isLoading && <ArrowRight className="w-4 h-4 text-white" />}
              </button>
            </form>

            {/* Bottom Section Divider */}
            <div className="mt-6 pt-5 border-t border-white/10 text-center text-xs text-slate-400">
              {mode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="text-white font-semibold hover:underline cursor-pointer"
                  >
                    Register now
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-white font-semibold hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 4. BOTTOM ACCENT FOOTER */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-[11px] font-medium tracking-[0.2em] uppercase text-slate-400 drop-shadow select-none">
        <div className="flex items-center space-x-2">
          <span>A MORE MEANINGFUL MAP</span>
          <span className="w-6 h-[1px] bg-slate-600 inline-block" />
        </div>
        <div className="flex items-center space-x-2">
          <span>DISCOVER A BRIGHTER TOMORROW</span>
          <span className="w-6 h-[1px] bg-slate-600 inline-block" />
        </div>
      </footer>
    </div>
  );
};
