import React, { HTMLAttributes } from 'react';

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'subtle' | 'active' | 'dock';
  className?: string;
  children: React.ReactNode;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  variant = 'primary',
  className = '',
  children,
  ...props
}) => {
  const variantClass = {
    primary: 'liquid-glass',
    subtle: 'liquid-glass-subtle',
    active: 'liquid-glass-active',
    dock: 'liquid-glass-dock',
  }[variant];

  return (
    <div
      className={`${variantClass} text-slate-100 transition-all duration-200 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
