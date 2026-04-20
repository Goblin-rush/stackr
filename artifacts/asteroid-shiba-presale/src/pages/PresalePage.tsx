import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Copy, Rocket, ShieldCheck, Stars, Target, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TARGET_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60 * 5).getTime();
const PRESALE_ADDRESS = '0x8b3F5c2d1e4A7B9C0dE6F8a2b3c4d5e6f7a8b9c0';

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({ days: 7, hours: 5, minutes: 0, seconds: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = TARGET_DATE - now;
      if (distance < 0) { clearInterval(interval); return; }
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-3 justify-center my-6">
      {Object.entries(timeLeft).map(([unit, value]) => (
        <div key={unit} className="flex flex-col items-center">
          <div className="bg-[#0d0d1a] border border-orange-500/30 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.3)]">
            <span className="text-2xl sm:text-4xl font-bold font-mono text-orange-400 animate-pulse">
              {value.toString().padStart(2, '0')}
            </span>
          </div>
          <span className="text-xs sm:text-sm text-gray-400 mt-2 uppercase tracking-widest">{unit}</span>
        </div>
      ))}
    </div>
  );
}

export default function PresalePage() {
  const { toast } = useToast();
  const [amount, setAmount] = useState('1.5');
  const ethPrice = 3240.50;
  const tokenPrice = 0.000042;
  const tokenAmount = (parseFloat(amount || '0') * ethPrice / tokenPrice).toLocaleString('en-US', { maximumFractionDigits: 0 });

  const copyAddress = () => {
    navigator.clipboard.writeText(PRESALE_ADDRESS);
    toast({ title: "Address Copied", description: "Wallet address copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-[#05050f] text-white font-sans overflow-x-hidden relative">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-900/15 blur-[150px]" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-amber-900/10 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '50px 50px' }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#05050f]/80 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-8 h-8 text-orange-400" />
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-orange-400 via-amber-300 to-purple-400 bg-clip-text text-transparent">
              ASTROSHIBAS
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#about" className="hover:text-orange-400 transition-colors">Mission</a>
            <a href="#tokenomics" className="hover:text-orange-400 transition-colors">Tokenomics</a>
            <a href="#roadmap" className="hover:text-orange-400 transition-colors">Roadmap</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="hidden sm:flex border-orange-500/50 text-orange-400 hover:bg-orange-500/10 hover:text-orange-300">
              Whitepaper
            </Button>
            <Button className="bg-orange-500 hover:bg-orange-400 text-black font-bold shadow-[0_0_20px_rgba(234,88,12,0.4)]">
              Connect Wallet
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-20 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <Badge className="bg-purple-900/40 text-purple-300 border border-purple-500/30 px-4 py-1 text-sm">
              <Stars className="w-4 h-4 mr-2 inline" /> PRESALE PHASE 1 — LIVE NOW
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-[1.05]">
              THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">GOODEST</span> BOY<br />
              IN THE GALAXY
            </h1>
            <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto lg:mx-0">
              Board the AstroShiba vessel. We are leaving the atmosphere and headed straight for the asteroid belt. Secure your bags before we hit hyperdrive.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Button size="lg" className="w-full sm:w-auto bg-orange-500 hover:bg-orange-400 shadow-[0_0_30px_rgba(234,88,12,0.5)] text-black font-bold text-lg px-8 h-14">
                Buy $ASTRO <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 border-white/20 text-white hover:bg-white/5">
                Join Community
              </Button>
            </div>
            <div className="pt-4 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" /> Contract Audited
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" /> LP Locked 1 Year
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" /> 0% Tax
              </div>
            </div>
          </div>

          {/* Presale Widget */}
          <div className="flex-1 w-full max-w-md">
            <div className="rounded-2xl border border-orange-500/20 bg-[#0d0d1a]/80 backdrop-blur-xl shadow-[0_0_60px_rgba(234,88,12,0.15)] overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-purple-500" />
              <div className="p-6 space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white">Presale Ends In</h2>
                  <CountdownTimer />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Raised: <strong className="text-white">$1,240,500</strong></span>
                    <span className="text-gray-400">Goal: <strong className="text-white">$2,000,000</strong></span>
                  </div>
                  <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full w-[62%] bg-gradient-to-r from-orange-500 to-amber-400 rounded-full shadow-[0_0_10px_rgba(234,88,12,0.6)]" />
                  </div>
                  <div className="text-center text-xs text-gray-500">62% Filled — 1 $ASTRO = $0.000042</div>
                </div>

                <div className="bg-black/30 rounded-xl p-4 border border-white/10 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-300">Amount (ETH)</span>
                    <span className="text-xs text-gray-500">Balance: 2.45 ETH</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-black/40 border border-white/20 rounded-lg py-3 px-4 pr-16 text-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                      placeholder="0.0"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">ETH</span>
                  </div>
                  <div className="flex justify-between items-center text-sm py-2 border-t border-white/10">
                    <span className="text-gray-400">You Receive:</span>
                    <span className="font-bold text-orange-400 text-base">{tokenAmount} $ASTRO</span>
                  </div>
                  <Button className="w-full h-12 text-lg bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-black font-bold shadow-[0_0_20px_rgba(234,88,12,0.4)]">
                    <Wallet className="w-5 h-5 mr-2" />
                    Buy Now
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hero Image */}
        <div className="w-full h-64 md:h-96 relative my-8">
          <img
            src="/astro-hero.png"
            alt="Astro Shiba in Space"
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05050f] via-transparent to-[#05050f]" />
        </div>

        {/* Marquee */}
        <div className="w-full bg-orange-500/10 border-y border-orange-500/20 py-4 overflow-hidden">
          <div
            className="flex gap-12 items-center text-orange-400 font-mono text-sm tracking-wider uppercase whitespace-nowrap"
            style={{ animation: 'marquee 22s linear infinite', display: 'flex', width: 'max-content' }}
          >
            {[...Array(2)].map((_, i) => (
              <React.Fragment key={i}>
                <span>Next Stop: The Moon</span>
                <span className="text-white/20">|</span>
                <span>0% Buy Tax</span>
                <span className="text-white/20">|</span>
                <span>0% Sell Tax</span>
                <span className="text-white/20">|</span>
                <span>Liquidity Locked</span>
                <span className="text-white/20">|</span>
                <span>Community Driven</span>
                <span className="text-white/20">|</span>
                <span>100 Billion Supply</span>
                <span className="text-white/20">|</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Tokenomics */}
        <section id="tokenomics" className="container mx-auto px-4 py-24">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-extrabold">Asteroid <span className="text-orange-400">Nomics</span></h2>
            <p className="text-gray-400 max-w-2xl mx-auto text-lg">Fair launch, zero taxes, and a massive burn. The perfect fuel mix for a trip through the cosmos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Presale", value: "40%", desc: "Initial Fuel", gradient: "from-orange-500 to-amber-400" },
              { label: "Liquidity", value: "30%", desc: "Locked for 1 Year", gradient: "from-purple-500 to-blue-500" },
              { label: "Marketing", value: "15%", desc: "Spreading the Word", gradient: "from-green-500 to-emerald-400" },
              { label: "Burn", value: "15%", desc: "Sent to Black Hole", gradient: "from-red-500 to-rose-500" },
            ].map((item, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-6 text-center hover:border-orange-500/40 transition-colors">
                <div className={`text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r ${item.gradient}`}>
                  {item.value}
                </div>
                <div className="text-lg font-bold mt-2 text-white">{item.label}</div>
                <div className="text-sm text-gray-400 mt-1">{item.desc}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 rounded-2xl bg-purple-900/10 border border-purple-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">Smart Contract Address</h3>
              <p className="text-gray-400 text-sm">Do not send funds directly to this address.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <code className="flex-1 md:flex-none bg-black/40 px-4 py-3 rounded-lg border border-white/10 font-mono text-sm text-orange-400 break-all">
                {PRESALE_ADDRESS}
              </code>
              <button
                onClick={copyAddress}
                className="h-12 w-12 shrink-0 rounded-lg border border-orange-500/40 flex items-center justify-center hover:bg-orange-500/20 transition-colors"
              >
                <Copy className="w-5 h-5 text-orange-400" />
              </button>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="container mx-auto px-4 py-24 relative">
          <div className="absolute right-0 top-1/2 w-96 h-96 bg-purple-900/20 rounded-full blur-[150px] -z-10" />
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold">Flight <span className="text-purple-400">Plan</span></h2>
            <p className="text-gray-400 mt-4 text-lg">From launchpad to the asteroid belt and beyond.</p>
          </div>

          <div className="max-w-4xl mx-auto space-y-0">
            {[
              { phase: "Phase 1: Ignition", status: "Active", items: ["Website Launch", "Community Formation", "Smart Contract Audit", "Presale Kickoff"] },
              { phase: "Phase 2: Liftoff", status: "Upcoming", items: ["DEX Listing", "CoinMarketCap Listing", "CoinGecko Listing", "First Marketing Push"] },
              { phase: "Phase 3: Orbit", status: "Upcoming", items: ["CEX Listings", "AstroShiba NFT Collection", "Strategic Partnerships", "10,000 Holders"] },
              { phase: "Phase 4: Beyond", status: "Upcoming", items: ["AstroSwap Platform", "Merch Store", "Tier 1 Exchange Listing", "100,000 Holders"] },
            ].map((phase, i, arr) => (
              <div key={i} className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full z-10 mt-1 shrink-0 ${phase.status === 'Active' ? 'bg-orange-500 shadow-[0_0_18px_rgba(234,88,12,0.9)]' : 'bg-gray-700 border-2 border-gray-600'}`} />
                  {i < arr.length - 1 && <div className="w-0.5 flex-1 bg-white/10 my-1" />}
                </div>
                <div className="pb-12">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-2xl font-bold text-white">{phase.phase}</h3>
                    {phase.status === 'Active' && (
                      <span className="text-xs bg-orange-500 text-black font-bold px-3 py-1 rounded-full">ACTIVE</span>
                    )}
                  </div>
                  <ul className="space-y-3">
                    {phase.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-3 text-gray-400">
                        <Target className={`w-4 h-4 shrink-0 ${phase.status === 'Active' ? 'text-orange-400' : 'text-gray-600'}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Hologram */}
        <section className="container mx-auto px-4 py-12 flex flex-col items-center gap-8">
          <div className="w-56 h-56 md:w-80 md:h-80 relative" style={{ animation: 'pulse 4s ease-in-out infinite' }}>
            <img src="/astro-hologram.png" alt="AstroShiba Coin" className="w-full h-full object-contain rounded-full shadow-[0_0_80px_rgba(234,88,12,0.35)] mix-blend-screen" />
          </div>
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-extrabold">Ready to Ape In?</h2>
            <p className="text-gray-400 max-w-lg">The asteroid belt waits for no one. Presale closes when the countdown hits zero.</p>
            <Button size="lg" className="bg-orange-500 hover:bg-orange-400 text-black font-bold text-lg px-10 h-14 shadow-[0_0_30px_rgba(234,88,12,0.5)]">
              Buy $ASTRO Now <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-black/30 mt-12">
        <div className="container mx-auto px-4 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-orange-400" />
            <span className="font-extrabold text-xl tracking-tight text-white">ASTROSHIBAS</span>
          </div>
          <p className="text-gray-500 text-sm text-center">
            $ASTRO is a meme coin with no intrinsic value or expectation of financial return. Not financial advice.
          </p>
          <div className="flex gap-3">
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:border-orange-500/50 hover:text-orange-400 transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="#" className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:border-orange-500/50 hover:text-orange-400 transition-colors">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.895-1.056-.676-1.653-1.107-2.678-1.782-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.882-.662 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.381 4.025-1.627 4.476-1.635z"/></svg>
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
      `}</style>
    </div>
  );
}
