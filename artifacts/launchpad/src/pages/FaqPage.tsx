import { Navbar } from '@/components/layout/Navbar';

const faqs: { q: string; a: string | string[] }[] = [
  {
    q: 'What is Stackr?',
    a: 'Stackr is a token launchpad on Base. Anyone can deploy a token, trade it on a bonding curve, and earn ETH rewards just by holding. When the curve hits its target, the token automatically lists on Uniswap with locked liquidity.',
  },
  {
    q: 'How does the bonding curve work?',
    a: 'Every token starts at a fixed price. As people buy, the price goes up. As people sell, it comes back down. There are no order books or counterparties. You buy from and sell to the contract. Price is determined entirely by how much ETH has been raised.',
  },
  {
    q: 'Do I need to do anything to receive holder rewards?',
    a: 'No. Rewards are pushed to your wallet automatically the next time you trade or transfer the token. You just hold. Other people trade. ETH comes to you.',
  },
  {
    q: 'What is the anti-snipe tax?',
    a: [
      'If you sell within 24 hours of buying, you pay an extra sell tax on top of the standard 5%.',
      'Under 5 minutes: +20%',
      'Under 1 hour: +10%',
      'Under 24 hours: +5%',
      'Every cent of that extra tax goes to other holders, not the protocol.',
    ],
  },
  {
    q: 'What happens when a token graduates?',
    a: 'When the bonding curve raises 5 ETH, the contract automatically creates a Uniswap liquidity pool, deposits the remaining tokens and raised ETH into it, then burns the LP tokens to 0xdead. After that the token trades freely on the DEX and the curve is permanently closed.',
  },
  {
    q: 'Can the creator rug?',
    a: 'There is no creator tax built into the protocol. The deployer cannot pull funds from the bonding curve. After graduation the LP is burned on-chain and is not controlled by anyone. The factory contract is non-upgradeable.',
  },
  {
    q: 'What is a dev buy?',
    a: 'When deploying a token you can optionally buy some at launch by sending ETH with the deploy transaction. The price is the same as anyone else would get at that moment, and the same anti-snipe rules apply if you sell early.',
  },
  {
    q: 'Where does the 5% tax go?',
    a: '1.5% buys tokens from the curve and burns them. 2% goes to holder rewards distributed automatically across all holders. 1.5% goes to the protocol treasury. Zero goes to the creator.',
  },
  {
    q: 'How are holder rewards calculated?',
    a: 'Rewards are weighted by how long you hold and how much you hold. Every wallet has a hold score that grows as: balance x seconds held. When rewards come in, they are split proportionally across all active hold scores. Selling reduces your score proportionally.',
  },
  {
    q: 'Do holder rewards stop after graduation?',
    a: 'No. After the token graduates to a DEX, there is a 3.5% tax on trades that feeds into the same reward pool. Holders keep earning as long as people are trading.',
  },
  {
    q: 'What chain is Stackr on?',
    a: 'Base mainnet. Make sure your wallet is connected to Base before trading or deploying.',
  },
  {
    q: 'Is the smart contract audited?',
    a: 'Not yet. This is an early version of the protocol. Only trade what you can afford to lose.',
  },
  {
    q: 'What is the total supply of each token?',
    a: '1,000,000,000 tokens (1 billion). Fixed at deploy time. No mint function exists.',
  },
  {
    q: 'Can I deploy a token on any token name or ticker?',
    a: 'Yes. The factory does not check for duplicates. Anyone can use any name. Do your own verification before buying a token.',
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

        <div className="mt-10 pt-4 border-t-2 border-border flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span>Stackr / Base Mainnet</span>
          <span>{faqs.length} questions</span>
        </div>
      </main>
    </div>
  );
}
