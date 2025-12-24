import React from 'react';

interface GlitchTextProps {
    text: string;
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
    className?: string;
    intensity?: 'low' | 'medium' | 'high';
}

export const GlitchText: React.FC<GlitchTextProps> = ({ text, as: Component = 'span', className = '', intensity = 'medium' }) => {
    return (
        <Component className={`relative inline-block group ${className}`}>
            <span className="relative z-10">{text}</span>
            <span className="absolute top-0 left-0 -ml-0.5 translate-x-[2px] text-[#ff6600] opacity-0 group-hover:opacity-70 animate-pulse z-0 mix-blend-multiply">
                {text}
            </span>
            <span className="absolute top-0 left-0 -ml-0.5 -translate-x-[2px] text-gray-400 opacity-0 group-hover:opacity-70 animate-pulse delay-75 z-0">
                {text}
            </span>
        </Component>
    );
};
