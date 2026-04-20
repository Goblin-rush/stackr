import React, { useState, useEffect } from 'react';
import { Copy, Check, Menu, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CONTRACT_ADDRESS = 'F1ppSHedBsGGwEKH7BJVgoqr4xkQHswtsGGLpgM7bCP2';
const SHORT_ADDRESS = 'F1ppSH...bCP2';
const PRESALE_END = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60 * 5).getTime();

function CountdownTimer() {
  const calc = () => {
    const d = Math.max(0, PRESALE_END - Date.now());
    return {
      days: Math.floor(d / 86400000),
      hrs: Math.floor((d % 86400000) / 3600000),
      min: Math.floor((d % 3600000) / 60000),
      sec: Math.floor((d % 60000) / 1000),
    };
  };
  const [t, setT] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex gap-2">
      {(Object.entries(t) as [string, number][]).map(([label, val]) => (
        <div key={label} className="flex-1 flex flex-col items-center">
          <div className="w-full aspect-square max-w-[64px] bg-[#080c14] border border-white/10 rounded-xl flex items-center justify-center">
            <span className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
              {String(val).padStart(2, '0')}
            </span>
          </div>
          <span className="text-[9px] text-white/35 uppercase tracking-widest mt-1.5">{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function PresalePage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    toast({ title: 'Copied!', description: 'Contract address copied.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const navLinks = [
    { href: '#presale', label: 'Presale' },
    { href: '#story', label: 'The Story' },
    { href: '#tokenomics', label: 'Tokenomics' },
    { href: '#charity', label: 'Charity' },
  ];

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#080c14]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center justify-between">
          <a href="#" className="flex items-center gap-2">
            <img src="/logo.jpg" alt="ASTEROID" className="w-8 h-8 rounded-full object-cover" />
            <span className="font-bold text-sm tracking-[0.15em] text-white uppercase">Asteroid</span>
          </a>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/55 font-medium">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="hover:text-white transition-colors">{l.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a
              href="#presale"
              className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg bg-[#1a9bfc] hover:bg-[#2aaeff] text-white transition-colors"
            >
              Buy $ASTEROID
            </a>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white"
            >
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#080c14]/95 backdrop-blur-xl">
            {navLinks.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-3.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.03] border-b border-white/[0.04] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO + PRESALE ── */}
      <section id="presale" className="relative overflow-hidden pt-14 sm:pt-16">
        {/* Background */}
        <div className="absolute inset-0">
          <img src="/banner.jpg" alt="Asteroid in space" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-[#080c14]/55" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#080c14]/40 via-transparent to-[#080c14]" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
          <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            {/* Left — Headline */}
            <div className="space-y-5 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-[#1a9bfc]/10 border border-[#1a9bfc]/30 rounded-full px-3.5 py-1.5 text-[#1a9bfc] text-[11px] font-semibold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1a9bfc] animate-pulse shrink-0" />
                Presale Phase 1 — Live Now
              </div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-none">
                ASTEROID
              </h1>
              <p className="text-base sm:text-xl text-white/60 font-light tracking-wide">
                The Only Shiba Who Went to Space
              </p>
              <p className="text-sm text-white/45 max-w-sm mx-auto lg:mx-0 leading-relaxed">
                The world's first Shiba Inu plush to orbit Earth aboard SpaceX's Polaris Dawn — now a token born from real history, charity, and the human spirit.
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-2">
                {[
                  { label: 'Token Price', value: '$0.0000008' },
                  { label: 'Total Supply', value: '420.69B' },
                  { label: 'Network', value: 'Solana' },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center lg:text-left">
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
                    <p className="font-bold text-white text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {/* Contract */}
              <div className="w-full max-w-sm mx-auto lg:mx-0">
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-1.5">Contract Address (Solana)</p>
                <button
                  onClick={copy}
                  className="group w-full flex items-center justify-between gap-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/15 rounded-xl px-3.5 py-2.5 transition-all"
                >
                  <span className="font-mono text-xs text-white/50 group-hover:text-white/70 transition-colors truncate">
                    <span className="hidden sm:inline">{CONTRACT_ADDRESS}</span>
                    <span className="sm:hidden">{SHORT_ADDRESS}</span>
                  </span>
                  {copied
                    ? <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    : <Copy className="w-3.5 h-3.5 text-white/30 group-hover:text-white/55 shrink-0 transition-colors" />
                  }
                </button>
              </div>
            </div>

            {/* Right — Presale Widget */}
            <div className="w-full max-w-md mx-auto lg:mx-0">
              <div className="bg-[#0b0f1c]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
                <div className="h-0.5 bg-gradient-to-r from-[#1a9bfc] via-purple-500 to-[#1a9bfc]" />
                <div className="p-5 sm:p-6 space-y-5">

                  {/* Countdown */}
                  <div>
                    <p className="text-[10px] text-white/35 uppercase tracking-widest mb-3">Presale Ends In</p>
                    <CountdownTimer />
                  </div>

                  {/* Progress */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/45">Raised: <span className="text-white font-semibold">${raised.toLocaleString()}</span></span>
                      <span className="text-white/30">Goal: ${goal.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-[#1a9bfc] to-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-right text-[11px] text-white/25">{pct}% filled</p>
                  </div>

                  {/* Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/35 uppercase tracking-wider">You Pay (SOL)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={solAmount}
                        onChange={e => setSolAmount(e.target.value)}
                        min="0"
                        className="w-full bg-white/[0.04] border border-white/10 focus:border-[#1a9bfc]/60 focus:outline-none rounded-xl py-3.5 px-4 pr-14 text-base font-mono text-white transition-colors"
                        placeholder="0"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 text-xs font-bold">SOL</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-white/15">
                    <div className="flex-1 h-px bg-white/[0.06]" />
                    <span className="text-xs">≈</span>
                    <div className="flex-1 h-px bg-white/[0.06]" />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-white/35 uppercase tracking-wider">You Receive</label>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl py-3.5 px-4 flex items-center justify-between">
                      <span className="text-base font-mono font-bold text-[#1a9bfc]">{tokenAmount}</span>
                      <span className="text-white/35 text-xs font-semibold">$ASTEROID</span>
                    </div>
                  </div>

                  <button className="w-full py-4 rounded-xl bg-[#1a9bfc] hover:bg-[#2aaeff] text-white font-bold text-sm transition-colors shadow-[0_0_30px_rgba(26,155,252,0.25)]">
                    Buy $ASTEROID
                  </button>

                  <p className="text-center text-[10px] text-white/20">
                    Connect your Solana wallet to participate in the presale.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STORY ── */}
      <section id="story" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="text-center mb-10 sm:mb-14 space-y-2">
          <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">The Real Story</p>
          <h2 className="text-3xl sm:text-5xl font-extrabold">A Girl, A Dream,<br />And Elon's Dog</h2>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Text */}
          <div className="space-y-5">
            <p className="text-white/60 leading-relaxed text-sm sm:text-base">
              Liv Perrotto, a 15-year-old pediatric cancer survivor and patient at St. Jude Children's Research Hospital, was invited by SpaceX to design the zero-gravity indicator for the Polaris Dawn mission.
            </p>
            <p className="text-white/60 leading-relaxed text-sm sm:text-base">
              She created "Asteroid" — a Shiba Inu plush inspired by Elon Musk's own dog, Floki. On September 10, 2024, Asteroid floated weightlessly aboard the SpaceX Crew Dragon "Resilience," becoming the world's first Shiba in space.
            </p>
            <p className="text-white/60 leading-relaxed text-sm sm:text-base">
              When Elon Musk replied "Will answer shortly" to a post about the token, it surged <span className="text-white font-semibold">68,000%</span>. The motto?{' '}
              <span className="text-white italic">"If Asteroid can go to space, so can you."</span>
            </p>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-7 h-7 rounded-full bg-[#1a9bfc]/10 border border-[#1a9bfc]/30 flex items-center justify-center shrink-0">
                <span className="text-[#1a9bfc] text-xs">♥</span>
              </div>
              <span className="text-xs text-white/40">10% of presale proceeds go to St. Jude Children's Research Hospital</span>
            </div>

            {/* YouTube */}
            <div className="rounded-2xl overflow-hidden border border-white/[0.06] w-full aspect-video mt-4">
              <iframe
                src="https://www.youtube.com/embed/8UimR3AaT2s?rel=0&modestbranding=1&color=white"
                title="Asteroid Shiba — Polaris Dawn"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          {/* Photo grid — all 4 real images */}
          <div className="grid grid-cols-2 gap-2.5">
            <img
              src="/liv1.jpg"
              alt="Liv Perrotto with Asteroid aboard SpaceX Dragon"
              className="col-span-2 w-full h-56 sm:h-72 object-cover rounded-2xl"
            />
            <img
              src="/plush-airport.png"
              alt="Asteroid plush with Inspiration4 mission bag"
              className="w-full h-40 sm:h-52 object-cover rounded-xl"
            />
            <img
              src="/liv2.jpg"
              alt="Liv Perrotto holding Asteroid plush"
              className="w-full h-40 sm:h-52 object-cover rounded-xl"
            />
            <img
              src="/liv-design.png"
              alt="Liv Perrotto's original hand-drawn Asteroid design with Polaris Dawn authentication"
              className="col-span-2 w-full h-56 sm:h-72 object-cover object-top rounded-2xl"
            />
          </div>
        </div>
      </section>

      {/* ── TOKENOMICS ── */}
      <section id="tokenomics" className="bg-white/[0.02] border-y border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14 space-y-2">
            <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">On-chain</p>
            <h2 className="text-3xl sm:text-5xl font-extrabold">Tokenomics</h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { pct: '40%', label: 'Presale', color: '#1a9bfc' },
              { pct: '30%', label: 'Liquidity', color: '#a855f7' },
              { pct: '20%', label: 'Marketing', color: '#22c55e' },
              { pct: '10%', label: 'Charity (St. Jude)', color: '#f97316' },
            ].map(({ pct, label, color }) => (
              <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 sm:p-6 text-center hover:border-white/10 transition-colors">
                <div className="text-3xl sm:text-5xl font-extrabold mb-1.5" style={{ color }}>{pct}</div>
                <div className="text-xs sm:text-sm text-white/55 font-medium">{label}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { label: 'Total Supply', value: '420,690,000,000' },
              { label: 'Buy / Sell Tax', value: '0% / 0%' },
              { label: 'Liquidity Lock', value: '1 Year' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex justify-between items-center">
                <span className="text-white/45 text-xs sm:text-sm">{label}</span>
                <span className="font-bold text-white text-xs sm:text-sm">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 sm:p-5">
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Contract Address (Solana)</p>
            <div className="flex items-center justify-between gap-3">
              <code className="font-mono text-xs text-white/60 break-all flex-1 leading-relaxed">
                <span className="hidden sm:inline">{CONTRACT_ADDRESS}</span>
                <span className="sm:hidden">{SHORT_ADDRESS}</span>
              </code>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-xs text-white/50 hover:text-white transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── CHARITY ── */}
      <section id="charity" className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-5 sm:space-y-6">
        <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">Purpose</p>
        <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight">
          Built for More<br />Than Profit
        </h2>
        <p className="text-white/50 leading-relaxed text-sm sm:text-base">
          10% of all presale proceeds go directly to{' '}
          <strong className="text-white">St. Jude Children's Research Hospital</strong> — the hospital that helped Liv, the girl who sent Asteroid to space.
        </p>
        <blockquote className="border-l-2 border-[#1a9bfc]/40 pl-4 sm:pl-6 text-left text-white/55 italic text-sm sm:text-base leading-relaxed max-w-sm mx-auto">
          "If Asteroid can go to space, so can you."
          <span className="block text-white/25 not-italic text-xs mt-1.5">— Liv Perrotto, age 15, cancer survivor & Asteroid's creator</span>
        </blockquote>
        <a
          href="https://www.stjude.org/"
          target="_blank"
          rel="noreferrer"
          className="inline-block px-5 py-2.5 rounded-xl border border-white/12 text-white/60 hover:text-white hover:border-white/25 text-sm font-medium transition-colors"
        >
          Learn about St. Jude →
        </a>
      </section>

      {/* ── ROADMAP ── */}
      <section className="bg-white/[0.02] border-t border-white/[0.06] py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14 space-y-2">
            <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">What's Next</p>
            <h2 className="text-3xl sm:text-5xl font-extrabold">Roadmap</h2>
          </div>

          <div className="space-y-0">
            {[
              {
                phase: 'Phase 1', title: 'Launchpad', active: true,
                items: ['Website & community launch', 'Presale goes live', 'First charity donation to St. Jude', 'DEX listing'],
              },
              {
                phase: 'Phase 2', title: 'Orbit', active: false,
                items: ['CEX applications (Bybit, Gate, KuCoin)', 'CoinMarketCap & CoinGecko listings', '10,000 holders milestone', 'Community treasury vote'],
              },
              {
                phase: 'Phase 3', title: 'Deep Space', active: false,
                items: ['Tier-1 exchange listing', 'ASTEROID merch store (physical plush)', '50,000 holders', 'Major charity event with St. Jude'],
              },
            ].map((step, i, arr) => (
              <div key={i} className="flex gap-4 sm:gap-5">
                <div className="flex flex-col items-center">
                  <div className={`w-3.5 h-3.5 rounded-full shrink-0 mt-[5px] border-2 ${step.active ? 'bg-[#1a9bfc] border-[#1a9bfc] shadow-[0_0_14px_rgba(26,155,252,0.7)]' : 'border-white/20 bg-transparent'}`} />
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-white/[0.06] my-1.5" />}
                </div>
                <div className="pb-10 sm:pb-12">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] text-white/25 uppercase tracking-widest">{step.phase}</span>
                    {step.active && (
                      <span className="text-[9px] bg-[#1a9bfc]/15 text-[#1a9bfc] border border-[#1a9bfc]/25 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Active</span>
                    )}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold mb-3">{step.title}</h3>
                  <ul className="space-y-2">
                    {step.items.map((item, j) => (
                      <li key={j} className="flex items-start gap-2 text-white/45 text-xs sm:text-sm leading-relaxed">
                        <div className={`w-1 h-1 rounded-full shrink-0 mt-1.5 ${step.active ? 'bg-[#1a9bfc]' : 'bg-white/15'}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24 px-4 text-center">
        <div className="max-w-xl mx-auto space-y-5">
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-tight">
            Ready to Join<br />the Mission?
          </h2>
          <p className="text-white/45 text-sm sm:text-base">The presale is live. Secure your allocation before it closes.</p>
          <a
            href="#presale"
            className="inline-block w-full sm:w-auto px-8 sm:px-10 py-4 rounded-xl bg-[#1a9bfc] hover:bg-[#2aaeff] text-white font-bold text-sm sm:text-base transition-colors"
          >
            Buy $ASTEROID Now
          </a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] bg-[#05080f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <span className="font-bold text-xs tracking-[0.15em] text-white/50 uppercase">Asteroid</span>
          <p className="text-white/20 text-xs text-center max-w-xs leading-relaxed order-3 sm:order-2">
            $ASTEROID is a community meme token. Not financial advice. Only invest what you can afford to lose.
          </p>
          <div className="flex items-center gap-2.5 order-2 sm:order-3">
            <a href="https://x.com" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-white/25 flex items-center justify-center text-white/35 hover:text-white transition-all">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="https://t.me" target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full border border-white/10 hover:border-white/25 flex items-center justify-center text-white/35 hover:text-white transition-all">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.895-1.056-.676-1.653-1.107-2.678-1.782-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.882-.662 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.381 4.025-1.627 4.476-1.635z" /></svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
