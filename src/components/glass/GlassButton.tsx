import React, { ButtonHTMLAttributes } from 'react';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'destructive' | 'subtle' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  variant = 'default',
  size = 'md',
  active = false,
  className = '',
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50';

  const sizeClasses = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-sm px-4 py-2 gap-2',
    lg: 'text-base px-5 py-2.5 gap-2.5',
    icon: 'p-2.5 w-10 h-10 rounded-xl',
  }[size];

  const variantClasses = {
    default: active
      ? 'bg-blue-600/30 text-blue-200 border border-blue-400/40 shadow-lg shadow-blue-600/20'
      : 'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 hover:border-white/20 active:bg-white/15',
    primary:
      'bg-blue-600/80 hover:bg-blue-600 text-white border border-blue-400/30 shadow-lg shadow-blue-600/30 active:scale-[0.98]',
    destructive:
      'bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/20 hover:border-red-500/30 active:bg-red-500/30',
    subtle:
      'bg-black/20 hover:bg-black/40 text-slate-300 hover:text-white border border-white/5 hover:border-white/10',
    ghost:
      'hover:bg-white/10 text-slate-300 hover:text-white border border-transparent',
  }[variant];

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
