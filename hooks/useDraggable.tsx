/** High-performance draggable hook for GOXMR Workspace */
import React, { useState, useCallback, useRef, useEffect } from 'react';

interface Position {
    x: number;
    y: number;
}

export const useDraggable = (id: string, initialPosition: Position = { x: 0, y: 0 }) => {
    // Load persisted position
    const getSavedPos = (): Position => {
        try {
            const saved = localStorage.getItem(`goxmr_drag_${id}`);
            return saved ? JSON.parse(saved) : initialPosition;
        } catch {
            return initialPosition;
        }
    };

    const [position, setPosition] = useState<Position>(getSavedPos());
    const [isDragging, setIsDragging] = useState(false);
    const [zIndex, setZIndex] = useState(1);

    // Using refs for high-frequency updates to avoid re-renders during drag
    const posRef = useRef<Position>(position);
    const dragStartRef = useRef<Position>({ x: 0, y: 0 });
    const rafRef = useRef<number | null>(null);

    // Persist position whenever it changes
    useEffect(() => {
        localStorage.setItem(`goxmr_drag_${id}`, JSON.stringify(position));
    }, [id, position]);

    const bringToFront = useCallback(() => {
        const allDraggables = document.querySelectorAll('.draggable-element');
        let maxZ = 0;
        allDraggables.forEach((el) => {
            const z = parseInt(window.getComputedStyle(el).zIndex);
            if (!isNaN(z) && z > maxZ) maxZ = z;
        });
        setZIndex(maxZ + 1);
    }, []);

    const onMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        bringToFront();

        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        dragStartRef.current = {
            x: clientX - posRef.current.x,
            y: clientY - posRef.current.y
        };

        document.body.style.userSelect = 'none';

        // Listen for reset events
        const handleReset = () => {
            setPosition(initialPosition);
            posRef.current = initialPosition;
            localStorage.removeItem(`goxmr_drag_${id}`);
        };
        window.addEventListener('reset-workspace', handleReset);
        return () => window.removeEventListener('reset-workspace', handleReset);
    }, [id, initialPosition, bringToFront]);

    const onMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging) return;

        // Use requestAnimationFrame for smooth 60fps movement
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        rafRef.current = requestAnimationFrame(() => {
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

            const newPos = {
                x: clientX - dragStartRef.current.x,
                y: clientY - dragStartRef.current.y
            };

            posRef.current = newPos;
            setPosition(newPos);
        });
    }, [isDragging]);

    const onMouseUp = useCallback(() => {
        setIsDragging(false);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        document.body.style.userSelect = '';
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('touchmove', onMouseMove);
            window.addEventListener('touchend', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isDragging, onMouseMove, onMouseUp]);

    // Handle initial position and reset events
    useEffect(() => {
        const handleReset = () => {
            setPosition(initialPosition);
            posRef.current = initialPosition;
        };
        window.addEventListener('reset-workspace', handleReset);
        return () => window.removeEventListener('reset-workspace', handleReset);
    }, [initialPosition]);

    return {
        position,
        isDragging,
        zIndex,
        onMouseDown,
        style: {
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`, // 3D acceleration
            zIndex,
            cursor: isDragging ? 'grabbing' : 'grab'
        }
    };
};
