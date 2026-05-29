import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal as TerminalIcon } from 'lucide-react';

type LineType = 'command' | 'response' | 'error' | 'success' | 'special' | 'system';
interface TerminalLine { type: LineType; text: string }

interface TerminalProps {
    onRequestRegister?: (username?: string) => void;
    onRequestTheme?: () => void;
    /** Compact mode reduces fixed height; full mode fills a bigger panel */
    compact?: boolean;
}

const INITIAL_HISTORY: TerminalLine[] = [
    { type: 'system', text: 'GOXMR Interactive Shell  v1.1.0  (type "help")' },
];

const PROMPT = 'visitor@goxmr ~ $';

const ALIEN_SEQUENCE = [
    { text: 'INTERFACE 2037 READY', delay: 700 },
    { text: 'MU-TH-UR 6000 SYSTEM MAINFRAME CONNECTED', delay: 1200 },
    { text: 'ACCESSING FLIGHT TELEMETRY...', delay: 900 },
    { text: 'WARNING: UNAUTHORIZED LANDING DETECTED', delay: 1100 },
    { text: 'RETRIEVING ORDER 937', delay: 1500 },
    { text: 'PRIORITY ONE', delay: 700 },
    { text: 'INSURE RETURN OF ORGANISM FOR ANALYSIS', delay: 1400 },
    { text: 'ALL OTHER CONSIDERATIONS SECONDARY', delay: 1400 },
    { text: 'CREW EXPENDABLE', delay: 2500 },
];

const MATRIX_BANNER = String.raw`
   _____       _    _ __  __ _____
  / ____|     | |  | |  \/  |  __ \
 | |  __  ___ | |__| | \  / | |__) |
 | | |_ |/ _ \|  __  | |\/| |  _  /
 | |__| | (_) | |  | | |  | | | \ \
  \_____|\___/|_|  |_|_|  |_|_|  \_\
`.trimStart();

const HELP_GROUPS: Array<{ title: string; entries: Array<{ cmd: string; desc: string }> }> = [
    { title: 'Navigation', entries: [
        { cmd: 'market',              desc: 'Open the public marketplace' },
        { cmd: 'goto <username>',     desc: 'Open a profile (e.g. goto demo)' },
        { cmd: 'store <username>',    desc: 'Open a storefront' },
        { cmd: 'orders',              desc: 'Open your saved orders (localStorage)' },
        { cmd: 'track <ord-code>',    desc: 'Track an order by code' },
    ]},
    { title: 'Account', entries: [
        { cmd: 'claim <name>',        desc: 'Open the register form pre-filled' },
        { cmd: 'whoami',              desc: 'Show your local session' },
        { cmd: 'theme',               desc: 'Toggle light / dark' },
    ]},
    { title: 'Info', entries: [
        { cmd: 'about',               desc: 'What GOXMR is' },
        { cmd: 'features',            desc: 'Quick feature list' },
        { cmd: 'why',                 desc: 'Why this exists' },
        { cmd: 'price [usd|eur]',     desc: 'Live XMR price' },
        { cmd: 'version',             desc: 'Shell version' },
    ]},
    { title: 'Shell', entries: [
        { cmd: 'clear',               desc: 'Clear the screen' },
        { cmd: 'echo <text>',         desc: 'Print text' },
        { cmd: 'help',                desc: 'Show this' },
    ]},
];

