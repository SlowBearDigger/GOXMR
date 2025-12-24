import React, { useState, useEffect } from 'react';
interface TypewriterProps {
    texts: string[];
    typingSpeed?: number;
    deletingSpeed?: number;
    pauseDuration?: number;
    className?: string;
}
export const Typewriter: React.FC<TypewriterProps> = ({
    texts,
    typingSpeed = 50,
    deletingSpeed = 30,
    pauseDuration = 2000,
    className = ""
}) => {
    const [displayText, setDisplayText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isDeleting, setIsDeleting] = useState(false);
    useEffect(() => {
        const handleTyping = () => {
            const currentFullText = texts[currentIndex];
            if (isDeleting) {
                setDisplayText(prev => prev.slice(0, -1));
                if (displayText.length === 0) {
                    setIsDeleting(false);
                    setCurrentIndex(prev => (prev + 1) % texts.length);
                }
            } else {
                setDisplayText(currentFullText.slice(0, displayText.length + 1));
                if (displayText.length === currentFullText.length) {
                    setTimeout(() => setIsDeleting(true), pauseDuration);
                    return;
                }
            }
        };
        const timer = setTimeout(
            handleTyping,
            isDeleting ? deletingSpeed : typingSpeed
        );
        return () => clearTimeout(timer);
    }, [displayText, isDeleting, currentIndex, texts, typingSpeed, deletingSpeed, pauseDuration]);
    return (
        <span className={className}>
            {displayText}
            <span className="animate-pulse">_</span>
        </span>
    );
};
