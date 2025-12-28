import React from 'react';
export const Background: React.FC = () => {
    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Synthwave Grid Layer */}
            <div className="absolute inset-x-0 bottom-0 h-[200%] w-full opacity-[0.35] dark:opacity-[0.22] origin-bottom animate-synthwave"
                style={{
                    backgroundImage: 'linear-gradient(var(--grid-color) 2px, transparent 2px), linear-gradient(90deg, var(--grid-color) 2px, transparent 2px)',
                    backgroundSize: '100px 100px',
                    maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 90%)',
                    WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 90%)'
                }}
            />

            {/* Floating Decorative Lines */}
            <div className="fixed top-0 right-0 w-[50vw] h-full border-l border-black dark:border-white opacity-[0.10] dark:opacity-[0.15] transform -skew-x-12 origin-top-right pointer-events-none z-0 animate-float-slow" />
            <div className="fixed bottom-0 left-0 w-[30vw] h-full border-r border-black dark:border-white opacity-[0.10] dark:opacity-[0.15] transform -skew-x-12 origin-bottom-left pointer-events-none z-0 animate-float-delayed" />

            {/* Subtle Gradient Atmosphere - Floor glow */}
            <div className="fixed inset-0 pointer-events-none z-[-1] bg-[radial-gradient(circle_at_50%_100%,rgba(242,104,34,0.15)_0%,transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_100%,rgba(242,104,34,0.18)_0%,transparent_70%)]" />
        </div>
    );
};
