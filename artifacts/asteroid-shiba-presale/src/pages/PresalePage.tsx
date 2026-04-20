import React, { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CONTRACT_ADDRESS = 'F1ppSHedBsGGwEKH7BJVgoqr4xkQHswtsGGLpgM7bCP2';
const PRESALE_END = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60 * 5).getTime();

function CountdownTimer() {
  const calc = () => {
    const d = Math.max(0, PRESALE_END - Date.now());
    return {
      days: Math.floor(d / 86400000),
      hours: Math.floor((d % 86400000) / 3600000),
      minutes: Math.floor((d % 3600000) / 60000),
      seconds: Math.floor((d % 60000) / 1000),
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex gap-2 sm:gap-4">
      {[['days', t.days], ['hrs', t.hours], ['min', t.minutes], ['sec', t.seconds]].map(([label, val]) => (
        <div key={label as string} className="flex flex-col items-center">
          <div className="w-14 h-14 sm:w-18 sm:h-18 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center">
            <span className="text-2xl sm:text-3xl font-bold font-mono text-white tabular-nums">
              {String(val).padStart(2, '0')}
            </span>
          </div>
          <span className="text-[10px] text-white/40 uppercase tracking-widest mt-1.5">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function PresalePage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [solAmount, setSolAmount] = useState('1');
  const solPrice = 145;
  const tokenPrice = 0.0000008;
  const tokenAmount = Math.floor((parseFloat(solAmount || '0') * solPrice) / tokenPrice).toLocaleString();
  const raised = 842000;
  const goal = 2000000;
  const pct = Math.round((raised / goal) * 100);

  const copy = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Contract address copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#080c14]/70 backdrop-blur-lg border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="ASTEROID" className="w-9 h-9 rounded-full object-cover" />
            <span className="font-bold text-base tracking-widest text-white uppercase">Asteroid</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60 font-medium">
            <a href="#story" className="hover:text-white transition-colors">The Story</a>
            <a href="#presale" className="hover:text-white transition-colors">Presale</a>
            <a href="#tokenomics" className="hover:text-white transition-colors">Tokenomics</a>
            <a href="#charity" className="hover:text-white transition-colors">Charity</a>
          </div>
          <a
            href="https://pump.fun"
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold px-4 py-2 rounded-lg bg-[#1a9bfc] hover:bg-[#2aaeff] text-white transition-colors"
          >
            Buy on Pump.fun
          </a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center text-center overflow-hidden pt-16">
        <div className="absolute inset-0">
          <img
            src="/banner.jpg"
            alt="Asteroid in space"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#080c14]/30 via-[#080c14]/50 to-[#080c14]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080c14] via-transparent to-[#080c14]/40" />
        </div>

        <div className="relative z-10 px-4 max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 bg-[#1a9bfc]/10 border border-[#1a9bfc]/30 rounded-full px-4 py-1.5 text-[#1a9bfc] text-xs font-semibold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1a9bfc] animate-pulse" />
            Now Live on Solana · Pump.fun
          </div>

          <div className="flex justify-center">
            <img src="/logo.jpg" alt="Asteroid" className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white/10 shadow-[0_0_60px_rgba(26,155,252,0.3)]" />
          </div>

          <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold tracking-tight leading-none">
            ASTEROID
          </h1>
          <p className="text-lg sm:text-2xl text-white/60 font-light tracking-wide">
            The Only Shiba Who Went to Space
          </p>
          <p className="text-sm sm:text-base text-white/50 max-w-xl mx-auto leading-relaxed">
            The world's first Shiba Inu plush to orbit Earth aboard SpaceX's Polaris Dawn mission — now a community-driven token born from real cosmic history, charity, and the human spirit.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <a
              href="https://pump.fun"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#1a9bfc] hover:bg-[#2aaeff] text-white font-bold text-base transition-colors"
            >
              🚀 Buy on Pump.fun
            </a>
            <a
              href="#story"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-white/15 text-white/80 hover:text-white hover:border-white/30 font-medium text-base transition-colors"
            >
              The Story ↓
            </a>
          </div>

          <div className="pt-2">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-2">Contract Address (Solana)</p>
            <button
              onClick={copy}
              className="group flex items-center gap-2 mx-auto bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-xl px-4 py-2.5 transition-all"
            >
              <span className="font-mono text-xs text-white/60 group-hover:text-white/80 transition-colors break-all">
                {CONTRACT_ADDRESS}
              </span>
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 shrink-0 transition-colors" />
              )}
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/20 animate-bounce">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── STORY ── */}
      <section id="story" className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">The Real Story</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight">
              A Girl, A Dream,<br />And Elon's Dog
            </h2>
            <p className="text-white/60 leading-relaxed">
              Liv Perrotto, a 15-year-old pediatric cancer survivor and patient at St. Jude Children's Research Hospital, was invited by SpaceX to design the zero-gravity indicator for the Polaris Dawn mission.
            </p>
            <p className="text-white/60 leading-relaxed">
              She created "Asteroid" — a Shiba Inu plush inspired by Elon Musk's own dog, Floki. On September 10, 2024, Asteroid floated weightlessly aboard the SpaceX Crew Dragon "Resilience," becoming the world's first Shiba in space.
            </p>
            <p className="text-white/60 leading-relaxed">
              When Elon Musk replied "Will answer shortly" to a post about the token, it surged 68,000%. The motto? <span className="text-white italic">"If Asteroid can go to space, so can you."</span>
            </p>
            <div className="flex items-center gap-3 pt-2">
              <div className="w-8 h-8 rounded-full bg-[#1a9bfc]/10 border border-[#1a9bfc]/30 flex items-center justify-center">
                <span className="text-[#1a9bfc] text-xs">♥</span>
              </div>
              <span className="text-sm text-white/50">Proceeds support St. Jude Children's Research Hospital</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <img
              src="/liv1.jpg"
              alt="Liv Perrotto with Asteroid in SpaceX Dragon"
              className="col-span-2 w-full h-56 sm:h-72 object-cover rounded-2xl"
            />
            <img
              src="/liv2.jpg"
              alt="Liv Perrotto holding Asteroid plush"
              className="w-full h-40 object-cover rounded-xl"
            />
            <div className="w-full h-40 rounded-xl bg-[#1a9bfc]/5 border border-[#1a9bfc]/20 flex flex-col items-center justify-center gap-2 text-center px-4">
              <p className="text-3xl font-bold text-[#1a9bfc]">68,000%</p>
              <p className="text-xs text-white/50">rally after Elon Musk's reply</p>
            </div>
          </div>
        </div>

        {/* Video */}
        <div className="mt-16 rounded-2xl overflow-hidden border border-white/[0.06] aspect-video max-w-3xl mx-auto">
          <iframe
            src="https://www.youtube.com/embed/8UimR3AaT2s?rel=0&modestbranding=1&color=white"
            title="Asteroid Shiba — Polaris Dawn"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </section>

      {/* ── PRESALE ── */}
      <section id="presale" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 space-y-3">
            <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">Phase 1 — Live Now</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold">Presale</h2>
            <p className="text-white/50 max-w-md mx-auto">Secure your allocation before the presale closes. Limited supply at launch price.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            {/* Left — timer + stats */}
            <div className="space-y-8">
              <div>
                <p className="text-white/40 text-xs uppercase tracking-widest mb-4">Presale Ends In</p>
                <CountdownTimer />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Raised</span>
                  <span className="font-semibold">${raised.toLocaleString()} <span className="text-white/30">/ ${goal.toLocaleString()}</span></span>
                </div>
                <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1a9bfc] rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-right text-xs text-white/30">{pct}% filled</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Token Price', value: '$0.0000008' },
                  { label: 'Total Supply', value: '420.69B' },
                  { label: 'Network', value: 'Solana' },
                  { label: 'Listed On', value: 'Pump.fun' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
                    <p className="text-[11px] text-white/40 uppercase tracking-wider mb-1">{label}</p>
                    <p className="font-bold text-white text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — buy widget */}
            <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-5">
              <h3 className="font-bold text-lg">Buy $ASTEROID</h3>

              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase tracking-wider">You Pay (SOL)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={solAmount}
                    onChange={e => setSolAmount(e.target.value)}
                    min="0"
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-[#1a9bfc]/50 focus:outline-none rounded-xl py-3.5 px-4 pr-16 text-lg font-mono text-white transition-colors"
                    placeholder="0"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm font-bold">SOL</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-white/20">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-xs">≈</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase tracking-wider">You Receive</label>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl py-3.5 px-4">
                  <span className="text-lg font-mono font-bold text-[#1a9bfc]">{tokenAmount}</span>
                  <span className="text-white/40 text-sm ml-2">$ASTEROID</span>
                </div>
              </div>

              <a
                href="https://pump.fun"
                target="_blank"
                rel="noreferrer"
                className="block w-full text-center py-4 rounded-xl bg-[#1a9bfc] hover:bg-[#2aaeff] text-white font-bold text-base transition-colors"
              >
                🚀 Buy on Pump.fun
              </a>

              <p className="text-center text-[11px] text-white/25 leading-relaxed">
                Connect your Solana wallet on Pump.fun to complete the purchase.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOKENOMICS ── */}
      <section id="tokenomics" className="max-w-6xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-14 space-y-3">
          <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">On-chain</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold">Tokenomics</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { pct: '40%', label: 'Presale', color: '#1a9bfc' },
            { pct: '30%', label: 'Liquidity', color: '#a855f7' },
            { pct: '20%', label: 'Marketing', color: '#22c55e' },
            { pct: '10%', label: 'Charity (St. Jude)', color: '#f97316' },
          ].map(({ pct, label, color }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 text-center hover:border-white/10 transition-colors">
              <div className="text-5xl font-extrabold mb-2" style={{ color }}>{pct}</div>
              <div className="text-sm text-white/60 font-medium">{label}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Supply', value: '420,690,000,000' },
            { label: 'Buy / Sell Tax', value: '0% / 0%' },
            { label: 'Liquidity Lock', value: '1 Year' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 flex justify-between items-center">
              <span className="text-white/50 text-sm">{label}</span>
              <span className="font-bold text-white text-sm">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs text-white/30 uppercase tracking-wider mb-1">Contract Address (Solana)</p>
            <code className="font-mono text-sm text-white/70 break-all">{CONTRACT_ADDRESS}</code>
          </div>
          <button
            onClick={copy}
            className="flex items-center gap-2 shrink-0 px-4 py-2 rounded-lg border border-white/10 hover:border-white/20 text-sm text-white/60 hover:text-white transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </section>

      {/* ── CHARITY ── */}
      <section id="charity" className="bg-white/[0.02] border-y border-white/[0.06] py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-6">
          <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">Purpose</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold">Built for More<br />Than Profit</h2>
          <p className="text-white/50 leading-relaxed text-lg max-w-xl mx-auto">
            10% of all presale proceeds go directly to <strong className="text-white">St. Jude Children's Research Hospital</strong> — the hospital that helped Liv, the girl who put Asteroid in space.
          </p>
          <blockquote className="border-l-2 border-[#1a9bfc]/50 pl-6 text-left text-white/60 italic text-base leading-relaxed max-w-xl mx-auto">
            "If Asteroid can go to space, so can you."<br />
            <span className="text-white/30 not-italic text-sm">— Liv Perrotto, age 15, cancer survivor & Asteroid's creator</span>
          </blockquote>
          <a
            href="https://www.stjude.org/"
            target="_blank"
            rel="noreferrer"
            className="inline-block px-6 py-3 rounded-xl border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-sm font-medium transition-colors"
          >
            Learn about St. Jude →
          </a>
        </div>
      </section>

      {/* ── ROADMAP ── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-24">
        <div className="text-center mb-14 space-y-3">
          <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">What's Next</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold">Roadmap</h2>
        </div>

        <div className="space-y-0">
          {[
            {
              phase: 'Phase 1',
              title: 'Launchpad',
              active: true,
              items: ['Website & community launch', 'Presale goes live', 'Pump.fun listing', 'First charity donation to St. Jude'],
            },
            {
              phase: 'Phase 2',
              title: 'Orbit',
              active: false,
              items: ['CEX applications (Bybit, Gate, KuCoin)', 'CoinMarketCap & CoinGecko listings', '10,000 holders milestone', 'Community treasury vote'],
            },
            {
              phase: 'Phase 3',
              title: 'Deep Space',
              active: false,
              items: ['Tier-1 exchange listing', 'ASTEROID merch store (physical plush)', '50,000 holders', 'Major charity event with St. Jude'],
            },
          ].map((step, i, arr) => (
            <div key={i} className="flex gap-5">
              <div className="flex flex-col items-center">
                <div className={`w-4 h-4 rounded-full shrink-0 mt-1 border-2 ${step.active ? 'bg-[#1a9bfc] border-[#1a9bfc] shadow-[0_0_16px_rgba(26,155,252,0.6)]' : 'border-white/20 bg-transparent'}`} />
                {i < arr.length - 1 && <div className="w-px flex-1 bg-white/[0.06] my-1" />}
              </div>
              <div className="pb-12 min-h-[100px]">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs text-white/30 uppercase tracking-widest">{step.phase}</span>
                  {step.active && (
                    <span className="text-[10px] bg-[#1a9bfc]/20 text-[#1a9bfc] border border-[#1a9bfc]/30 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">Active</span>
                  )}
                </div>
                <h3 className="text-2xl font-bold mb-4">{step.title}</h3>
                <ul className="space-y-2.5">
                  {step.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-white/50 text-sm">
                      <div className={`w-1 h-1 rounded-full shrink-0 ${step.active ? 'bg-[#1a9bfc]' : 'bg-white/20'}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <img src="/logo.jpg" alt="Asteroid" className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-white/10" />
          <h2 className="text-4xl sm:text-5xl font-extrabold">Ready to Join<br />the Mission?</h2>
          <p className="text-white/50 text-base">The presale is live. Secure your allocation before it closes.</p>
          <a
            href="https://pump.fun"
            target="_blank"
            rel="noreferrer"
            className="inline-block px-10 py-4 rounded-xl bg-[#1a9bfc] hover:bg-[#2aaeff] text-white font-bold text-lg transition-colors"
          >
            🚀 Buy $ASTEROID Now
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] bg-[#05080f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="ASTEROID" className="w-7 h-7 rounded-full object-cover" />
            <span className="font-bold text-sm tracking-widest text-white/80 uppercase">Asteroid</span>
          </div>
          <p className="text-white/25 text-xs text-center max-w-sm">
            $ASTEROID is a community meme token. Not financial advice. Crypto is volatile — only invest what you can afford to lose.
          </p>
          <div className="flex items-center gap-3">
            <a href="https://x.com" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-white/10 hover:border-white/25 flex items-center justify-center text-white/40 hover:text-white transition-all">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://t.me" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-white/10 hover:border-white/25 flex items-center justify-center text-white/40 hover:text-white transition-all">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.895-1.056-.676-1.653-1.107-2.678-1.782-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.882-.662 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.381 4.025-1.627 4.476-1.635z"/></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
