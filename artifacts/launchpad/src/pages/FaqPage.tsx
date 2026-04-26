import { Navbar } from '@/components/layout/Navbar';

const faqs: { q: string; a: string | string[] }[] = [
  {
    q: 'What is Stackr?',
    a: 'Stackr is a pump.fun-style bonding curve launchpad on Ethereum mainnet. Anyone can deploy a token at a fixed $5,000 starting market cap and trade it directly on the curve from block one. Once the curve raises 2.75 ETH, the token automatically graduates to a Uniswap V2 pool.',
  },
  {
    q: 'How does the bonding curve work?',
    a: [
      'Every token launches with the same parameters:',
      'Total supply: 1,000,000,000 (1B) tokens',
      'Curve allocation: 800,000,000 tokens (sold via constant-product curve)',
      'LP reserve: 200,000,000 tokens (held back for the V2 pool at graduation)',
      'Starting FDV: $5,000 (anchored to ETH/USD via Chainlink at deploy)',
      'Bond threshold: 2.75 ETH raised → auto-graduates to Uniswap V2',
    ],
  },
  {
    q: 'What happens at graduation?',
    a: 'Once 2.75 ETH is raised on the curve, the next buy that pushes it over the threshold automatically deploys a Uniswap V2 pool, seeds it with the 200M LP reserve tokens + raised ETH, and burns the LP tokens. The curve is permanently closed and trading moves to V2.',
  },
  {
    q: 'Are there any trading fees?',
    a: 'Yes — every buy and sell on the curve has a 1% fee that goes directly to the token creator. There is no platform fee on trades. The creator can claim accumulated fees at any time.',
  },
  {
    q: 'Who gets the LP value at graduation?',
    a: 'All LP value from graduation goes to the factory owner only. Bonders (people who bought during the curve) do not receive any LP share. They hold the tokens themselves and can sell them on the V2 pool after graduation.',
  },
  {
    q: 'Can the launch be cancelled?',
    a: 'Yes. The creator can cancel an unbonded launch. There are NO refunds for bonders by design — buying on the curve is at your own risk. Treat every launch as if it can rug at any time before graduation.',
  },
  {
    q: 'What chain is Stackr on?',
    a: 'Ethereum mainnet only. You must connect your wallet to Ethereum mainnet to deploy or trade.',
  },
  {
    q: 'How is the starting price set?',
    a: 'The factory reads the live ETH/USD price from Chainlink at deploy time and computes the curve\'s virtual ETH reserve so that the implied FDV is exactly $5,000 USD. This means every launch starts at the same dollar valuation regardless of ETH price.',
  },
  {
    q: 'Is the smart contract audited?',
    a: 'Not yet — this is an early version of the protocol. The factory and curve contracts are immutable: no upgrade keys, no admin pause, no mint function. Creators cannot drain liquidity or change the curve once a token is launched. Still, only trade what you can afford to lose.',
  },
  {
    q: 'Can I deploy a token with any name or ticker?',
    a: 'Yes. The factory does not check for duplicates. Anyone can use any name. Verify the contract address yourself before buying.',
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 md:px-8 py-10">
        <div className="border-b-4 border-foreground pb-4 mb-8">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-2">
            FAQ
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Common Questions
          </h1>
          <p className="text-[14px] text-muted-foreground mt-3">
            If something is not covered here, check the Docs page for the full protocol spec.
          </p>
        </div>

        <div className="space-y-0">
          {faqs.map((faq, i) => (
            <div key={i} className="border-t border-border py-5">
              <p className="text-[14px] font-bold text-foreground mb-2">{faq.q}</p>
              {Array.isArray(faq.a) ? (
                <ul className="space-y-1">
                  <li className="text-[13px] text-foreground/80 leading-relaxed">{faq.a[0]}</li>
                  {faq.a.slice(1).map((item, j) => (
                    <li key={j} className="text-[13px] text-foreground/70 font-mono pl-3">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-foreground/80 leading-relaxed">{faq.a}</p>
              )}
            </div>
          ))}
          <div className="border-t border-border" />
        </div>

      </main>
    </div>
  );
}
