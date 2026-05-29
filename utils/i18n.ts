export type Language = 'en' | 'es';

const translations: Record<Language, Record<string, string>> = {
    en: {
        // Nav
        'nav.identity': '01_IDENTITY',
        'nav.links': '02_PROFILE_LINKS',
        'nav.treasury': '03_TREASURY',
        'nav.assets': '04_CRYPTO_ASSETS',
        'nav.qr': '05_QR_FOUNDRY',
        'nav.design': '06_DESIGN_STUDIO',
        'nav.security': '07_SECURITY_&_OPS',
        'nav.store': '08_STORE_OPS',
        'nav.inbox': '09_ENCRYPTED_INBOX',
        'nav.deploy': 'DEPLOY_CHANGES',
        'nav.deploying': 'DEPLOYING_...',
        'nav.deployed': 'SYNC_COMPLETE',

        // Header
        'header.login': 'Login',
        'header.join': 'Join',
        'header.logout': 'LOGOUT',
        'header.dashboard': 'COMMAND CENTER',
        'header.profile': 'MY PROFILE',
        'header.getxmr': 'GET XMR',

        // Common
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.delete': 'Delete',
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.success': 'Success',
        'common.copied': 'Copied to clipboard',
        'common.close': 'Close',

        // Store
        'store.setup': 'Initialize Store',
        'store.deploy': 'Deploy Store',
        'store.products': 'Products',
        'store.orders': 'Orders',
        'store.addProduct': 'Add Product',
        'store.noProducts': 'No products yet',
        'store.noOrders': 'No orders yet',
        'store.verifyOnChain': 'Verify On-Chain',
        'store.markPaid': 'Mark Paid Manually',
        'store.buyNow': 'Buy Now',

        // Settings
        'settings.nostr': 'Nostr Identity (NIP-05)',
        'settings.nostrHint': 'Set your Nostr pubkey to use username@goxmr.click as your NIP-05 identity.',
        'settings.notifications': 'Email Notifications',
        'settings.notifHint': 'If you have a PGP key set, notification emails will be PGP-encrypted automatically.',
        'settings.language': 'Language',

        // Trust
        'trust.title': 'Trust Score',
        'trust.pgp': 'PGP Verified',
        'trust.hardware': 'Hardware Key',
        'trust.recovery': 'Recovery Set',
        'trust.premium': 'Premium',
        'trust.veteran': 'Veteran',
        'trust.merchant': 'Merchant',

        // Payment
        'pay.sendExactly': 'Send exactly',
        'pay.toAddress': 'to the address below',
        'pay.paymentAddress': 'Payment Address',
        'pay.amount': 'Amount (XMR)',

        // Contact
        'contact.title': 'Encrypted Message',
        'contact.hint': 'Your message will be PGP-encrypted before leaving your browser.',
        'contact.sent': 'Message sent securely',
        'contact.send': 'Send Encrypted Message',

        // Disclaimer
        'disclaimer.title': 'Independent Seller',
        'disclaimer.body': 'GOXMR is a platform only. We do NOT verify sellers, guarantee products, or process payments. Transactions are direct between buyer and seller. Do your own research. WE ARE NOT RESPONSIBLE FOR SCAMS OR DISPUTES.',
    },
    es: {
        // Nav
        'nav.identity': '01_IDENTIDAD',
        'nav.links': '02_ENLACES',
        'nav.treasury': '03_TESORO',
        'nav.assets': '04_ACTIVOS_CRYPTO',
        'nav.qr': '05_FORJA_QR',
        'nav.design': '06_ESTUDIO_DISENO',
        'nav.security': '07_SEGURIDAD_&_OPS',
        'nav.store': '08_TIENDA_OPS',
        'nav.inbox': '09_BUZON_CIFRADO',
        'nav.deploy': 'DESPLEGAR_CAMBIOS',
        'nav.deploying': 'DESPLEGANDO_...',
        'nav.deployed': 'SYNC_COMPLETO',

        // Header
        'header.login': 'Entrar',
        'header.join': 'Unirse',
        'header.logout': 'SALIR',
        'header.dashboard': 'CENTRO DE CONTROL',
        'header.profile': 'MI PERFIL',
        'header.getxmr': 'OBTENER XMR',

        // Common
        'common.save': 'Guardar',
        'common.cancel': 'Cancelar',
        'common.delete': 'Eliminar',
        'common.loading': 'Cargando...',
        'common.error': 'Error',
        'common.success': 'Exitoso',
        'common.copied': 'Copiado al portapapeles',
        'common.close': 'Cerrar',

        // Store
        'store.setup': 'Inicializar Tienda',
        'store.deploy': 'Desplegar Tienda',
        'store.products': 'Productos',
        'store.orders': 'Ordenes',
        'store.addProduct': 'Agregar Producto',
        'store.noProducts': 'Sin productos aun',
        'store.noOrders': 'Sin ordenes aun',
        'store.verifyOnChain': 'Verificar On-Chain',
        'store.markPaid': 'Marcar Pagado Manual',
        'store.buyNow': 'Comprar',

        // Settings
        'settings.nostr': 'Identidad Nostr (NIP-05)',
        'settings.nostrHint': 'Configura tu pubkey Nostr para usar usuario@goxmr.click como identidad NIP-05.',
        'settings.notifications': 'Notificaciones por Email',
        'settings.notifHint': 'Si tienes una clave PGP, las notificaciones se encriptaran automaticamente.',
        'settings.language': 'Idioma',

        // Trust
        'trust.title': 'Puntaje de Confianza',
        'trust.pgp': 'PGP Verificado',
        'trust.hardware': 'Llave Hardware',
        'trust.recovery': 'Recuperacion Activa',
        'trust.premium': 'Premium',
        'trust.veteran': 'Veterano',
        'trust.merchant': 'Vendedor',

        // Payment
        'pay.sendExactly': 'Enviar exactamente',
        'pay.toAddress': 'a la direccion de abajo',
        'pay.paymentAddress': 'Direccion de Pago',
        'pay.amount': 'Monto (XMR)',

        // Contact
        'contact.title': 'Mensaje Cifrado',
        'contact.hint': 'Tu mensaje sera cifrado con PGP antes de salir de tu navegador.',
        'contact.sent': 'Mensaje enviado de forma segura',
        'contact.send': 'Enviar Mensaje Cifrado',

        // Disclaimer
        'disclaimer.title': 'Vendedor Independiente',
        'disclaimer.body': 'GOXMR es solo una plataforma. NO verificamos vendedores, garantizamos productos, ni procesamos pagos. Las transacciones son directas entre comprador y vendedor. Investiga bien. NO NOS HACEMOS RESPONSABLES DE ESTAFAS NI DISPUTAS.',
    }
};

export function t(key: string, lang: Language = 'en'): string {
    return translations[lang]?.[key] || translations.en[key] || key;
}

export function getLanguage(): Language {
    const saved = localStorage.getItem('goxmr_lang');
    if (saved === 'es') return 'es';
    return 'en';
}

export function setLanguage(lang: Language) {
    localStorage.setItem('goxmr_lang', lang);
}
