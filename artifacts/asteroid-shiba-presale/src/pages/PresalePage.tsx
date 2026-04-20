import React, { useState, useEffect } from 'react';
import { Copy, Check, Menu, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const CONTRACT_ADDRESS = '0xf280B16EF293D8e534e370794ef26bF312694126';
const SHORT_ADDRESS = '0xf280...4126';
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

function PresaleWidget({ ethAmount, setEthAmount, tokenAmount, raised, goal, pct, copy, copied }: {
  ethAmount: string; setEthAmount: (v: string) => void; tokenAmount: string;
  raised: number; goal: number; pct: number; copy: () => void; copied: boolean;
}) {
  return (
    <div className="bg-[#0b0f1c] border border-white/[0.08] rounded-2xl overflow-hidden w-full">
      <div className="h-0.5 bg-gradient-to-r from-[#1a9bfc] via-purple-500 to-[#1a9bfc]" />
      <div className="p-5 sm:p-6 space-y-5">
        <div>
          <p className="text-[10px] text-white/35 uppercase tracking-widest mb-3">Presale Ends In</p>
          <CountdownTimer />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-white/45">Raised: <span className="text-white font-semibold">${raised.toLocaleString()}</span></span>
            <span className="text-white/30">Goal: ${goal.toLocaleString()}</span>
          </div>
          <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#1a9bfc] to-purple-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-right text-[11px] text-white/25">{pct}% filled</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] text-white/35 uppercase tracking-wider">You Pay (ETH)</label>
          <div className="relative">
            <input
              type="number"
              value={ethAmount}
              onChange={e => setEthAmount(e.target.value)}
              min="0"
              className="w-full bg-white/[0.04] border border-white/10 focus:border-[#1a9bfc]/60 focus:outline-none rounded-xl py-3.5 px-4 pr-14 text-base font-mono text-white transition-colors"
              placeholder="0"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 text-xs font-bold">ETH</span>
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

        <button className="w-full py-4 rounded-xl bg-[#1a9bfc] hover:bg-[#2aaeff] text-white font-bold text-sm transition-colors shadow-[0_0_30px_rgba(26,155,252,0.2)]">
          Buy $ASTEROID
        </button>

        <div className="space-y-1">
          <p className="text-center text-[10px] text-white/20">Connect your Ethereum wallet to participate.</p>
          <button
            onClick={copy}
            className="group w-full flex items-center justify-between gap-2 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-xl px-3 py-2 transition-all"
          >
            <span className="font-mono text-[10px] text-white/35 group-hover:text-white/55 truncate">{CONTRACT_ADDRESS}</span>
            {copied ? <Check className="w-3 h-3 text-green-400 shrink-0" /> : <Copy className="w-3 h-3 text-white/20 shrink-0" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PresalePage() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ethAmount, setEthAmount] = useState('0.5');
  const ethPrice = 3200;
  const tokenPrice = 0.0000008;
  const tokenAmount = Math.floor((parseFloat(ethAmount || '0') * ethPrice) / tokenPrice).toLocaleString();
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

  const widgetProps = { ethAmount, setEthAmount, tokenAmount, raised, goal, pct, copy, copied };

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
            <a href="#presale" className="text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg bg-[#1a9bfc] hover:bg-[#2aaeff] text-white transition-colors">
              Buy $ASTEROID
            </a>
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg border border-white/10 text-white/60 hover:text-white">
              {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/[0.06] bg-[#080c14]/95 backdrop-blur-xl">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
                className="block px-4 py-3.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.03] border-b border-white/[0.04] transition-colors">
                {l.label}
              </a>
            ))}
          </div>
        )}
      </nav>

      {/* ── HERO (mobile: title only over image) ── */}
      <section id="presale">
        {/* Title over banner — mobile shows this, desktop shows full 2-col version */}
        <div className="relative lg:hidden pt-14">
          <div className="absolute inset-0">
            <img src="/banner.jpg" alt="Asteroid in space" className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-[#080c14]/60" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#080c14]/30 to-[#080c14]" />
          </div>
          <div className="relative z-10 px-4 py-12 text-center space-y-4">
            <h1 className="text-6xl font-extrabold tracking-tight leading-none">ASTEROID</h1>
            <p className="text-base text-white/60 font-light">The Only Shiba Who Went to Space</p>
            <p className="text-sm text-white/45 max-w-xs mx-auto leading-relaxed">
              The world's first Shiba Inu plush to orbit Earth aboard SpaceX's Polaris Dawn — born from real history, charity, and the human spirit.
            </p>
            <div className="flex justify-center gap-6 pt-1">
              {[
                { label: 'Token Price', value: '$0.0000008' },
                { label: 'Network', value: 'Ethereum' },
                { label: 'Supply', value: '420.69B' },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
                  <p className="font-bold text-white text-xs">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: presale widget below the banner (on solid dark bg) */}
        <div className="lg:hidden bg-[#080c14] px-4 pb-12">
          <PresaleWidget {...widgetProps} />
        </div>

        {/* Desktop: full 2-col with background */}
        <div className="hidden lg:block relative pt-16">
          <div className="absolute inset-0">
            <img src="/banner.jpg" alt="Asteroid in space" className="w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-[#080c14]/55" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#080c14]/30 via-transparent to-[#080c14]" />
          </div>
          <div className="relative z-10 max-w-6xl mx-auto px-6 py-20 grid grid-cols-2 gap-16 items-center">
            <div className="space-y-5">
              <h1 className="text-7xl font-extrabold tracking-tight leading-none">ASTEROID</h1>
              <p className="text-xl text-white/60 font-light">The Only Shiba Who Went to Space</p>
              <p className="text-sm text-white/45 max-w-sm leading-relaxed">
                The world's first Shiba Inu plush to orbit Earth aboard SpaceX's Polaris Dawn — now a token born from real history, charity, and the human spirit.
              </p>
              <div className="flex gap-6">
                {[
                  { label: 'Token Price', value: '$0.0000008' },
                  { label: 'Network', value: 'Ethereum' },
                  { label: 'Total Supply', value: '420.69B' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-[10px] text-white/30 uppercase tracking-wider">{label}</p>
                    <p className="font-bold text-white text-sm">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="max-w-md">
              <PresaleWidget {...widgetProps} />
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
          <div className="space-y-5">
            <p className="text-white/60 leading-relaxed text-sm sm:text-base">
              Liv Perrotto, a 15-year-old pediatric cancer survivor and patient at St. Jude Children's Research Hospital, was invited by SpaceX to design the zero-gravity indicator for the Polaris Dawn mission.
            </p>
            <p className="text-white/60 leading-relaxed text-sm sm:text-base">
              She created "Asteroid" — a Shiba Inu plush inspired by Elon Musk's own dog, Floki. On September 10, 2024, Asteroid floated weightlessly aboard the SpaceX Crew Dragon "Resilience," becoming the world's first Shiba in space.
            </p>
            <p className="text-white/60 leading-relaxed text-sm sm:text-base">
              When Elon Musk replied "Will answer shortly" to a post about the token, it surged{' '}
              <span className="text-white font-semibold">68,000%</span>. The motto?{' '}
              <span className="text-white italic">"If Asteroid can go to space, so can you."</span>
            </p>
            <div className="flex items-center gap-3 pt-1">
              <div className="w-7 h-7 rounded-full bg-[#1a9bfc]/10 border border-[#1a9bfc]/30 flex items-center justify-center shrink-0">
                <span className="text-[#1a9bfc] text-xs">♥</span>
              </div>
              <span className="text-xs text-white/40">10% of presale proceeds go to St. Jude Children's Research Hospital</span>
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/[0.06] w-full aspect-video">
              <iframe
                src="https://www.youtube.com/embed/8UimR3AaT2s?rel=0&modestbranding=1&color=white"
                title="Asteroid Shiba — Polaris Dawn"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>

          {/* Photo grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Featured: Liv holding Asteroid plush */}
            <img
              src="/liv2.jpg"
              alt="Liv Perrotto holding Asteroid plush"
              className="col-span-2 w-full h-64 sm:h-80 object-cover object-center rounded-2xl"
            />
            {/* Plush at airport */}
            <img
              src="/plush-airport.png"
              alt="Asteroid plush with Inspiration4 mission bag at the airport"
              className="w-full h-44 sm:h-56 object-cover object-center rounded-xl"
            />
            {/* Liv's original design letter */}
            <img
              src="/liv1.jpg"
              alt="Liv Perrotto's original design notes for Asteroid"
              className="w-full h-44 sm:h-56 object-cover object-center rounded-xl"
            />
            {/* Full image of Liv holding the framed drawing */}
            <img
              src="/liv-design.png"
              alt="Liv Perrotto holding her original hand-drawn Asteroid design with Polaris Dawn authentication"
              className="col-span-2 w-full object-contain rounded-2xl bg-[#0b0f1c]"
            />
          </div>
        </div>
      </section>

      {/* ── TOKENOMICS + ROADMAP + PRESALE (combined) ── */}
      <section id="tokenomics" className="bg-white/[0.02] border-y border-white/[0.06] py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          <div className="text-center mb-10 space-y-1">
            <p className="text-xs text-[#1a9bfc] uppercase tracking-widest font-semibold">Token Info & Presale</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold">Token Details</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">

            {/* LEFT — Tokenomics + Charity */}
            <div className="space-y-6" id="charity">

              {/* Tokenomics boxes */}
              <div>
                <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Tokenomics</p>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { pct: '40%', label: 'Presale', color: '#1a9bfc' },
                    { pct: '30%', label: 'Liquidity', color: '#a855f7' },
                    { pct: '20%', label: 'Marketing', color: '#22c55e' },
                    { pct: '10%', label: 'Charity (St. Jude)', color: '#f97316' },
                  ].map(({ pct, label, color }) => (
                    <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-center">
                      <div className="text-3xl font-extrabold mb-1" style={{ color }}>{pct}</div>
                      <div className="text-xs text-white/50">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key stats */}
              <div className="space-y-2">
                {[
                  { label: 'Total Supply', value: '420,690,000,000' },
                  { label: 'Network', value: 'Ethereum Mainnet' },
                  { label: 'Token Type', value: 'Strategy Token' },
                  { label: 'Liquidity Lock', value: '1 Year' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 flex justify-between items-center">
                    <span className="text-white/45 text-xs sm:text-sm">{label}</span>
                    <span className="font-bold text-white text-xs sm:text-sm">{value}</span>
                  </div>
                ))}
                {/* Contract */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3">
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Contract Address (Ethereum)</p>
                  <div className="flex items-center justify-between gap-3">
                    <code className="font-mono text-[11px] text-white/55 break-all flex-1">
                      <span className="hidden sm:inline">{CONTRACT_ADDRESS}</span>
                      <span className="sm:hidden">{SHORT_ADDRESS}</span>
                    </code>
                    <button onClick={copy} className="flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 text-xs text-white/50 hover:text-white transition-all">
                      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Charity */}
              <div className="bg-[#f97316]/[0.05] border border-[#f97316]/20 rounded-2xl p-5 space-y-2">
                <p className="text-[10px] text-[#f97316] uppercase tracking-widest font-semibold">Charity</p>
                <p className="text-sm text-white/60 leading-relaxed">
                  10% of all presale proceeds go directly to <strong className="text-white">St. Jude Children's Research Hospital</strong> — the hospital that helped Liv.
                </p>
                <blockquote className="text-white/45 italic text-xs border-l-2 border-[#f97316]/30 pl-3">
                  "If Asteroid can go to space, so can you."
                  <span className="block text-white/25 not-italic mt-0.5">— Liv Perrotto, age 15</span>
                </blockquote>
                <a href="https://www.stjude.org/" target="_blank" rel="noreferrer" className="inline-block text-[#f97316]/70 hover:text-[#f97316] text-xs transition-colors">
                  Learn about St. Jude →
                </a>
              </div>

            </div>

            {/* RIGHT — Presale widget (sticky on desktop) */}
            <div className="lg:sticky lg:top-20">
              <PresaleWidget {...widgetProps} />
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.06] bg-[#05080f]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <span className="font-bold text-xs tracking-[0.15em] text-white/50 uppercase">Asteroid</span>
          <p className="text-white/20 text-xs text-center max-w-xs leading-relaxed order-3 sm:order-2">
            $ASTEROID is a strategy token. Not financial advice. Only invest what you can afford to lose.
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
