import React from 'react';

interface GlitchTextProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
  className?: string;
}

export const GlitchText: React.FC<GlitchTextProps> = ({ text, as = 'span', className = '' }) => {
  return React.createElement(
    as,
    { className: `relative inline-block group ${className}` },
    React.createElement('span', { className: 'relative z-10' }, text),
    React.createElement(
      'span',
      {
        'aria-hidden': true,
        className: 'absolute top-0 left-0 -ml-0.5 translate-x-[2px] text-monero-orange opacity-0 group-hover:opacity-70 animate-pulse z-0 mix-blend-multiply dark:mix-blend-screen'
      },
      text
    ),
    React.createElement(
      'span',
      {
        'aria-hidden': true,
        className: 'absolute top-0 left-0 -ml-0.5 -translate-x-[2px] text-gray-400 opacity-0 group-hover:opacity-70 animate-pulse delay-75 z-0'
      },
      text
    )
  );
};