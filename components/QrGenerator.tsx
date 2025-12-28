import React, { useState, useEffect, useRef } from 'react';
import QRCodeStyling from 'qr-code-styling';
import { QrForm } from './QrForm';
import { QrPreview } from './QrPreview';
import type { ShapeType, CornerType, GradientType, Preset, CryptoType, CustomField } from '../types.ts';
import { Wallet } from 'lucide-react';
const PRESETS: Preset[] = [
    {
        name: 'Monero Default',
        description: 'Classic Monero Orange',
        config: {
            color: '#F26822',
            shape: 'square',
            cornerType: 'square',
            useGradient: false,
            gradientColor: '#F26822',
            gradientType: 'linear',
            backgroundColor: '#FFFFFF',
        }
    },
    {
        name: 'Dark Mode',
        description: 'Stealth Style',
        config: {
            color: '#FFFFFF',
            shape: 'dots',
            cornerType: 'extra-rounded',
            useGradient: false,
            gradientColor: '#000000',
            gradientType: 'linear',
            backgroundColor: '#000000',
        }
    },
    {
        name: 'Cyberpunk',
        description: 'Neon Vibes',
        config: {
            color: '#00FF00',
            shape: 'classy',
            cornerType: 'dot',
            useGradient: true,
            gradientColor: '#F26822',
            gradientType: 'radial',
            backgroundColor: '#000000',
        }
    }
];
const CRYPTO_OPTIONS: { id: CryptoType; label: string; placeholder: string; supportsMessage: boolean; }[] = [
    { id: 'monero', label: 'Monero', placeholder: '4...', supportsMessage: false },
    { id: 'bitcoin', label: 'Bitcoin', placeholder: 'bc1...', supportsMessage: true },
    { id: 'ethereum', label: 'Ethereum', placeholder: '0x...', supportsMessage: false },
    { id: 'custom', label: 'Custom/URL', placeholder: 'https://example.com', supportsMessage: false }
];
interface QrGeneratorProps {
    wallets: { id: number; currency: string; label: string; address: string }[];
    qrDesign: {
        color: string;
        shape: ShapeType;
        cornerType: CornerType;
        backgroundColor: string;
        useGradient: boolean;
        gradientColor: string;
        gradientType: GradientType;
        logoUrl: string | null;
        amount: string;
    };
    onQrDesignChange: (design: any) => void;
    onUploadLogo: (e: React.ChangeEvent<HTMLInputElement>) => void;
    selectedWalletId: number | null;
    onWalletChange: (id: number) => void;
    onContentChange: (v: string) => void;
    onCryptoChange: (v: CryptoType) => void;
}
export const QrGenerator: React.FC<QrGeneratorProps> = ({
    wallets, qrDesign, onQrDesignChange, onUploadLogo,
    selectedWalletId, onWalletChange, onContentChange, onCryptoChange
}) => {
    const content = qrDesign.content || '';
    const setContent = onContentChange;
    const selectedCrypto = qrDesign.selectedCrypto || 'monero';
    const setSelectedCrypto = onCryptoChange;

    const [label, setLabel] = useState('');
    const [message, setMessage] = useState('');
    const [canvasSize, setCanvasSize] = useState(300);

    const [isDisposable, setIsDisposable] = useState(false);
    const [disposableTimeout, setDisposableTimeout] = useState(60);
    const [qrInstance, setQrInstance] = useState<QRCodeStyling | null>(null);
    const [isGenerated, setIsGenerated] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    const codeSnippet = `<QRCodeStyling
  width={${canvasSize}}
  height={${canvasSize}}
  data="${content}"
  dotsOptions={{
    color: "${qrDesign.color}",
    type: "${qrDesign.shape}"
  }}
  backgroundOptions={{
    color: "${qrDesign.backgroundColor}"
  }}
/>`;
    useEffect(() => {
        if (wallets && wallets.length > 0) {
            if (!selectedWalletId && !qrDesign.content) {
                const defaultWallet = wallets.find(w => w.currency === 'XMR') || wallets[0];
                onWalletChange(defaultWallet.id);
                setContent(defaultWallet.address);
            } else if (selectedWalletId) {
                const w = wallets.find(w => w.id === selectedWalletId);
                if (w && !qrDesign.content) setContent(w.address);
            }
        }
    }, [wallets, selectedWalletId]);

    const handleWalletChangeInternal = (id: number) => {
        const w = wallets.find(w => w.id === id);
        if (w) {
            onWalletChange(id);
            setContent(w.address);
            if (w.currency === 'XMR') setSelectedCrypto('monero');
            if (w.currency === 'BTC') setSelectedCrypto('bitcoin');
            if (w.currency === 'ETH') setSelectedCrypto('ethereum');
        }
    };

    // Consolidated QR Update Logic
    useEffect(() => {
        let instance = qrInstance;
        if (!instance) {
            instance = new QRCodeStyling({
                width: canvasSize,
                height: canvasSize,
                type: 'svg',
                data: content || 'https://goxmr.click',
                image: qrDesign.logoUrl || '',
                dotsOptions: { color: qrDesign.color, type: qrDesign.shape as any },
                backgroundOptions: { color: qrDesign.backgroundColor },
                imageOptions: { crossOrigin: 'anonymous', margin: 10 }
            });
            setQrInstance(instance);
        }

        const timer = setTimeout(() => {
            if (!instance) return;
            setIsLoading(true);

            // Calculate current QR data
            let qrData = content || 'https://goxmr.click';
            if (qrDesign.amount && content) {
                if (selectedCrypto === 'monero') {
                    qrData = `monero:${content}?tx_amount=${qrDesign.amount}`;
                } else if (selectedCrypto === 'bitcoin') {
                    qrData = `bitcoin:${content}?amount=${qrDesign.amount}`;
                } else if (selectedCrypto === 'ethereum') {
                    qrData = `ethereum:${content}?value=${qrDesign.amount}`;
                }
            }

            // Apply all design updates at once
            instance.update({
                width: canvasSize,
                height: canvasSize,
                data: qrData,
                image: qrDesign.logoUrl || '',
                dotsOptions: {
                    color: qrDesign.color,
                    type: qrDesign.shape as any,
                    gradient: qrDesign.useGradient ? {
                        type: qrDesign.gradientType as any,
                        rotation: 0,
                        colorStops: [{ offset: 0, color: qrDesign.color }, { offset: 1, color: qrDesign.gradientColor }]
                    } : undefined
                },
                backgroundOptions: { color: qrDesign.backgroundColor },
                cornersSquareOptions: { type: qrDesign.cornerType as any, color: qrDesign.color },
                cornersDotOptions: { type: qrDesign.cornerType as any, color: qrDesign.color },
            });

            if (qrRef.current) {
                qrRef.current.innerHTML = '';
                instance.append(qrRef.current);
            }

            setTimeout(() => {
                setIsLoading(false);
                setIsGenerated(true);
            }, 500);
        }, 500);

        return () => clearTimeout(timer);
    }, [content, qrDesign, canvasSize, selectedCrypto]);

    const handleDownload = (ext: 'png' | 'svg' | 'pdf') => {
        if (qrInstance) qrInstance.download({ name: 'goxmr-qr', extension: ext });
    };

    const applyPreset = (p: Preset) => {
        onQrDesignChange({
            ...qrDesign,
            color: p.config.color,
            shape: p.config.shape,
            cornerType: p.config.cornerType,
            useGradient: p.config.useGradient,
            gradientColor: p.config.gradientColor,
            gradientType: p.config.gradientType,
            backgroundColor: p.config.backgroundColor
        });
    };
    const detectCrypto = (text: string) => {
        if (text.startsWith('4') || text.startsWith('8')) return 'monero';
        if (text.startsWith('bc1') || text.startsWith('1') || text.startsWith('3')) return 'bitcoin';
        if (text.startsWith('0x')) return 'ethereum';
        return null;
    };
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
            { }
            <div className="lg:col-span-12 flex items-center gap-4 border-b-2 border-black dark:border-zinc-800 pb-4 mb-4">
                <div className="w-12 h-12 bg-black dark:bg-white text-white dark:text-black flex items-center justify-center">
                    <Wallet size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-black font-mono uppercase dark:text-white">QR Foundry</h2>
                    <p className="font-mono text-sm text-gray-500 dark:text-gray-400">Forge custom cryptographic payment codes.</p>
                </div>
            </div>
            <div className="lg:col-span-7">
                <QrForm
                    content={content} onContentChange={setContent}
                    label={label} onLabelChange={setLabel}
                    message={message} onMessageChange={setMessage}
                    amount={qrDesign.amount} onAmountChange={(v) => onQrDesignChange({ ...qrDesign, amount: v })}
                    wallets={wallets}
                    selectedWalletId={selectedWalletId}
                    onWalletChange={handleWalletChangeInternal}
                    onLogoChange={onUploadLogo}
                    logoUrl={qrDesign.logoUrl}
                    color={qrDesign.color} onColorChange={(v) => onQrDesignChange({ ...qrDesign, color: v })}
                    shape={qrDesign.shape} onShapeChange={(v) => onQrDesignChange({ ...qrDesign, shape: v })}
                    cornerType={qrDesign.cornerType} onCornerChange={(v) => onQrDesignChange({ ...qrDesign, cornerType: v })}
                    backgroundColor={qrDesign.backgroundColor} onBackgroundColorChange={(v) => onQrDesignChange({ ...qrDesign, backgroundColor: v })}
                    useGradient={qrDesign.useGradient} onUseGradientChange={(v) => onQrDesignChange({ ...qrDesign, useGradient: v })}
                    gradientColor={qrDesign.gradientColor} onGradientColorChange={(v) => onQrDesignChange({ ...qrDesign, gradientColor: v })}
                    gradientType={qrDesign.gradientType} onGradientTypeChange={(v) => onQrDesignChange({ ...qrDesign, gradientType: v })}
                    isLoading={isLoading}
                    isGenerated={isGenerated}
                    onVerifyClick={() => { }}
                    presets={PRESETS}
                    onApplyPreset={applyPreset}
                    activePreset={null}
                    cryptoOptions={CRYPTO_OPTIONS}
                    selectedCrypto={selectedCrypto}
                    onCryptoChange={setSelectedCrypto}
                    codeSnippet={codeSnippet}
                    qrSize={canvasSize} onQrSizeChange={setCanvasSize}
                    onDetectAndSetCrypto={(text) => {
                        const type = detectCrypto(text);
                        if (type) setSelectedCrypto(type as CryptoType);
                        return type;
                    }}
                    isDisposable={isDisposable} onIsDisposableChange={setIsDisposable}
                    disposableTimeout={disposableTimeout} onDisposableTimeoutChange={setDisposableTimeout}
                />
            </div>
            <div className="lg:col-span-5 relative">
                <QrPreview
                    qrRef={qrRef}
                    isGenerated={isGenerated}
                    isLoading={isLoading}
                    onDownload={handleDownload}
                    countdown={disposableTimeout}
                    isDisposable={isDisposable}
                    qrInstance={qrInstance}
                />
            </div>
        </div>
    );
};
