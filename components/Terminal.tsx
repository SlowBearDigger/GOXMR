import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';
interface TerminalLine {
  type: 'command' | 'response' | 'error' | 'special';
  text: string;
}
const INITIAL_HISTORY: TerminalLine[] = [
  { type: 'response', text: 'GOXMR Interactive Shell v1.0.0' },
  { type: 'response', text: 'Type "help" to see available commands.' },
];
const COMMANDS: Record<string, string> = {
  about: "GOXMR is a privacy-first, open-source link-in-bio solution designed for the Monero ecosystem.",
  features: "• Monero First\n• Zero Tracking\n• Open Source\n• Custom/Cypherpunk Themes",
  why: "Because privacy is a human right. Centralized platforms censor; we empower.",
  contact: "Secure comms via Session.",
  socials: "We are everywhere and nowhere.",
};
const ALIEN_SEQUENCE = [
  { text: "INTERFACE 2037 READY", delay: 800 },
  { text: "MU-TH-UR 6000 SYSTEM MAINFRAME CONNECTED", delay: 1500 },
  { text: "ACCESSING FLIGHT TELEMETRY...", delay: 1000 },
  { text: "WARNING: UNAUTHORIZED LANDING DETECTED", delay: 1200 },
  { text: "RETRIEVING ORDER 937", delay: 2000 },
  { text: "PRIORITY ONE", delay: 800 },
  { text: "INSURE RETURN OF ORGANISM FOR ANALYSIS", delay: 1500 },
  { text: "ALL OTHER CONSIDERATIONS SECONDARY", delay: 1500 },
  { text: "CREW EXPENDABLE", delay: 3000 },
];
export const Terminal: React.FC = () => {
  const [history, setHistory] = useState<TerminalLine[]>(INITIAL_HISTORY);
  const [input, setInput] = useState('');
  const [isSequencePlaying, setIsSequencePlaying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };
  useEffect(() => {
    scrollToBottom();
  }, [history]);
  const runAlienSequence = async () => {
    setIsSequencePlaying(true);
    setHistory([]);
    for (const line of ALIEN_SEQUENCE) {
      await new Promise(resolve => setTimeout(resolve, line.delay));
      setHistory(prev => [...prev, { type: 'special', text: line.text }]);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    setHistory(prev => [...prev, { type: 'response', text: 'SESSION RESTORED.' }]);
    setIsSequencePlaying(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };
  const handleCommand = (cmd: string) => {
    const cleanCmd = cmd.trim().toLowerCase();
    if (['alien', 'mother', 'muthur'].includes(cleanCmd)) {
      runAlienSequence();
      setInput('');
      return;
    }
    const newHistory = [...history, { type: 'command' as const, text: cmd }];
    if (cleanCmd === 'clear') {
      setHistory([]);
      return;
    }
    if (cleanCmd === 'help') {
      const helpText = Object.keys(COMMANDS).map(k => `• ${k}`).join('\n') + '\n• clear';
      newHistory.push({ type: 'response', text: `Available commands:\n${helpText}` });
    } else if (COMMANDS[cleanCmd]) {
      newHistory.push({ type: 'response', text: COMMANDS[cleanCmd] });
    } else if (cleanCmd !== '') {
      newHistory.push({ type: 'error', text: `Command not found: ${cleanCmd}. Type "help".` });
    }
    setHistory(newHistory);
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSequencePlaying) {
      handleCommand(input);
      setInput('');
    }
  };
  return (
    <div
      className="w-full max-w-md border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] p-4 font-mono text-xs md:text-sm relative overflow-hidden h-80 flex flex-col z-20 cursor-text"
      onClick={() => !isSequencePlaying && inputRef.current?.focus()}
    >
      <div className="flex items-center justify-between border-b-2 border-black dark:border-white pb-2 mb-2 bg-gray-50 dark:bg-zinc-800 -mx-4 -mt-4 px-4 py-2 select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-monero-orange" />
          <span className="font-bold uppercase tracking-widest text-xs dark:text-white">VISITOR@SHELL:~</span>
        </div>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-full border border-black dark:border-white bg-transparent"></div>
          <div className="w-3 h-3 rounded-full border border-black dark:border-white bg-transparent"></div>
        </div>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto scrollbar-hide font-bold leading-relaxed whitespace-pre-wrap"
      >
        {history.map((line, i) => (
          <div key={i} className={`mb-1 ${line.type === 'command' ? 'text-black dark:text-white' :
            line.type === 'error' ? 'text-red-600' :
              line.type === 'special' ? 'text-green-600 tracking-widest' : 'text-green-700 dark:text-green-400'
            }`}>
            {line.type === 'command' && <span className="text-monero-orange mr-2">➜</span>}
            {line.text}
          </div>
        ))}
        {!isSequencePlaying && (
          <div className="flex items-center text-black dark:text-white">
            <span className="text-monero-orange mr-2">➜</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent border-none outline-none font-bold dark:text-white"
              autoFocus
            />
          </div>
        )}
      </div>
      <div className="absolute bottom-2 right-2 opacity-10 pointer-events-none">
        <svg width="60" height="60" viewBox="0 0 100 100">
          <path d="M50 0 L100 25 L100 75 L50 100 L0 75 L0 25 Z" fill="none" stroke="currentColor" className="text-black dark:text-white" strokeWidth="2" />
        </svg>
      </div>
    </div>
  );
};