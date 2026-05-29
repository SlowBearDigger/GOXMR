import React, { useState, useEffect, useCallback } from 'react';
import { Search, Loader2, Database, Box, ArrowRight, Link2, Copy, Check, Clock, TrendingUp, Cpu, Shield, ShieldCheck } from 'lucide-react';

interface BlockHeader {
    height: number;
    hash: string;
    timestamp: number;
    difficulty: number | string;
    num_txes: number;
    reward: number | string;
}

export const BlockExplorer: React.FC = () => {
    const [blocks, setBlocks] = useState<BlockHeader[]>([]);
    const [latestHeight, setLatestHeight] = useState<number>(0);
    const [page, setPage] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [copiedHash, setCopiedHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const callRpc = useCallback(async (method: string, params: any = {}) => {
        const res = await fetch('/api/explorer/rpc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method, params })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || 'RPC Error');
        return data.result;
    }, []);

    const fetchLatestBlocks = useCallback(async () => {
        setIsLoading(true);
        try {
            setError(null);
            const countResult = await callRpc('get_block_count');
            const currentHeight = countResult.count;
            setLatestHeight(currentHeight);

            const countPerPage = 10;
            const end = currentHeight - (page * countPerPage);
            const start = Math.max(0, end - countPerPage);

            if (end <= 0) {
                setBlocks([]);
                return;
            }

            const headersResult = await callRpc('get_block_headers_range', {
                start_height: start,
                end_height: end - 1
            });

            if (headersResult && headersResult.headers) {
                setBlocks([...headersResult.headers].reverse());
            }
        } catch (e: any) {
            setError(e.message || 'Node unreachable');
            throw e; // so the poller can back off
        } finally {
            setIsLoading(false);
        }
    }, [callRpc, page]);

    // Poll for new blocks every minute, but back off after consecutive failures so a downed
    // node doesn't spam errors forever. The user can still hit "Retry" via the search bar.
    useEffect(() => {
        let cancelled = false;
        let failures = 0;
        let timer: any;
        const tick = async () => {
            if (cancelled) return;
            try {
                await fetchLatestBlocks();
                failures = 0;
            } catch { failures++; }
            if (cancelled) return;
            // back off: 60s while healthy, 5min after 3 consecutive failures, stop after 6
            if (failures >= 6) return;
            const next = failures >= 3 ? 5 * 60_000 : 60_000;
            timer = setTimeout(tick, next);
        };
        tick();
        return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, [fetchLatestBlocks]);

    const selectBlock = async (height: number) => {
        setIsSearching(true);
        setSearchResult(null);
        try {
            const result = await callRpc('get_block_header_by_height', { height });
            setSearchResult({ type: 'block', data: result.block_header });
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
            setError("Failed to fetch block details.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setSearchResult(null);
        setError(null);

        try {
            const isHeight = /^\d+$/.test(searchQuery.trim());

            if (isHeight) {
                const height = parseInt(searchQuery.trim());
                const result = await callRpc('get_block_header_by_height', { height });
                setSearchResult({ type: 'block', data: result.block_header });
            } else {
                try {
                    const txResult = await callRpc('get_transactions', { txs_hashes: [searchQuery.trim()], decode_as_json: true });
                    if (txResult.txs && txResult.txs.length > 0) {
                        const tx = txResult.txs[0];
                        // Calculate confirmations
                        const confs = tx.block_height ? (latestHeight - tx.block_height + 1) : 0;
                        setSearchResult({
                            type: 'tx',
                            data: {
                                ...tx,
                                tx_hash: searchQuery.trim(),
                                confirmations: confs
                            }
                        });
                    } else {
                        const blockResult = await callRpc('get_block_header_by_hash', { hash: searchQuery.trim() });
                        setSearchResult({ type: 'block', data: blockResult.block_header });
                    }
                } catch (txErr) {
                    const blockResult = await callRpc('get_block_header_by_hash', { hash: searchQuery.trim() });
                    setSearchResult({ type: 'block', data: blockResult.block_header });
                }
            }
        } catch (e: any) {
            setError("Resource not found or RPC error. Verify hash/height.");
        } finally {
            setIsSearching(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedHash(text);
        setTimeout(() => setCopiedHash(null), 2000);
    };

    const formatTimestamp = (ts: number) => {
        return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatReward = (reward: any) => {
        return (parseFloat(reward.toString()) / 1e12).toFixed(4);
    };

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            {/* Header / Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-4 shadow-[4px_4px_0px_0px_rgba(242,104,34,1)]">
                    <div className="flex items-center gap-3 mb-1">
                        <Database size={16} className="text-monero-orange" />
                        <span className="font-mono text-[10px] uppercase font-black tracking-widest text-gray-500">Chain_Height</span>
                    </div>
                    <div className="text-3xl font-black font-mono tracking-tighter text-black dark:text-white">
                        {isLoading && latestHeight === 0 ? <Loader2 size={24} className="animate-spin" /> : latestHeight.toLocaleString()}
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-4 shadow-[4px_4px_0px_0px_rgba(242,104,34,1)]">
                    <div className="flex items-center gap-3 mb-1">
                        <TrendingUp size={16} className="text-monero-orange" />
                        <span className="font-mono text-[10px] uppercase font-black tracking-widest text-gray-500">Network_Health</span>
                    </div>
                    <div className="text-2xl font-black font-mono tracking-tighter text-black dark:text-white uppercase">
                        Sovereign_Active
                    </div>
                </div>
                <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-4 shadow-[4px_4px_0px_0px_rgba(242,104,34,1)]">
                    <div className="flex items-center gap-3 mb-1">
                        < Shield size={16} className="text-monero-orange" />
                        <span className="font-mono text-[10px] uppercase font-black tracking-widest text-gray-500">Privacy_Protocol</span>
                    </div>
                    <div className="text-2xl font-black font-mono tracking-tighter text-black dark:text-white uppercase">
                        Zero_Knowledge
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative group">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ENTER_BLOCK_HEIGHT_OR_TRANSACTION_HASH..."
                    className="w-full bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-6 font-mono text-lg font-black uppercase tracking-tighter focus:outline-none focus:ring-4 focus:ring-monero-orange transition-all placeholder:opacity-30"
                />
                <button
                    type="submit"
                    disabled={isSearching}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black dark:bg-white text-white dark:text-black font-black p-3 uppercase text-xs hover:bg-monero-orange hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                >
                    {isSearching ? <Loader2 size={20} className="animate-spin" /> : 'SEARCH_CHAIN'}
                </button>
            </form>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Visual Stream (Left Side) - 8 columns */}
                <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6">
                    <div className="bg-white dark:bg-zinc-900 border-4 border-black dark:border-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3 dark:text-white">
                                <Box size={24} className="text-monero-orange" />
                                Block_Stream_Live
                            </h2>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[8px] font-black uppercase opacity-30 dark:text-white">Page: {page + 1}</span>
                                    <div className="flex gap-1">
                                        <button
                                            disabled={page === 0}
                                            onClick={() => setPage(p => Math.max(0, p - 1))}
                                            className="p-1 border border-black dark:border-white hover:bg-monero-orange transition-all disabled:opacity-10"
                                        >
                                            <ArrowRight className="rotate-180" size={12} />
                                        </button>
                                        <button
                                            onClick={() => setPage(p => p + 1)}
                                            className="p-1 border border-black dark:border-white hover:bg-monero-orange transition-all"
                                        >
                                            <ArrowRight size={12} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="font-mono text-[10px] font-black uppercase opacity-50 dark:text-white">Live Node</span>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="mb-6 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-4 font-mono font-bold text-xs uppercase text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            {isLoading ? (
                                <div className="py-20 flex flex-col items-center gap-4">
                                    <Loader2 size={48} className="animate-spin text-monero-orange" />
                                    <span className="font-mono font-black uppercase text-xs animate-pulse opacity-50 dark:text-white">Fetching Chain_Data...</span>
                                </div>
                            ) : (
                                blocks.map((block, idx) => (
                                    <div
                                        key={block.hash}
                                        onClick={() => selectBlock(block.height)}
                                        className="group relative flex items-center gap-4 bg-gray-50 dark:bg-zinc-800/50 p-4 border-2 border-transparent hover:border-black dark:hover:border-white transition-all animate-in slide-in-from-left duration-500 cursor-pointer"
                                        style={{ animationDelay: `${idx * 100}ms` }}
                                    >
                                        <div className="bg-black dark:bg-white text-white dark:text-black font-mono font-black px-3 py-1 text-sm shadow-[2px_2px_0px_0px_rgba(242,104,34,1)]">
                                            {block.height}
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="font-mono text-[9px] font-black uppercase opacity-40 dark:text-white">Hash:</span>
                                                <span className="font-mono text-[10px] font-bold truncate opacity-80 dark:text-white">{block.hash}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all text-gray-500 dark:text-gray-400">
                                                    <Clock size={12} />
                                                    <span className="font-mono text-[10px] font-black uppercase">{formatTimestamp(block.timestamp)}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all text-gray-500 dark:text-gray-400">
                                                    <Link2 size={12} />
                                                    <span className="font-mono text-[10px] font-black uppercase">{block.num_txes} TXs</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 grayscale group-hover:grayscale-0 transition-all text-gray-500 dark:text-gray-400">
                                                    <Box size={12} />
                                                    <span className="font-mono text-[10px] font-black uppercase whitespace-nowrap">{formatReward(block.reward)} XMR</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(block.hash); }}
                                            className="p-2 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all"
                                        >
                                            {copiedHash === block.hash ? <Check size={16} /> : <Copy size={16} />}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Details View (Right Side) - 4 columns */}
                <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-6">
                    <div className="bg-black dark:bg-zinc-950 border-4 border-black dark:border-white p-6 shadow-[8px_8px_0px_0px_rgba(242,104,34,1)] text-white sticky top-24">
                        <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3 mb-6">
                            <Cpu size={20} className="text-monero-orange" />
                            Inspection_Unit
                        </h3>

                        {!searchResult ? (
                            <div className="py-12 flex flex-col items-center gap-4 opacity-30 text-center">
                                <Box size={40} className="border-2 border-dashed border-gray-500 p-2" />
                                <p className="font-mono text-[10px] uppercase font-black leading-tight">
                                    SELECT_RESOURCE_FROM_FEED<br />OR_USE_SEARCH_PROTOCOL
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-6 animate-in zoom-in duration-300">
                                <div className="border-b border-white/20 pb-4">
                                    <div className="flex justify-between items-start">
                                        <div className="bg-monero-orange text-[9px] font-black uppercase w-fit px-2 py-0.5 mb-2">
                                            {searchResult.type === 'block' ? 'BLOCK_ENTRY' : 'TX_MANIFEST'}
                                        </div>
                                        <div className="text-[10px] font-mono font-black uppercase text-green-500 flex items-center gap-1">
                                            <ShieldCheck size={12} /> {searchResult.type === 'block' ? 'Confirmed' : `${searchResult.data.confirmations} Confs`}
                                        </div>
                                    </div>
                                    <h4 className="font-mono text-xl font-black tracking-tighter truncate mt-1">
                                        {searchResult.type === 'block' ? searchResult.data.height : searchResult.data.tx_hash?.substring(0, 16) + '...'}
                                    </h4>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="font-mono text-[10px] font-black uppercase opacity-50">Content_Hash:</span>
                                        <div className="group relative flex items-center gap-2 bg-white/5 p-2 font-mono text-[9px] break-all border border-white/10">
                                            {searchResult.type === 'block' ? searchResult.data.hash : searchResult.data.tx_hash}
                                            <button
                                                onClick={() => copyToClipboard(searchResult.type === 'block' ? searchResult.data.hash : searchResult.data.tx_hash)}
                                                className="ml-auto p-1 bg-white/10 hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                {copiedHash === (searchResult.type === 'block' ? searchResult.data.hash : searchResult.data.tx_hash) ? <Check size={10} /> : <Copy size={10} />}
                                            </button>
                                        </div>
                                    </div>

                                    {searchResult.type === 'block' ? (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-3 bg-white/5 border border-white/10">
                                                    <span className="block font-mono text-[8px] font-black uppercase opacity-50 mb-1">Transactions</span>
                                                    <span className="block font-mono text-sm font-black">{searchResult.data.num_txes}</span>
                                                </div>
                                                <div className="p-3 bg-white/5 border border-white/10">
                                                    <span className="block font-mono text-[8px] font-black uppercase opacity-50 mb-1">Reward</span>
                                                    <span className="block font-mono text-sm font-black text-monero-orange">{formatReward(searchResult.data.reward)}</span>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white/5 border border-white/10">
                                                <span className="block font-mono text-[8px] font-black uppercase opacity-50 mb-1">Timestamp</span>
                                                <span className="block font-mono text-xs font-black">{new Date(searchResult.data.timestamp * 1000).toLocaleString()}</span>
                                            </div>
                                            <div className="p-3 bg-white/5 border border-white/10">
                                                <span className="block font-mono text-[8px] font-black uppercase opacity-50 mb-1">Difficulty</span>
                                                <span className="block font-mono text-[10px] font-black truncate">{searchResult.data.difficulty?.toString()}</span>
                                            </div>
                                        </>
                                    ) : (
                                        /* Transaction Details */
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-3 bg-white/5 border border-white/10">
                                                    <span className="block font-mono text-[8px] font-black uppercase opacity-50 mb-1">Block_Height</span>
                                                    <span className="block font-mono text-sm font-black text-blue-400">{searchResult.data.block_height}</span>
                                                </div>
                                                <div className="p-3 bg-white/5 border border-white/10">
                                                    <span className="block font-mono text-[8px] font-black uppercase opacity-50 mb-1">Size (KB)</span>
                                                    <span className="block font-mono text-sm font-black">
                                                        {searchResult.data.as_hex
                                                            ? (searchResult.data.as_hex.length / 2048).toFixed(2)
                                                            : (searchResult.data.as_json ? (JSON.parse(searchResult.data.as_json).size / 1024 || 0).toFixed(2) : '0.00')}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-white/5 border border-white/10">
                                                <span className="block font-mono text-[8px] font-black uppercase opacity-50 mb-1">Privacy_Protocol</span>
                                                <div className="flex gap-1 mt-1">
                                                    <div className="text-[10px] font-mono font-black bg-monero-orange/20 text-monero-orange px-2 py-0.5 border border-monero-orange/30">RING_CT</div>
                                                    <div className="text-[10px] font-mono font-black bg-monero-orange/20 text-monero-orange px-2 py-0.5 border border-monero-orange/30">STEALTH</div>
                                                </div>
                                            </div>
                                            <div className="bg-monero-orange/10 p-4 border border-monero-orange/30">
                                                <p className="font-mono text-[9px] font-black uppercase leading-tight text-white/80">
                                                    Monero obscures amounts, senders, and receivers. Exact fee and output values are cryptographically shielded.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={() => setSearchResult(null)}
                                    className="w-full border-2 border-white py-2 font-mono text-[10px] font-black uppercase hover:bg-white hover:text-black transition-all mt-4"
                                >
                                    CLEAR_UNIT
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="bg-monero-orange p-6 border-4 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]">
                        <h4 className="text-white font-black uppercase tracking-tighter mb-2">Protocol Note</h4>
                        <p className="font-mono text-[9px] text-white/90 leading-tight uppercase font-black">
                            Blockchain results are proxied through your configured Sovereign node.
                            Zero data leaks. Zero tracking. Pure cryptography.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