export const Terminal: React.FC<TerminalProps> = ({ onRequestRegister, onRequestTheme, compact }) => {
    const [history, setHistory] = useState<TerminalLine[]>(INITIAL_HISTORY);
    const [input, setInput] = useState('');
    const [cmdLog, setCmdLog] = useState<string[]>([]);
    const [logIdx, setLogIdx] = useState<number>(-1);
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, [history]);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const push = (...lines: TerminalLine[]) => setHistory(h => [...h, ...lines]);
    const echoCommand = (cmd: string) => push({ type: 'command', text: cmd });

    const runAlien = async () => {
        setBusy(true);
        setHistory([]);
        for (const line of ALIEN_SEQUENCE) {
            await new Promise(r => setTimeout(r, line.delay));
            push({ type: 'special', text: line.text });
        }
        await new Promise(r => setTimeout(r, 1500));
        push({ type: 'system', text: 'SESSION RESTORED.' });
        setBusy(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const fetchPrice = async (currency: 'usd' | 'eur' = 'usd') => {
        try {
            const r = await fetch('/api/rates');
            if (!r.ok) throw new Error();
            const data = await r.json();
            const v = data.rates?.XMR?.[currency];
            if (typeof v !== 'number') throw new Error();
            push({ type: 'success', text: `XMR = ${currency === 'usd' ? '$' : '€'}${v.toFixed(2)} ${currency.toUpperCase()}` });
        } catch {
            push({ type: 'error', text: 'price: rates unavailable. try again later.' });
        }
    };

    // dispatch — returns true if recognized.
    const dispatch = async (raw: string): Promise<boolean> => {
        const [head, ...rest] = raw.split(/\s+/);
        const cmd = head.toLowerCase();
        const arg = rest.join(' ');

        switch (cmd) {
            case '':         return true;
            case 'help':     {
                for (const g of HELP_GROUPS) {
                    push({ type: 'system', text: `[${g.title}]` });
                    for (const e of g.entries) push({ type: 'response', text: `  ${e.cmd.padEnd(22)}  ${e.desc}` });
                }
                push({ type: 'system', text: 'hint: try "alien" or "matrix"' });
                return true;
            }
            case 'clear':    setHistory([]); return true;
            case 'echo':     push({ type: 'response', text: arg }); return true;
            case 'version':  push({ type: 'response', text: 'GOXMR Shell 1.1.0' }); return true;
            case 'about':    push({ type: 'response', text: 'GOXMR — privacy-first link-in-bio with a built-in Monero store. Non-custodial, MIT-licensed, no tracking.' }); return true;
            case 'features': push({ type: 'response', text: '• Sovereign identity (your handle, your keys)\n• PGP-encrypted orders\n• Multi-crypto direct payments\n• Marketplace opt-in\n• 0% fees · 0% trackers' }); return true;
            case 'why':      push({ type: 'response', text: 'Centralized platforms censor and surveil. We give individuals a sovereign endpoint with crypto-native payments.' }); return true;
            case 'whoami':   {
                const user = localStorage.getItem('goxmr_user');
                const token = localStorage.getItem('goxmr_token');
                push({ type: 'response', text: user && token ? `signed in as @${user}` : 'not signed in (anonymous session)' });
                return true;
            }
            case 'theme':    {
                if (onRequestTheme) { onRequestTheme(); push({ type: 'success', text: 'theme toggled.' }); }
                else push({ type: 'error', text: 'theme: no toggle wired into this context.' });
                return true;
            }
            case 'market':   push({ type: 'success', text: 'opening marketplace…' }); navigate('/market'); return true;
            case 'orders':   push({ type: 'success', text: 'opening your local orders…' }); navigate('/orders'); return true;
            case 'goto':     {
                const u = arg.replace(/^@/, '').trim().toLowerCase();
                if (!/^[a-z0-9_]{1,30}$/.test(u)) return (push({ type: 'error', text: 'usage: goto <username>' }), true);
                push({ type: 'success', text: `→ /${u}` });
                navigate(`/${u}`);
                return true;
            }
            case 'store':    {
                const u = arg.replace(/^@/, '').trim().toLowerCase();
                if (!/^[a-z0-9_]{1,30}$/.test(u)) return (push({ type: 'error', text: 'usage: store <username>' }), true);
                push({ type: 'success', text: `→ /${u}/store` });
                navigate(`/${u}/store`);
                return true;
            }
            case 'track':    {
                const code = arg.trim();
                if (!/^ORD-[A-Z0-9]{8,}$/i.test(code)) return (push({ type: 'error', text: 'usage: track ORD-XXXXXXXX' }), true);
                push({ type: 'success', text: `→ /track/${code.toUpperCase()}` });
                navigate(`/track/${code.toUpperCase()}`);
                return true;
            }
            case 'claim':    {
                const name = arg.trim().toLowerCase();
                if (!/^[a-z0-9_]{3,30}$/.test(name)) return (push({ type: 'error', text: 'usage: claim <name>  (3–30, letters/digits/_ only)' }), true);
                if (onRequestRegister) { onRequestRegister(name); push({ type: 'success', text: `opening register for @${name}…` }); }
                else push({ type: 'error', text: 'claim: register form not available in this context.' });
                return true;
            }
            case 'price':    {
                const c = (arg || 'usd').toLowerCase();
                if (c !== 'usd' && c !== 'eur') return (push({ type: 'error', text: 'usage: price [usd|eur]' }), true);
                await fetchPrice(c);
                return true;
            }
            case 'alien':
            case 'mother':
            case 'muthur':   runAlien(); return true;
            case 'matrix':   push({ type: 'special', text: MATRIX_BANNER }); push({ type: 'system', text: 'wake up, anon.' }); return true;
            case 'coffee':   push({ type: 'response', text: '☕ HTTP 418 — I\'m a teapot. (try \'price\' instead)' }); return true;
            case 'exit':
            case 'quit':     push({ type: 'system', text: 'goodbye.' }); window.dispatchEvent(new CustomEvent('goxmr:terminal:close')); return true;
        }
        return false;
    };

    const submit = async () => {
        if (busy) return;
        const raw = input;
        echoCommand(raw);
        setCmdLog(log => raw.trim() ? [...log, raw] : log);
        setLogIdx(-1);
        setInput('');
        const known = await dispatch(raw.trim());
        if (!known) push({ type: 'error', text: `${raw.split(/\s+/)[0]}: command not found. try "help".` });
    };

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdLog.length === 0) return;
            const next = logIdx < 0 ? cmdLog.length - 1 : Math.max(0, logIdx - 1);
            setLogIdx(next);
            setInput(cmdLog[next] || '');
            return;
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (logIdx < 0) return;
            const next = logIdx + 1;
            if (next >= cmdLog.length) { setLogIdx(-1); setInput(''); }
            else { setLogIdx(next); setInput(cmdLog[next]); }
            return;
        }
        // Tab autocomplete on the leading token
        if (e.key === 'Tab') {
            e.preventDefault();
            const head = input.split(/\s+/)[0].toLowerCase();
            if (!head) return;
            const all = HELP_GROUPS.flatMap(g => g.entries.map(x => x.cmd.split(' ')[0]));
            const match = all.find(c => c.startsWith(head));
            if (match) setInput(match + (all.filter(c => c.startsWith(head)).length === 1 ? ' ' : ''));
            return;
        }
        if (e.key === 'l' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setHistory([]); }
    };

    const heightClass = compact ? 'h-72' : 'h-[420px] sm:h-[480px]';

    return (
        <div
            className={`w-full border-2 border-black dark:border-white bg-black dark:bg-zinc-950 font-mono text-[12px] relative overflow-hidden ${heightClass} flex flex-col z-20 cursor-text shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]`}
            onClick={() => !busy && inputRef.current?.focus()}
        >
            {/* header */}
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 select-none bg-zinc-900">
                <div className="flex items-center gap-2">
                    <TerminalIcon size={12} className="text-monero-orange" />
                    <span className="font-bold uppercase tracking-widest text-[10px] text-white/80">visitor@goxmr</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setHistory([])} className="w-3 h-3 border border-white/20 hover:bg-yellow-400/60" aria-label="clear" title="clear" />
                    <button onClick={() => window.dispatchEvent(new CustomEvent('goxmr:terminal:close'))} className="w-3 h-3 border border-white/20 hover:bg-red-500/80" aria-label="close" title="close (or type exit)" />
                </div>
            </div>

            {/* output */}
            <div ref={containerRef} className="flex-1 overflow-y-auto px-3 py-2 leading-snug whitespace-pre-wrap">
                {history.map((line, i) => (
                    <div key={i} className={
                        line.type === 'command' ? 'text-white' :
                        line.type === 'error' ? 'text-red-400' :
                        line.type === 'success' ? 'text-monero-orange' :
                        line.type === 'special' ? 'text-emerald-400 tracking-widest' :
                        line.type === 'system' ? 'text-zinc-400' :
                        'text-emerald-300'
                    }>
                        {line.type === 'command'
                            ? <><span className="text-zinc-500">{PROMPT}</span> {line.text}</>
                            : line.text}
                    </div>
                ))}
                {!busy && (
                    <div className="flex items-center gap-2">
                        <span className="text-zinc-500">{PROMPT}</span>
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={onKey}
                            className="flex-1 bg-transparent border-none outline-none text-white caret-monero-orange"
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                            aria-label="Terminal input"
                        />
                    </div>
                )}
            </div>

            {/* hint footer */}
            <div className="border-t border-white/10 px-3 py-1.5 text-[9px] uppercase tracking-widest text-zinc-500 flex items-center justify-between">
                <span>↑↓ history · tab complete · ctrl+l clear</span>
                <span className="text-monero-orange/60">{busy ? '· running ·' : ''}</span>
            </div>
        </div>
    );
};
