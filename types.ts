export type ShapeType = 'square' | 'dots' | 'rounded' | 'extra-rounded' | 'classy' | 'classy-rounded';
export type CornerType = 'square' | 'dot' | 'extra-rounded';
export type GradientType = 'linear' | 'radial';
export type CryptoType = 'monero' | 'bitcoin' | 'ethereum' | 'custom';

export interface Preset {
    name: string;
    description: string;
    config: {
        color: string;
        shape: ShapeType;
        cornerType: CornerType;
        useGradient: boolean;
        gradientColor: string;
        gradientType: GradientType;
        backgroundColor: string;
    };
}

export interface Link {
    id: number;
    type: string;
    title: string;
    url: string;
    icon?: string;
}

export interface Wallet {
    id: number;
    currency: string;
    label: string;
    address: string;
}

export interface CustomField {
    id: string;
    label: string;
    value: string;
}
