import React from 'react';

interface SvgFrameProps {
  children: React.ReactNode;
  className?: string;
  backgroundColor?: string;
  borderColor?: string;
  cornerRadius?: number;
  strokeWidth?: number;
}

const SvgFrame: React.FC<SvgFrameProps> = ({
  children,
  className = '',
  backgroundColor = '#FEF7EC',
  borderColor = '#5E4C40',
  cornerRadius = 24,
  strokeWidth = 3
}) => {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ zIndex: -1 }}
      >
        <defs>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#5E4C40" floodOpacity="0.3"/>
          </filter>
        </defs>
        <rect
          x={strokeWidth}
          y={strokeWidth}
          width={100 - strokeWidth * 2}
          height={100 - strokeWidth * 2}
          rx={cornerRadius}
          ry={cornerRadius}
          fill={backgroundColor}
          stroke={borderColor}
          strokeWidth={strokeWidth}
          filter="url(#shadow)"
        />
      </svg>
      <div className="relative z-10 p-6 h-full">
        {children}
      </div>
    </div>
  );
};

export default SvgFrame;