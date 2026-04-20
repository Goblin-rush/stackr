import React from 'react';

const CONTRACT_ADDRESS = '0xbf06930f29d047823541c7726142a30aa9a8cddc';

export default function ArticlePage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#080c14]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-bold text-sm tracking-wide text-[#f59e0b]">Asteroid Shiba STR</a>
          <a href="/" className="text-xs text-white/40 hover:text-white transition-colors">Back to Presale</a>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-24 pb-20">

        {/* Header */}
        <div className="mb-12 space-y-4">
          <p className="text-xs text-[#f59e0b] uppercase tracking-widest font-semibold">The Full Story</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
            The Shiba Inu That Went to Space — And Became a Token
          </h1>
          <p className="text-white/50 text-sm">A 15-year-old cancer survivor, a SpaceX mission, and a viral moment that started everything.</p>
          <div className="h-px bg-white/[0.07]" />
        </div>

        {/* Article body */}
        <div className="space-y-10 text-white/75 leading-relaxed text-[15px]">

          {/* Section 1 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Who Is Liv Perrotto?</h2>
            <p>
              Liv Perrotto is a 15-year-old pediatric cancer survivor and patient at St. Jude Children's Research Hospital in Memphis, Tennessee. St. Jude is one of the world's leading children's cancer research hospitals — a place that treats kids regardless of their family's ability to pay, and never sends a family a bill for treatment, housing, food, or transportation.
            </p>
            <p>
              Liv's journey through illness and treatment shaped her into someone with an extraordinary sense of imagination and resilience. During her time as a patient, she channeled her energy into art and design — and out of that creativity came something that would eventually fly to space.
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Creating "Asteroid" — The Shiba Inu Plush</h2>
            <p>
              Inspired by Elon Musk's own Shiba Inu dog, Floki, Liv designed and created a Shiba Inu plush toy she named "Asteroid." The name itself carries double meaning — a nod to the cosmos, to space travel, and to something small that can have an enormous impact when it hits its target.
            </p>
            <p>
              The plush features Asteroid's signature look: warm golden-orange fur, a soft gray astronaut spacesuit hoodie, and the quiet dignity of a dog that belongs among the stars. It was hand-crafted with care — not manufactured by a company, but made by a kid with a dream and a story to tell.
            </p>
            <p>
              What Liv could not have known when she made Asteroid was that this little plush would soon become something much bigger than a toy.
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">SpaceX Calls: The Polaris Dawn Mission</h2>
            <p>
              Polaris Dawn was a historic SpaceX mission — the first private spacewalk in history, conducted aboard the Crew Dragon "Resilience." The mission launched on September 10, 2024, carrying a crew of four: Jared Isaacman (mission commander and billionaire entrepreneur), Scott Poteet, Sarah Gillis, and Anna Menon.
            </p>
            <p>
              One tradition on crewed spaceflights is carrying a "zero-gravity indicator" — a small object that floats freely once the spacecraft reaches orbit, visually confirming to viewers on Earth that the crew has entered microgravity. Historically these have been plush toys or stuffed animals.
            </p>
            <p>
              SpaceX invited Liv Perrotto to design the zero-gravity indicator for the Polaris Dawn mission. Her creation — Asteroid, the Shiba Inu plush — was chosen to fly aboard the Crew Dragon Resilience, representing hope, resilience, and the spirit of a young cancer fighter who refused to let her circumstances define her ceiling.
            </p>
          </div>

          {/* Image */}
          <div className="rounded-2xl overflow-hidden border border-white/[0.07]">
            <img src="/banner.jpg" alt="Asteroid Shiba in space" className="w-full object-cover" />
            <p className="text-[11px] text-white/25 px-4 py-2 bg-white/[0.02]">Asteroid floating aboard SpaceX Crew Dragon Resilience during the Polaris Dawn mission.</p>
          </div>

          {/* Section 4 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">September 10, 2024 — Asteroid Goes to Space</h2>
            <p>
              On September 10, 2024, as the Crew Dragon Resilience broke through Earth's atmosphere and entered orbit, Asteroid floated free from the hands of the crew and drifted weightlessly in the cabin. For a brief, beautiful moment, a little handmade Shiba Inu plush — designed by a 15-year-old cancer patient from St. Jude — was orbiting Earth.
            </p>
            <p>
              Asteroid became the world's first Shiba Inu in space.
            </p>
            <p>
              The moment was captured on camera and broadcast to millions watching the mission livestream. It was the kind of image that stops you — small, quiet, and overwhelming at the same time. A stuffed dog, a kid's dream, in the blackness of space with the curve of the Earth below.
            </p>
          </div>

          {/* Section 5 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Elon Musk Replies — The 68,000% Moment</h2>
            <p>
              After the mission, word spread on social media about Asteroid and Liv's story. A post about the $ASTEROID token — inspired by the plush and Liv's journey — caught significant attention online.
            </p>
            <p>
              Elon Musk replied: <span className="text-white font-semibold italic">"Will answer shortly."</span>
            </p>
            <p>
              That single reply from one of the most followed accounts on the internet sent the original $ASTEROID token surging <span className="text-[#f59e0b] font-bold">68,000%</span>.
            </p>
            <p>
              The motto that emerged from that moment has become the heartbeat of everything this project stands for:
            </p>
            <blockquote className="border-l-2 border-[#f59e0b]/50 pl-4 text-white/60 italic">
              "If Asteroid can go to space, so can you."
            </blockquote>
          </div>

          {/* Section 6 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">What Is $ASTEROID — The Strategy Token</h2>
            <p>
              $ASTEROID is not a meme coin. It is a <span className="text-white font-semibold">strategy token</span> built on Ethereum Mainnet (ERC-20).
            </p>
            <p>
              The core difference between a strategy token and a meme coin is mechanism. Meme coins rely entirely on hype and social momentum to sustain price. Strategy tokens are built with structural mechanisms that create consistent buy pressure — in $ASTEROID's case, that mechanism is an <span className="text-white font-semibold">automatic buyback system</span>.
            </p>
            <p>
              A portion of every transaction fee collected by the protocol is used to automatically purchase $ASTEROID tokens from the open market. These buybacks reduce circulating supply over time and create sustained upward pressure on price — independent of whether or not the social hype cycle continues.
            </p>
            <p>
              The token contract is deployed on Ethereum at:
            </p>
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3">
              <code className="font-mono text-xs text-white/60 break-all">{CONTRACT_ADDRESS}</code>
            </div>
          </div>

          {/* Section 7 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">How the Buyback Mechanism Works</h2>
            <p>
              Every time $ASTEROID is bought or sold on a decentralized exchange, a transaction fee is collected by the protocol. This fee is not distributed to team wallets or marketing funds — it is used exclusively to buy $ASTEROID back from the market.
            </p>
            <p>
              Here is what this means in practice:
            </p>
            <ul className="space-y-3 pl-4">
              {[
                'Every sell creates fees that are used to buy more tokens — partially counteracting the downward pressure of selling.',
                'Every buy creates fees that compound the upward pressure already created by the buy itself.',
                'Over time, the circulating supply decreases as bought-back tokens are removed from circulation.',
                'The mechanism operates automatically via smart contract — no human intervention required.',
              ].map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span className="text-[#f59e0b] font-bold shrink-0 mt-0.5">{i + 1}.</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>
              This is why $ASTEROID is a strategy token — the strategy is built into the contract itself.
            </p>
          </div>

          {/* Section 8 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">St. Jude Children's Research Hospital</h2>
            <p>
              St. Jude Children's Research Hospital has treated Liv throughout her cancer journey. It is one of the most respected pediatric cancer research institutions in the world, founded on the principle that no family should ever receive a bill for their child's cancer treatment.
            </p>
            <p>
              <span className="text-white font-semibold">10% of all presale proceeds</span> are sent directly to St. Jude Children's Research Hospital. This is not a pledge or a promise — it is a hardcoded allocation that will be executed on-chain and publicly verifiable on Etherscan the moment the presale closes.
            </p>
            <p>
              Every wallet address that participates in the $ASTEROID presale is directly contributing to pediatric cancer research. The transaction hash of the St. Jude donation will be posted publicly so anyone can verify it.
            </p>
          </div>

          {/* Section 9 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Token Allocation — Where the Supply Goes</h2>
            <div className="space-y-3">
              {[
                { pct: '40%', label: 'Presale', detail: 'Allocated to presale participants — early supporters who believe in the project from day one.', color: '#f59e0b' },
                { pct: '30%', label: 'Liquidity Pool (Uniswap)', detail: 'Locked for 1 year on Uniswap. This ensures stable, manipulation-resistant trading from the moment the token goes live.', color: '#a855f7' },
                { pct: '20%', label: 'Buyback Reserve', detail: 'Dedicated to the automatic buyback mechanism that creates ongoing buy pressure independent of market conditions.', color: '#22c55e' },
                { pct: '10%', label: 'St. Jude Charity', detail: 'Sent directly to St. Jude\'s verified wallet on-chain, publicly verifiable by anyone.', color: '#f97316' },
              ].map(({ pct, label, detail, color }) => (
                <div key={label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex gap-4">
                  <div className="text-2xl font-extrabold shrink-0 w-14" style={{ color }}>{pct}</div>
                  <div>
                    <p className="font-semibold text-white text-sm mb-0.5">{label}</p>
                    <p className="text-white/45 text-xs leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 10 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">The Presale — How to Participate</h2>
            <p>
              The $ASTEROID presale is live now. Participation is simple and requires no wallet connection on this site:
            </p>
            <ol className="space-y-4 pl-4">
              {[
                { step: 'Copy the presale wallet address below.', detail: 'This is the Ethereum address that receives all presale contributions.' },
                { step: 'Send ETH from your Ethereum wallet.', detail: 'Minimum: 0.01 ETH. Maximum: 2 ETH per wallet. Do not send from an exchange — use a self-custody wallet like MetaMask, Rabby, or Coinbase Wallet.' },
                { step: 'Record your sending wallet address.', detail: 'Tokens will be airdropped to the wallet you sent ETH from after the presale closes.' },
                { step: 'Wait for the presale to close.', detail: 'The presale closes April 24, 2026. Within 48 hours of closing, liquidity will be deployed on Uniswap and $ASTEROID will go live.' },
              ].map(({ step, detail }, i) => (
                <li key={i} className="flex gap-4">
                  <div className="w-6 h-6 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[10px] font-bold text-[#f59e0b]">{i + 1}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{step}</p>
                    <p className="text-white/45 text-xs mt-0.5 leading-relaxed">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="bg-white/[0.03] border border-[#f59e0b]/20 rounded-xl p-4 space-y-1">
              <p className="text-[10px] text-white/40 uppercase tracking-widest">Presale Wallet Address</p>
              <code className="font-mono text-sm text-white/80 break-all">{CONTRACT_ADDRESS}</code>
            </div>
            <p className="text-xs text-white/30">Hard Cap: 30 ETH. Soft Cap: 15 ETH. Presale ends April 24, 2026.</p>
          </div>

          {/* Section 11 */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white">Why This Matters</h2>
            <p>
              There are thousands of tokens. Most of them are nothing — no story, no mechanism, no reason to exist beyond the moment of launch hype.
            </p>
            <p>
              $ASTEROID is different because the story is real. Liv Perrotto is real. Polaris Dawn happened. Elon Musk's reply happened. St. Jude is real. The buyback mechanism is real.
            </p>
            <p>
              When a 15-year-old cancer patient's handmade plush toy orbits the Earth aboard a SpaceX spacecraft — and that moment becomes the foundation of a token — something rare has happened. The story gives the token meaning. The mechanism gives it structure. The charity gives it purpose.
            </p>
            <p className="text-white italic font-medium text-lg border-l-2 border-[#f59e0b]/50 pl-4">
              "If Asteroid can go to space, so can you."
            </p>
          </div>

          {/* CTA */}
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6 text-center space-y-4">
            <h3 className="text-xl font-bold text-white">Join the Presale</h3>
            <p className="text-white/50 text-sm">4 days remaining. 30 ETH hard cap. Tokens airdropped after presale closes.</p>
            <a href="/" className="inline-block w-full py-3.5 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] text-black font-bold text-sm transition-colors">
              Go to Presale
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
