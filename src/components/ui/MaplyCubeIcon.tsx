import React from 'react';

interface MaplyCubeIconProps {
  className?: string;
  size?: number;
}

export const MaplyCubeIcon: React.FC<MaplyCubeIconProps> = ({
  className = '',
  size = 28,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Top Face - Bright Sky Blue / Cyan with soft radial depth */}
      <path
        d="M16 3.8L27 10.1L16 16.4L5 10.1L16 3.8Z"
        fill="#38bdf8"
      />
      {/* Left Face - Vibrant Cobalt Blue */}
      <path
        d="M5 11.2L15.2 17V28.2L5 22.4V11.2Z"
        fill="#2563eb"
      />
      {/* Right Face - Deep Navy / Royal Blue */}
      <path
        d="M16.8 17L27 11.2V22.4L16.8 28.2V17Z"
        fill="#1d4ed8"
      />
      {/* Subtle top facet bevel line */}
      <path
        d="M16 4.5L25.5 10L16 15.5L6.5 10L16 4.5Z"
        stroke="rgba(255,255,255,0.4)"
        strokeWidth="0.6"
      />
    </svg>
  );
};
