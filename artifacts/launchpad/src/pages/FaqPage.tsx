import { Navbar } from '@/components/layout/Navbar';

const faqs: { q: string; a: string | string[] }[] = [
  {
    q: 'What is Stackr?',
    a: 'Stackr is a token launchpad on Base and Ethereum mainnet. Anyone can deploy a token with real Uniswap V4 liquidity from day one — no bonding curve. Every trade automatically distributes ETH rewards to holders.',
  },
  {
    q: 'How does trading work?',
    a: 'Tokens on Stackr trade directly on Uniswap V4 from the moment they launch. There is no bonding curve and no graduation step. Real liquidity, real price discovery from block one.',
  },
  {
    q: 'Do I need to do anything to receive holder rewards?',
    a: 'No. Just hold the token. Every time someone buys or sells, 1.5% of the trade value is automatically sent to holders as ETH. No claiming, no staking.',
  },
  {
    q: 'Where does the 3% tax go?',
    a: [
      'Every buy and sell has a 3% swap tax, split as:',
      '1.5% → distributed to token holders as ETH',
      '1.5% → platform treasury',
      '0.3% → Uniswap V4 LP fee (separate)',
      'Zero goes to the creator.',
    ],
  },
  {
    q: 'Can the creator rug?',
    a: 'No. The factory contract is non-upgradeable. The creator has no special access to the liquidity pool or the reward distribution. Everything is handled by the smart contract.',
  },
  {
    q: 'What chains is Stackr on?',
    a: 'Base mainnet and Ethereum mainnet. You can launch and trade on either chain — just make sure your wallet is connected to the right network.',
  },
  {
    q: 'What is the total supply of each token?',
    a: '1,000,000,000 tokens (1 billion). Fixed at deploy time. No mint function exists.',
  },
  {
    q: 'Is the smart contract audited?',
    a: 'Not yet. This is an early version of the protocol. Only trade what you can afford to lose.',
  },
  {
    q: 'Can I deploy a token with any name or ticker?',
    a: 'Yes. The factory does not check for duplicates. Anyone can use any name. Do your own verification before buying.',
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
