import React, { useEffect, useRef } from 'react';
import 'altcha';

interface AltchaWidgetProps {
    onVerify: (payload: string | null) => void;
}

export const AltchaWidget: React.FC<AltchaWidgetProps> = ({ onVerify }) => {
    const widgetRef = useRef<HTMLElement>(null);

    useEffect(() => {
        const handleStateChange = (ev: any) => {
            if (ev.detail.state === 'verified') {
                onVerify(ev.detail.payload);
            } else {
                onVerify(null);
            }
        };

        const current = widgetRef.current;
        if (current) {
            current.addEventListener('statechange', handleStateChange);
        }

        return () => {
            if (current) {
                current.removeEventListener('statechange', handleStateChange);
            }
        };
    }, [onVerify]);

    return (
        <div className="altcha-container my-4">
            {React.createElement('altcha-widget', {
                ref: widgetRef,
                challengeurl: "/api/altcha-challenge",
                hidefooter: true,
                hidelogo: true,
                class: "goxmr-altcha"
            } as any)}

            <style>{`
                .goxmr-altcha {
                    --altcha-primary: #F26822; /* Monero Orange */
                    --altcha-bg: transparent;
                    --altcha-text: currentColor;
                    --altcha-border: currentColor;
                    --altcha-border-width: 2px;
                    --altcha-border-radius: 0px;
                    font-family: 'Courier New', Courier, monospace;
                    font-size: 10px;
                    font-weight: 800;
                    text-transform: uppercase;
                    width: 100%;
                    max-width: 100%;
                }
                altcha-widget::part(label) {
                    letter-spacing: 0.1em;
                }
                altcha-widget::part(button) {
                    background: transparent;
                    border: 2px solid currentColor;
                    border-radius: 0px;
                    transition: all 0.2s;
                }
                altcha-widget::part(button):hover {
                    background: #F26822;
                    color: white;
                }
            `}</style>
        </div>
    );
};

declare global {
    namespace JSX {
        interface IntrinsicElements {
            'altcha-widget': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
                challengeurl?: string;
                hidefooter?: boolean;
                hidelogo?: boolean;
                ref?: any;
                class?: string;
                className?: string;
            }, HTMLElement>;
        }
    }
}
