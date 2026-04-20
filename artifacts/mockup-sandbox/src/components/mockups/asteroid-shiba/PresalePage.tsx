import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronRight, Copy, Rocket, ShieldCheck, Stars, Target, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const TARGET_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7 + 1000 * 60 * 60 * 5).getTime(); // 7 days 5 hours from now
const PRESALE_ADDRESS = '0x8b3...4f2a9';

function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = TARGET_DATE - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

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
    <div className="flex gap-4 justify-center my-6">
      {Object.entries(timeLeft).map(([unit, value]) => (
        <div key={unit} className="flex flex-col items-center">
          <div className="bg-card border border-primary/30 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center rounded-xl shadow-[0_0_15px_rgba(234,88,12,0.2)]">
            <span className="text-2xl sm:text-4xl font-bold font-mono text-primary animate-pulse">{value.toString().padStart(2, '0')}</span>
          </div>
          <span className="text-xs sm:text-sm text-muted-foreground mt-2 uppercase tracking-widest">{unit}</span>
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
    toast({
      title: "Address Copied",
      description: "Wallet address copied to clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans dark selection:bg-primary/30 overflow-x-hidden relative">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-secondary/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[150px]" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-accent/5 blur-[100px]" />
        {/* Stars overlay */}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-screen"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="w-8 h-8 text-primary" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
              ASTROSHIBAS
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#about" className="hover:text-primary transition-colors">Mission</a>
            <a href="#tokenomics" className="hover:text-primary transition-colors">Tokenomics</a>
            <a href="#roadmap" className="hover:text-primary transition-colors">Roadmap</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" className="hidden sm:flex border-primary/50 hover:bg-primary/10">Whitepaper</Button>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-[0_0_20px_rgba(234,88,12,0.4)]">
              Connect Wallet
            </Button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-12 md:py-24 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 space-y-8 text-center lg:text-left">
            <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/30 px-4 py-1">
              <Stars className="w-4 h-4 mr-2 inline" /> PRESALE PHASE 1 LIVE
            </Badge>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter leading-tight">
              THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">GOODEST</span> BOY<br />
              IN THE GALAXY
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              Board the AstroShiba vessel. We are leaving the atmosphere and headed straight for the asteroid belt. Secure your bags before we hit hyperdrive.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
              <Button size="lg" className="w-full sm:w-auto bg-primary hover:bg-primary/90 shadow-[0_0_30px_rgba(234,88,12,0.5)] text-lg px-8 h-14">
                Buy $ASTRO <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 border-border hover:bg-white/5">
                Join Community
              </Button>
            </div>
            <div className="pt-8 flex items-center justify-center lg:justify-start gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" /> Contract Audited
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" /> LP Locked
              </div>
            </div>
          </div>

          {/* Presale Widget */}
          <div className="flex-1 w-full max-w-md lg:max-w-lg">
            <Card className="border-primary/20 bg-card/50 backdrop-blur-xl shadow-[0_0_50px_rgba(234,88,12,0.15)] relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-accent to-secondary" />
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold">Presale Ends In</CardTitle>
                <CountdownTimer />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Raised: <strong className="text-foreground">$1,240,500</strong></span>
                    <span className="text-muted-foreground">Goal: <strong className="text-foreground">$2,000,000</strong></span>
                  </div>
                  <Progress value={62} className="h-3 bg-secondary/20" />
                  <div className="text-center text-xs text-muted-foreground">
                    1 $ASTRO = $0.000042
                  </div>
                </div>

                <div className="bg-background/50 rounded-lg p-4 border border-border space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Amount to Buy (ETH)</span>
                    <span className="text-xs text-muted-foreground">Balance: 2.45 ETH</span>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-background border border-input rounded-md py-3 px-4 pr-16 text-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono"
                      placeholder="0.0"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="font-bold text-muted-foreground">ETH</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-sm py-2 border-t border-border">
                    <span className="text-muted-foreground">You Receive:</span>
                    <span className="font-bold text-primary">{tokenAmount} $ASTRO</span>
                  </div>
                  
                  <Button className="w-full h-12 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80 text-black font-bold">
                    <Wallet className="w-5 h-5 mr-2" />
                    Buy Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Visual Break */}
        <div className="w-full h-64 md:h-96 relative my-12">
          <img 
            src="/__mockup/images/astro-hero.png" 
            alt="Astro Shiba in Space" 
            className="w-full h-full object-cover object-center rounded-3xl opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background"></div>
        </div>

        {/* Info Marquee */}
        <div className="w-full bg-primary/10 border-y border-primary/20 py-4 overflow-hidden flex whitespace-nowrap">
          <div className="animate-[marquee_20s_linear_infinite] flex gap-12 items-center text-primary font-mono text-sm tracking-wider uppercase">
            <span>🚀 Next Stop: The Moon</span>
            <span>⭐ 0% Buy Tax</span>
            <span>⭐ 0% Sell Tax</span>
            <span>🛸 Liquidity Locked</span>
            <span>🛰️ Community Driven</span>
            <span>🚀 Next Stop: The Moon</span>
            <span>⭐ 0% Buy Tax</span>
            <span>⭐ 0% Sell Tax</span>
            <span>🛸 Liquidity Locked</span>
            <span>🛰️ Community Driven</span>
          </div>
        </div>

        {/* Tokenomics */}
        <section id="tokenomics" className="container mx-auto px-4 py-24">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold">Asteroid <span className="text-primary">Nomics</span></h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Fair launch, zero taxes, and a massive burn. The perfect fuel for a trip to the cosmos.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: "Presale", value: "40%", desc: "Initial Fuel", color: "from-primary to-accent" },
              { label: "Liquidity", value: "30%", desc: "Locked for 1 Year", color: "from-secondary to-blue-500" },
              { label: "Marketing", value: "15%", desc: "Spreading the Word", color: "from-green-500 to-emerald-400" },
              { label: "Burn", value: "15%", desc: "Sent to Black Hole", color: "from-destructive to-red-500" }
            ].map((item, i) => (
              <Card key={i} className="bg-card/40 border-border backdrop-blur hover:border-primary/50 transition-colors">
                <CardContent className="p-6 text-center space-y-2">
                  <div className={`text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r ${item.color}`}>
                    {item.value}
                  </div>
                  <div className="text-lg font-bold">{item.label}</div>
                  <div className="text-sm text-muted-foreground">{item.desc}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 p-8 rounded-2xl bg-secondary/5 border border-secondary/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold mb-2">Smart Contract Address</h3>
              <p className="text-muted-foreground text-sm">Do not send funds directly to this address.</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <code className="flex-1 md:flex-none bg-background px-4 py-3 rounded-lg border border-border font-mono text-sm text-primary break-all">
                {PRESALE_ADDRESS}
              </code>
              <Button variant="outline" size="icon" onClick={copyAddress} className="h-12 w-12 shrink-0 border-primary/50 hover:bg-primary/20 hover:text-primary">
                <Copy className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="container mx-auto px-4 py-24 relative">
          <div className="absolute right-0 top-1/2 w-96 h-96 bg-secondary/20 rounded-full blur-[150px] -z-10"></div>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold">Flight <span className="text-secondary">Plan</span></h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {[
              { phase: "Phase 1: Ignition", status: "Active", items: ["Website Launch", "Community Formation", "Smart Contract Audit", "Presale Kickoff"] },
              { phase: "Phase 2: Liftoff", status: "Upcoming", items: ["DEX Listing", "CoinMarketCap Listing", "CoinGecko Listing", "First Marketing Push"] },
              { phase: "Phase 3: Orbit", status: "Upcoming", items: ["CEX Listings", "AstroShiba NFT Collection", "Strategic Partnerships", "10,000 Holders"] },
              { phase: "Phase 4: Beyond", status: "Upcoming", items: ["AstroSwap Platform", "Merch Store", "Tier 1 Exchange Listing", "100,000 Holders"] }
            ].map((phase, i) => (
              <div key={i} className="flex gap-6 relative">
                <div className="flex flex-col items-center">
                  <div className={`w-4 h-4 rounded-full z-10 ${phase.status === 'Active' ? 'bg-primary shadow-[0_0_15px_rgba(234,88,12,0.8)]' : 'bg-muted border-2 border-border'}`} />
                  {i < 3 && <div className="w-0.5 h-full bg-border -my-2" />}
                </div>
                <div className="pb-12 pt-[-4px]">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-2xl font-bold">{phase.phase}</h3>
                    {phase.status === 'Active' && <Badge className="bg-primary text-black">Active</Badge>}
                  </div>
                  <ul className="space-y-3">
                    {phase.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-3 text-muted-foreground">
                        <Target className={`w-4 h-4 ${phase.status === 'Active' ? 'text-primary' : 'text-muted-foreground'}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
        
        {/* Hologram Section */}
        <section className="container mx-auto px-4 py-12 flex justify-center">
             <div className="w-64 h-64 md:w-96 md:h-96 relative animate-[pulse_4s_ease-in-out_infinite]">
                 <img src="/__mockup/images/astro-hologram.png" alt="Astro Hologram" className="w-full h-full object-contain rounded-full shadow-[0_0_100px_rgba(234,88,12,0.3)] mix-blend-screen" />
             </div>
        </section>

      </main>

      <footer className="border-t border-border bg-background relative z-10">
        <div className="container mx-auto px-4 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Rocket className="w-6 h-6 text-primary" />
            <span className="font-bold text-xl tracking-tight">ASTROSHIBAS</span>
          </div>
          <p className="text-muted-foreground text-sm text-center md:text-left">
            $ASTRO is a meme coin with no intrinsic value or expectation of financial return.
          </p>
          <div className="flex gap-4">
             <Button variant="ghost" size="icon" className="hover:text-primary"><span className="sr-only">Twitter</span><svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></Button>
             <Button variant="ghost" size="icon" className="hover:text-primary"><span className="sr-only">Telegram</span><svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.895-1.056-.676-1.653-1.107-2.678-1.782-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.882-.662 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.381 4.025-1.627 4.476-1.635z"/></svg></Button>
          </div>
        </div>
      </footer>

      {/* Marquee Animation Keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `}} />
    </div>
  );
}