/**
 * Cryptographic utilities for encrypting/decrypting user data
 * Uses Web Crypto API for secure encryption
 */

/**
 * Encrypt data using a password
 * @param data - Data to encrypt (string or object)
 * @param password - Password to use for encryption
 * @returns Base64 encoded encrypted string
 */
export async function encryptData(data: any, password: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);

    // Generate a key from the password
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    // Generate a random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // Derive encryption key
    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 600000, // OWASP 2024 baseline (read side keeps a 100k fallback)
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    // Generate a random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        encoder.encode(dataString)
    );

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encryptedData), salt.length + iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt data using a password
 * @param encryptedData - Base64 encoded encrypted data
 * @param password - Password to use for decryption
 * @returns Decrypted data (parsed as JSON if possible)
 */
export async function decryptData(encryptedData: string, password: string): Promise<any> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);

    // Generate key material from password
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    // Try the current iteration count first, then fall back to the legacy 100k count
    // so blobs encrypted before the bump still decode. Wrong password fails both paths.
    const tryWithIters = async (iters: number) => {
        const key = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    };
    let decryptedData: ArrayBuffer;
    try { decryptedData = await tryWithIters(600000); }
    catch { decryptedData = await tryWithIters(100000); }

    // Convert back to string
    const decryptedString = decoder.decode(decryptedData);

    // Try to parse as JSON, otherwise return as string
    try {
        return JSON.parse(decryptedString);
    } catch {
        return decryptedString;
    }
}
