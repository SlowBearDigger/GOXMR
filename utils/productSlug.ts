// 3.7 (#7 routing): turn a product into a URL slug and back.
// Format: "<kebab-name>-<id>". The trailing -<id> is authoritative — the kebab name is
// purely human-friendly. Two products with the same name get unique URLs via the id.

export function productSlug(p: { id: number; name?: string | null }): string {
    const raw = (p.name || 'product')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const kebab = raw || 'product';
    return `${kebab}-${p.id}`;
}

export function parseProductSlug(slug: string | undefined): number | null {
    if (!slug) return null;
    const m = slug.match(/-(\d+)$/);
    return m ? parseInt(m[1], 10) : null;
}
