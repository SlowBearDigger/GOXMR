import React from 'react';
export const Background: React.FC = () => {
    return (
        <>
            {}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-10"
                style={{
                    backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}
            />
            {}
            <div className="fixed top-0 right-0 w-[50vw] h-full border-l border-black opacity-10 transform -skew-x-12 origin-top-right pointer-events-none z-0" />
            <div className="fixed bottom-0 left-0 w-[30vw] h-full border-r border-black opacity-10 transform -skew-x-12 origin-bottom-left pointer-events-none z-0" />
        </>
    );
};
