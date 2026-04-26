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
            Stackr is a fair-launch token protocol on Base. Bonding curve → automatic graduation to a DEX with
            permanently burned LP. Holder rewards auto-distributed on every trade. Designed to neutralize creator rugs,
            sniper extraction, and dead liquidity.
          </p>
        </div>

        {/* §1 Lifecycle */}
        <H2 n="01">Token Lifecycle</H2>
        <pre className="font-mono text-[12px] bg-secondary border-2 border-border p-4 mb-4 overflow-x-auto leading-relaxed">
{`  CREATE  →  BONDING CURVE  →  GRADUATION  →  DEX
  (anyone)   (2.75 ETH target) (auto on-chain)   (LP burned forever)`}
        </pre>
        <ol className="space-y-2 text-[14px] text-foreground/90 list-none pl-0">
          {[
            ['Create', 'Anyone deploys a token through the factory. Fixed 1B supply. No premint to the creator. An optional dev buy can be made at launch, subject to the same anti-snipe rules as everyone else.'],
            ['Bonding curve', 'Buyers and sellers trade against the curve until it raises 2.75 ETH real. The curve uses a virtual ETH reserve sized at launch via Chainlink so every token starts at $5K FDV.'],
            ['Graduation', 'When the target hits, the contract automatically pairs remaining tokens + raised ETH on a DEX and burns the LP to 0xdead.'],
            ['DEX trading', 'The token becomes a normal ERC-20. The curve is closed forever. Holder rewards continue from a 3.5% post-graduation tax.'],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-[11px] font-bold text-primary mt-0.5">{String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="font-bold uppercase tracking-wide text-foreground">{k}:</span>{' '}
                <span className="text-foreground/80">{v}</span>
              </span>
            </li>
          ))}
        </ol>

        {/* §2 Fee */}
        <H2 n="02">Fee: 1% on every curve trade</H2>
        <P>Every buy and sell on the bonding curve takes a flat 1% ETH-side fee. 100% goes to the token creator. There is no platform fee, no burn, no holder tax.</P>
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
                ['Creator',  '1.0%', 'Claimable by token creator at any time'],
                ['Platform', '0.0%', 'No protocol skim'],
                ['Burn',     '0.0%', 'No burn on trade'],
                ['Holders',  '0.0%', 'No tax-funded rewards'],
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
          standard 5% and is routed entirely to the holder rewards pool. Diamond hands paid by paper hands.
        </P>
        <div className="border-2 border-border mb-3">
          <table className="w-full font-mono text-[12px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest">
                <th className="text-left px-3 py-2 font-bold">Time Since First Buy</th>
                <th className="text-right px-3 py-2 font-bold">Extra Sell Tax → Holders</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['< 5 minutes',  '+20%'],
                ['< 1 hour',     '+10%'],
                ['< 24 hours',   '+5%'],
                ['≥ 24 hours',   '0%'],
              ].map(([t, x], i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2">{t}</td>
                  <td className="px-3 py-2 text-right text-primary font-bold">{x}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>
          The anti-snipe tax applies to the <span className="font-bold">seller's first-buy timestamp</span> per token,
          not per wallet globally. Buying a second token resets a fresh timer for that token only.
        </P>

        {/* §4 Rewards */}
        <H2 n="04">Time-Weighted Holder Rewards</H2>
        <P>
          Most launchpads pay holders a flat "% of supply" cut. That gets gamed in one block: snipers buy, claim, dump.
          Stackr pays in <span className="font-bold">ETH</span>, weighted by{' '}
          <Mono>balance × seconds held</Mono>. The longer you hold a larger position, the bigger your slice. A wallet
          that buys and sells in the same block earns <span className="font-bold">zero</span>.
        </P>

        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.1 The Unit: holdScore
        </h3>
        <P>
          Every wallet has a <Mono>holdScore</Mono> that grows continuously while it holds tokens:
        </P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-3 overflow-x-auto">
{`holdScore += balance × (now − lastUpdate)`}
        </pre>
        <P>
          Updated on every balance change (buy, sell, transfer). Between events the score accrues silently, no
          transaction needed, no gas. Hold 1,000 tokens for 1 hour → 3,600,000 token-seconds. Hold 10,000 for the same hour
          → 36,000,000.
        </P>

        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.2 The Pool: cumulativeEthPerScore
        </h3>
        <P>
          Instead of looping over every holder on every reward (impossible at scale), the contract maintains a single
          global accumulator:
        </P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-3 overflow-x-auto">
{`cumulativeEthPerScore += rewardEth × 1e18 / totalScore`}
        </pre>
        <P>
          Every wallet stores a snapshot of <Mono>cumulativeEthPerScore</Mono> taken at its last settlement. Pending
          rewards are:
        </P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-4 overflow-x-auto">
{`pendingEth = userScore × (cumulativeEthPerScore − userSnapshot) / 1e18`}
        </pre>

        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.3 Auto-Distribution: No Claim Button
        </h3>
        <P>
          On Stackr, rewards are <span className="font-bold">pushed automatically</span> to holders. There is no
          manual "claim" transaction required. Here is exactly when ETH lands in your wallet:
        </P>
        <ul className="space-y-1.5 text-[14px] text-foreground/90 list-none pl-0 mb-3">
          {[
            ['On every buy',      "The buyer's pending rewards are settled and sent before their new balance is recorded."],
            ['On every sell',     "The seller's pending rewards are settled and sent before their balance decreases."],
            ['On every transfer', 'Both sender and receiver are settled before balances change.'],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-bold mt-0.5">→</span>
              <span>
                <Mono>{k}</Mono>{' '}<span className="text-foreground/80">{v}</span>
              </span>
            </li>
          ))}
        </ul>
        <P>
          Your <Mono>pendingRewards</Mono> balance shown in the Profile tab represents ETH that has accrued since your
          last on-chain interaction. The next time you trade or transfer, it is automatically pushed to your wallet.
          No extra step needed.
        </P>

        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.4 Where the Reward ETH Comes From
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
                ['Buy on curve',              '2.0% of ETH paid in'],
                ['Sell on curve (≥24h hold)', '2.0% of ETH received'],
                ['Sell on curve (<24h hold)', '2.0% + anti-snipe surcharge (5 / 10 / 20%)'],
                ['Post-graduation DEX trade', '≈2% share of 3.5% tax (holders portion)'],
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
          <span className="font-bold">Key point:</span> the entire anti-snipe surcharge goes to the holder pool. When a
          sniper dumps inside 5 minutes and pays +20% extra, that 20% is paid directly to everyone else holding the
          token. Paper hands subsidize diamond hands by contract.
        </P>

        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.5 What Selling Does to Your Score
        </h3>
        <P>
          When you sell, your accumulated score is reduced <span className="font-bold">proportionally</span> to the
          tokens sold:
        </P>
        <pre className="font-mono text-[13px] bg-secondary border-2 border-border p-4 mb-3 overflow-x-auto">
{`newScore = oldScore × (balanceAfter / balanceBefore)`}
        </pre>
        <P>
          Sell half your bag → lose half your score. Sell everything → score resets to zero. Buying back later starts a
          fresh accrual from that moment. Every exit permanently destroys the time you put in.
        </P>

        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.6 Worked Example
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
                ['A: Diamond', '10,000 tokens, held 24h straight',              '10,000 × 86,400 = 864,000,000'],
                ['B: Mid',     '10,000 at hour 0, sold 50% at hour 12',          '≈648,000,000'],
                ['C: Sniper',  '10,000 tokens, sold all at minute 4',            '10,000 × 240 = 2,400,000'],
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
          If 1 ETH lands in the reward pool at hour 24, total score ≈ 1,514,400,000. Distribution:
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
                ['A: Diamond', '57.05%', '0.5705 ETH'],
                ['B: Mid',     '42.79%', '0.4279 ETH'],
                ['C: Sniper',   '0.16%', '0.0016 ETH'],
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
          Wallet C also paid +20% on their dump (anti-snipe tax), which went directly into this same pool and funded
          A and B's payday. All of this settles automatically. No one had to press a button.
        </P>

        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.7 Addresses Excluded From Rewards
        </h3>
        <P>
          The following addresses do <span className="font-bold">not</span> accrue holdScore. Their balances are
          invisible to the reward math:
        </P>
        <ul className="space-y-1 text-[13px] text-foreground/90 list-none pl-0 mb-3">
          {[
            ['Bonding curve contract', "holds the curve's token reserve"],
            ['DEX liquidity pair',     'liquidity pool tokens, not real holders'],
            ['0xdead burn address',    'burned supply'],
            ['Factory contract',       'protocol-owned'],
            ['Token contract itself',  'self-held buffer'],
          ].map(([k, v], i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-primary text-[11px] font-bold mt-1">·</span>
              <span>
                <span className="font-bold">{k}:</span> <span className="text-foreground/70">{v}</span>
              </span>
            </li>
          ))}
        </ul>
        <P>
          LP and burned tokens never dilute real holders. 100% of every reward distribution goes to on-chain wallets
          actively holding.
        </P>

        <h3 className="mt-6 mb-2 text-[13px] font-bold uppercase tracking-widest text-foreground border-l-2 border-primary pl-2">
          4.8 Edge Cases &amp; Guarantees
        </h3>
        <ul className="space-y-1.5 text-[14px] text-foreground/90 list-none pl-0">
          {[
            ['Zero holders',           'If a reward arrives when totalScore is 0 (e.g. only the curve holds tokens), the ETH sits in the contract and rolls into the next distribution. Nothing is lost.'],
            ['Transfers between wallets', 'Both sender and receiver are settled before balances move. Your earned ETH cannot be stolen by a transfer.'],
            ['Post-graduation',         'The 3.5% tax on DEX trades flows into the same reward pool. Holders keep earning forever, not just on the curve.'],
            ['Re-entrancy',             'Settlement and ETH transfer use checks-effects-interactions. Pending is zeroed before ETH is sent.'],
            ['Precision',               'cumulativeEthPerScore is scaled by 1e18 to avoid integer truncation. Dust losses are sub-wei.'],
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
          <div className="font-mono text-[10px] uppercase tracking-widest opacity-70 mb-1">TL;DR: Rewards</div>
          <div className="text-[14px] leading-relaxed">
            Hold longer + hold more = bigger share. Sell early = surcharge that pays everyone else. Rewards land in your
            wallet automatically on your next trade. No manual claim, no extra gas, no expiry.
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
                ['VIRTUAL_ETH',     'Set at launch via Chainlink', 'Sized so every token starts at $5K FDV'],
                ['TARGET_REAL_ETH', '2.75 ETH',      'Graduation trigger'],
                ['CURVE_SUPPLY',    '800,000,000',   'Tokens sold via the curve (80%)'],
                ['LP_RESERVE',      '200,000,000',   'Tokens locked aside for graduation LP (20%)'],
                ['TOTAL_SUPPLY',    '1,000,000,000', 'Fixed forever, no mint function'],
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

        {/* §6 Dev Buy */}
        <H2 n="06">Dev Buy at Launch</H2>
        <P>
          Token creators can optionally buy tokens at the moment of deployment. This dev buy is subject to the exact
          same anti-snipe rules as any other wallet. There is no special window, no tax exemption, and no lock.
        </P>
        <ul className="space-y-1.5 text-[14px] text-foreground/90 list-none pl-0 mb-3">
          {[
            'ETH sent with the deploy transaction is treated as the first curve buy.',
            'The dev wallet starts a fresh anti-snipe timer from the deploy block.',
            'If the dev sells inside 24 hours, the standard sell surcharge applies.',
            'Dev tokens are visible on-chain from block 0. Nothing is hidden.',
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-bold mt-0.5">→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>

        {/* §7 What this fixes */}
        <H2 n="07">What This Fixes</H2>
        <div className="border-2 border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-foreground text-background uppercase tracking-widest text-[11px] font-mono">
                <th className="text-left px-3 py-2 font-bold">Failure mode in most launchpads</th>
                <th className="text-left px-3 py-2 font-bold">Stackr</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Creator tax (rugpull vector)',           '0% creator tax'],
                ['LP held by deployer post-graduation',    'LP burned to 0xdead'],
                ['Snipers extract early, dump on retail',  'Tiered sell tax 20 / 10 / 5%'],
                ['Flat reward % gameable by 1-block holders', 'Time-weighted token-seconds'],
                ['Manual claim required to earn rewards',  'Auto-distributed on every trade'],
                ['Manual / admin graduation',              'Automatic on-chain at 2.75 ETH'],
              ].map(([a, b], i) => (
                <tr key={i} className="border-t border-border align-top">
                  <td className="px-3 py-2 text-foreground/70 line-through decoration-primary/60">{a}</td>
                  <td className="px-3 py-2 font-bold text-foreground">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* §8 Trust */}
        <H2 n="08">Trust Model</H2>
        <ul className="space-y-1.5 text-[14px] text-foreground/90 list-none pl-0">
          {[
            'All contracts are non-upgradeable.',
            'LP burn is unconditional and immediate at graduation, verifiable on-chain.',
            'No admin function can pause trading, change tax rates, or seize tokens.',
            'Treasury receives ETH only; it cannot touch user balances or the curve.',
            'Factory deployer address is public. All tokens deployed from it are traceable.',
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-bold mt-0.5">→</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>


      </main>
    </div>
  );
}
