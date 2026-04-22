import { Navbar } from '@/components/layout/Navbar';

function H2({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="mt-12 mb-4 flex items-baseline gap-3 border-b-2 border-border pb-2">
      <span className="font-mono text-[11px] font-bold tracking-widest text-primary">§{n}</span>
      <h2 className="text-xl font-black uppercase tracking-tight text-foreground">{children}</h2>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[14px] leading-relaxed text-foreground/90 mb-3">{children}</p>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return <code className="font-mono text-[12px] bg-secondary border border-border px-1.5 py-0.5">{children}</code>;
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10">
        {/* Masthead */}
        <div className="border-b-4 border-foreground pb-4 mb-8">
          <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
            <span>Protocol Spec</span>
            <span>v1.0 · Base Mainnet</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 text-foreground">
            How It Works
          </h1>
          <p className="text-[14px] text-muted-foreground mt-3 max-w-xl">
            A fair-launch token protocol on Base. Bonding curve → automatic graduation to Uniswap V2 with permanently
            burned LP. Designed to neutralize creator rugs, sniper extraction, and dead liquidity.
          </p>
        </div>

        {/* §1 Lifecycle */}
        <H2 n="01">Token Lifecycle</H2>
        <pre className="font-mono text-[12px] bg-secondary border-2 border-border p-4 mb-4 overflow-x-auto leading-relaxed">
{`  CREATE  →  BONDING CURVE  →  GRADUATION  →  UNISWAP V2
  (anyone)   (5 ETH target)    (auto on-chain)   (LP burned forever)`}
        </pre>
        <ol className="space-y-2 text-[14px] text-foreground/90 list-none pl-0">
          {[
            ['Create', 'Anyone deploys a token through the factory. Fixed 1B supply. No premint to the creator.'],
            ['Bonding curve', 'Buyers and sellers trade against the curve until it raises 5 ETH real (a 3 ETH virtual reserve smooths the early curve).'],
            ['Graduation', 'When the target hits, the contract automatically pairs remaining tokens + raised ETH on Uniswap V2 and burns the LP to 0xdead.'],
            ['DEX trading', 'The token becomes a normal ERC-20. The curve is closed forever.'],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-[11px] font-bold text-primary mt-0.5">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="font-bold uppercase tracking-wide text-foreground">{k}</span>{' '}
                <span className="text-foreground/80">— {v}</span>
              </span>
            </li>
          ))}
        </ol>

        {/* §2 Tax */}
        <H2 n="02">Tax — 5% on every curve trade</H2>
        <P>Every buy and sell on the bonding curve takes a flat 5% ETH-side tax, split:</P>
        <div className="border-2 border-border">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest">
                <th className="text-left px-3 py-2 font-bold">Bucket</th>
                <th className="text-right px-3 py-2 font-bold w-20">Share</th>
                <th className="text-left px-3 py-2 font-bold">Destination</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Burn', '1.5%', 'Tokens bought from curve, sent to 0xdead'],
                ['Holders', '2.0%', 'Pro-rata to time-weighted holders (§4)'],
                ['Platform', '1.5%', 'Protocol treasury'],
                ['Creator', '0.0%', 'Zero. No creator skim, ever.'],
              ].map(([k, s, d], i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-bold uppercase">{k}</td>
                  <td className="px-3 py-2 text-right text-primary font-bold">{s}</td>
                  <td className="px-3 py-2 text-foreground/80">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* §3 Anti-snipe */}
        <H2 n="03">Anti-Snipe Tiers</H2>
        <P>
          Sells carry an extra tax based on how long ago the wallet first bought. The penalty stacks on top of the
          standard 5% and routes to the holder rewards pool — diamond hands paid by paper hands.
        </P>
        <div className="border-2 border-border">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest">
                <th className="text-left px-3 py-2 font-bold">Time Since First Buy</th>
                <th className="text-right px-3 py-2 font-bold">Extra Sell Tax</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['< 5 minutes', '+20%'],
                ['< 1 hour', '+10%'],
                ['< 24 hours', '+5%'],
                ['≥ 24 hours', '0%'],
              ].map(([t, x], i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">{t}</td>
                  <td className="px-3 py-2 text-right text-primary font-bold">{x}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* §4 Rewards */}
        <H2 n="04">Time-Weighted Holder Rewards</H2>
        <P>
          Standard "% of supply" reward systems get gamed by snipers who hold for one block. This protocol weights by{' '}
          <Mono>token-seconds held</Mono>:
        </P>
        <ul className="space-y-1.5 text-[14px] text-foreground/90 list-none pl-0">
          {[
            'Every holder accrues balance × time_held continuously.',
            'The 2% holder share of every trade tax flows into a reward pool.',
            'The pool is distributed pro-rata to accrued token-seconds.',
            'Selling resets the weight on the sold portion.',
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-bold mt-0.5">→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
        <P>
          <span className="font-bold">Net effect:</span> you earn more by holding longer with a larger position. Sniping
          and dumping earns nothing.
        </P>

        {/* §5 Curve */}
        <H2 n="05">Bonding Curve Math</H2>
        <P>Constant-product curve with virtual reserves:</P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-4">
          k = (VIRTUAL_ETH + raisedETH) × tokensRemaining
        </pre>
        <div className="border-2 border-border">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest">
                <th className="text-left px-3 py-2 font-bold">Parameter</th>
                <th className="text-left px-3 py-2 font-bold">Value</th>
                <th className="text-left px-3 py-2 font-bold">Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['VIRTUAL_ETH', '3 ETH', 'Softens early curve, prevents vertical price tail'],
                ['TARGET_REAL_ETH', '5 ETH', 'Graduation trigger'],
                ['TOTAL_SUPPLY', '1,000,000,000', 'Fixed forever'],
              ].map(([k, v, p], i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-bold">{k}</td>
                  <td className="px-3 py-2 text-primary font-bold">{v}</td>
                  <td className="px-3 py-2 text-foreground/80 font-sans">{p}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>Price discovery is fully on-chain. No oracle, no admin price setting, no upgrade proxies on the curve.</P>

        {/* §6 What this fixes */}
        <H2 n="06">What This Fixes</H2>
        <div className="border-2 border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest text-[11px] font-mono">
                <th className="text-left px-3 py-2 font-bold">Failure mode in most launchpads</th>
                <th className="text-left px-3 py-2 font-bold">This protocol</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Creator tax (rugpull vector)', '0% creator tax'],
                ['LP held by deployer post-graduation', 'LP burned to 0xdead'],
                ['Snipers extract early, dump on retail', 'Tiered sell tax 20 / 10 / 5%'],
                ['Flat reward % gameable by 1-block holders', 'Time-weighted token-seconds'],
                ['Manual / admin graduation', 'Automatic on-chain at 5 ETH'],
              ].map(([a, b], i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-foreground/70 line-through decoration-primary/60">{a}</td>
                  <td className="px-3 py-2 font-bold text-foreground">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* §7 Trust */}
        <H2 n="07">Trust Model</H2>
        <ul className="space-y-1.5 text-[14px] text-foreground/90 list-none pl-0">
          {[
            'All contracts non-upgradeable.',
            'LP burn is unconditional and immediate at graduation — verifiable on-chain.',
            'No admin function can pause trading, change tax, or seize tokens.',
            'Treasury receives ETH only; it cannot touch user balances or the curve.',
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-bold mt-0.5">→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        {/* Colophon */}
        <div className="mt-16 pt-4 border-t-2 border-border flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>End of document</span>
          <span>Read in ~3 min</span>
        </div>
      </main>
    </div>
  );
}
