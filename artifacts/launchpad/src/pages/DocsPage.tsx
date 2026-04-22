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
            <span>v1.0</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mt-2 text-foreground">
            How It Works
          </h1>
          <p className="text-[14px] text-muted-foreground mt-3 max-w-xl">
            A fair-launch token protocol. Bonding curve → automatic graduation to a DEX with permanently
            burned LP. Designed to neutralize creator rugs, sniper extraction, and dead liquidity.
          </p>
        </div>

        {/* §1 Lifecycle */}
        <H2 n="01">Token Lifecycle</H2>
        <pre className="font-mono text-[12px] bg-secondary border-2 border-border p-4 mb-4 overflow-x-auto leading-relaxed">
{`  CREATE  →  BONDING CURVE  →  GRADUATION  →  DEX
  (anyone)   (5 ETH target)    (auto on-chain)   (LP burned forever)`}
        </pre>
        <ol className="space-y-2 text-[14px] text-foreground/90 list-none pl-0">
          {[
            ['Create', 'Anyone deploys a token through the factory. Fixed 1B supply. No premint to the creator.'],
            ['Bonding curve', 'Buyers and sellers trade against the curve until it raises 5 ETH real (a 3 ETH virtual reserve smooths the early curve).'],
            ['Graduation', 'When the target hits, the contract automatically pairs remaining tokens + raised ETH on a DEX and burns the LP to 0xdead.'],
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
          Most launchpads pay holders a flat "% of supply" cut. That gets gamed in one block: snipers buy, claim,
          dump. This protocol pays in <span className="font-bold">ETH</span>, weighted by{' '}
          <Mono>balance × seconds held</Mono>. The longer you hold a larger position, the bigger your slice. A wallet
          that buys and sells in the same block earns <span className="font-bold">zero</span>.
        </P>

        {/* The unit */}
        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.1 — The Unit: holdScore
        </h3>
        <P>
          Every wallet has a <Mono>holdScore</Mono> that grows continuously while it holds tokens:
        </P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-3 overflow-x-auto">
{`holdScore += balance × (now − lastUpdate)`}
        </pre>
        <P>
          Updated every time the balance changes (buy, sell, transfer in, transfer out). Between events the score
          accrues silently — no transaction, no gas. If you hold 1,000 tokens for 1 hour, you earn 3,600,000
          token-seconds. Hold 10,000 tokens for the same hour and you earn 36,000,000.
        </P>

        {/* The pool */}
        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.2 — The Pool: cumulativeEthPerScore
        </h3>
        <P>
          Instead of looping over every holder on every reward (impossible at scale), the contract maintains a single
          global counter:
        </P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-3 overflow-x-auto">
{`cumulativeEthPerScore += rewardEth × 1e18 / totalScore`}
        </pre>
        <P>
          Every wallet stores the value of <Mono>cumulativeEthPerScore</Mono> the last time it was settled. Pending
          rewards are simply:
        </P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-4 overflow-x-auto">
{`pendingEth = userScore × (cumulativeEthPerScore − userSnapshot) / 1e18`}
        </pre>

        {/* Where rewards come from */}
        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.3 — Where the Reward ETH Comes From
        </h3>
        <div className="border-2 border-border mb-3">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest">
                <th className="text-left px-3 py-2 font-bold">Event</th>
                <th className="text-left px-3 py-2 font-bold">ETH routed to reward pool</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Buy on curve', '2.0% of ETH paid in'],
                ['Sell on curve (>24h hold)', '2.0% of ETH received'],
                ['Sell on curve (<24h hold)', '2.0% + anti-snipe surcharge (5 / 10 / 20%)'],
                ['Post-graduation transfer', '4/7 of the 3.5% ETH-side tax (≈2% of trade)'],
              ].map(([k, v], i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-bold">{k}</td>
                  <td className="px-3 py-2 text-foreground/80">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          <span className="font-bold">Important:</span> the entire anti-snipe surcharge goes to the holder pool. When a
          sniper dumps inside 5 minutes and pays +20% extra, that 20% is paid directly to everyone else holding the
          token. Paper hands subsidize diamond hands by contract.
        </P>

        {/* Selling */}
        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.4 — What Selling Does to Your Score
        </h3>
        <P>
          When you sell, your accumulated score is reduced <span className="font-bold">proportionally</span> to the
          tokens sold:
        </P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-3 overflow-x-auto">
{`newScore = oldScore × (balanceAfter / balanceBefore)`}
        </pre>
        <P>
          Sell half your bag, lose half your score. Sell everything, score goes to zero. Buying back later starts a
          fresh accrual from that moment — there is no "loyalty restoration." This is the core anti-game: every exit
          permanently destroys the time you put in.
        </P>

        {/* Worked example */}
        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.5 — Worked Example
        </h3>
        <P>Three wallets, one trading day:</P>
        <div className="border-2 border-border mb-3">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest">
                <th className="text-left px-3 py-2 font-bold">Wallet</th>
                <th className="text-left px-3 py-2 font-bold">Action</th>
                <th className="text-right px-3 py-2 font-bold">holdScore at hour 24</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['A — Diamond', '10,000 tokens, held 24h straight', '10,000 × 86,400 = 864,000,000'],
                ['B — Mid', '10,000 tokens at hour 0, sold 50% at hour 12', '5,000 × 86,400 + 5,000 × 43,200 = 648,000,000'],
                ['C — Sniper', '10,000 tokens, sold all at minute 4', '10,000 × 240 = 2,400,000'],
              ].map(([w, a, s], i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-bold">{w}</td>
                  <td className="px-3 py-2 text-foreground/80 font-sans">{a}</td>
                  <td className="px-3 py-2 text-right text-primary font-bold">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          If 1 ETH lands in the reward pool at hour 24, total score across these three wallets is
          1,514,400,000. Distribution:
        </P>
        <div className="border-2 border-border mb-3">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest">
                <th className="text-left px-3 py-2 font-bold">Wallet</th>
                <th className="text-right px-3 py-2 font-bold">Share</th>
                <th className="text-right px-3 py-2 font-bold">ETH from 1 ETH pool</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['A — Diamond', '57.05%', '0.5705 ETH'],
                ['B — Mid', '42.79%', '0.4279 ETH'],
                ['C — Sniper', '0.16%', '0.0016 ETH'],
              ].map(([w, s, e], i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-bold">{w}</td>
                  <td className="px-3 py-2 text-right">{s}</td>
                  <td className="px-3 py-2 text-right text-primary font-bold">{e}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          And remember: the sniper <span className="font-bold">paid +20%</span> on their exit, which went directly into
          this same pool. They funded A and B's payday.
        </P>

        {/* Claiming */}
        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.6 — Claiming
        </h3>
        <ul className="space-y-1.5 text-[14px] text-foreground/90 list-none pl-0 mb-3">
          {[
            ['claim()', 'pulls all your pending ETH in one tx. Non-reentrant. Resets pending to 0.'],
            ['pendingRewards(addr)', 'view function — call from any UI to display unclaimed ETH.'],
            ['Auto-settle', 'pending updates automatically on every transfer (in or out) before the balance changes. You never lose what you earned, even if you sell everything.'],
            ['No expiry', 'pending ETH never expires. Hold indefinitely, claim whenever.'],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-bold mt-0.5">→</span>
              <span>
                <Mono>{k}</Mono> <span className="text-foreground/80">— {v}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* Excluded */}
        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.7 — Addresses Excluded From Rewards
        </h3>
        <P>
          The following addresses do <span className="font-bold">not</span> accrue holdScore. Their balances are
          invisible to the reward math:
        </P>
        <ul className="space-y-1 text-[13px] text-foreground/90 list-none pl-0 mb-3">
          {[
            ['Bonding curve contract', 'holds the curve\'s token reserve'],
            ['DEX liquidity pair', 'liquidity pool tokens, not real holders'],
            ['0xdead burn address', 'burned supply'],
            ['Factory contract', 'protocol-owned'],
            ['Token contract itself', 'self-held buffer'],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-primary text-[11px] font-bold mt-1">·</span>
              <span>
                <span className="font-bold">{k}</span> <span className="text-foreground/70">— {v}</span>
              </span>
            </li>
          ))}
        </ul>
        <P>
          This means LP and burned tokens never dilute real holders. 100% of every reward distribution goes to
          on-chain wallets actively holding.
        </P>

        {/* Edge cases */}
        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.8 — Edge Cases &amp; Guarantees
        </h3>
        <ul className="space-y-1.5 text-[14px] text-foreground/90 list-none pl-0">
          {[
            ['Zero holders', 'If a reward arrives when totalScore is 0 (e.g. only the curve holds tokens), the ETH sits in the contract and gets rolled into the next distribution. Nothing is lost.'],
            ['Transfers between wallets', 'Both sender and receiver have their pending settled before balances move. Your earned ETH cannot be stolen by a transfer.'],
            ['Post-graduation', 'The 5% tax on DEX trades flows back into the same reward pool (4/7 share). Holders keep earning forever, not just on the curve.'],
            ['Re-entrancy', 'claim() is nonReentrant. ETH sent via low-level call after pending is zeroed — checks-effects-interactions.'],
            ['Precision', 'cumulativeEthPerScore is scaled by 1e18 to avoid integer truncation. Dust losses are sub-wei.'],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-bold mt-0.5">→</span>
              <span>
                <span className="font-bold">{k}:</span> <span className="text-foreground/85">{v}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 border-2 border-foreground bg-foreground text-background p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest opacity-70 mb-1">TL;DR</div>
          <div className="text-[14px] leading-relaxed">
            Hold longer + hold more = bigger share. Sell early = surcharge that pays everyone else. Claim ETH any time.
            No expiry, no inflation, no rebase tricks — just the actual ETH paid in by traders.
          </div>
        </div>

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
