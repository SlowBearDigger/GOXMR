/**
 * API utility for making authenticated requests to the GOXMR backend
 */

// In production, backend serves the frontend from same origin — use relative URLs
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Wrapper around fetch that includes authentication token
 * @param endpoint - API endpoint path (e.g., '/api/trocador/trade/123')
 * @param options - Standard fetch options
 * @returns Promise<Response>
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('goxmr_token');

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

    return fetch(url, {
        ...options,
        headers,
    });
}
