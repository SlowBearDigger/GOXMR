import { CryptoType } from '../../types';

export const MONERO_ORANGE = '#F26822';

export const CRYPTO_OPTIONS: {
    id: CryptoType;
    label: string;
    placeholder: string;
    uri: string;
    regex: RegExp | null;
    supportsMessage: boolean;
    messageParam: string;
    labelParam?: string;
}[] = [
        {
            id: 'custom',
            label: 'Custom / URL',
            placeholder: 'https://example.com or plain text',
            uri: '',
            regex: null,
            supportsMessage: false,
            messageParam: ''
        },
        { id: 'monero', label: 'Monero (XMR)', placeholder: '4...', uri: 'monero', regex: /^[48][1-9A-HJ-NP-Za-km-z]{94}$/, supportsMessage: true, messageParam: 'tx_description', labelParam: 'recipient_name' },
        { id: 'bitcoin', label: 'Bitcoin (BTC)', placeholder: 'bc1...', uri: 'bitcoin', regex: /^(bc1p|bc1q|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/, supportsMessage: true, messageParam: 'message', labelParam: 'label' },
        { id: 'ethereum', label: 'Ethereum (ETH)', placeholder: '0x...', uri: 'ethereum', regex: /^0x[a-fA-F0-9]{40}$/, supportsMessage: false, messageParam: '' },
        { id: 'solana', label: 'Solana (SOL)', placeholder: 'Enter Solana address', uri: 'solana', regex: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/, supportsMessage: false, messageParam: 'label' },
        { id: 'zcash', label: 'Zcash (ZEC)', placeholder: 'Enter Zcash address', uri: 'zcash', regex: /^t[13][a-zA-Z0-9]{33}$|^z[a-zA-Z0-9]{94}$|^zs[a-zA-Z0-9]{76}$/, supportsMessage: true, messageParam: 'memo' },
        { id: 'litecoin', label: 'Litecoin (LTC)', placeholder: 'Enter Litecoin address', uri: 'litecoin', regex: /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[a-z0-9]{39,59}$/, supportsMessage: true, messageParam: 'message' }
    ];
