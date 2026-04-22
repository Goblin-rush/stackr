import { Navbar } from '@/components/layout/Navbar';

export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 md:px-8 py-10">
        <div className="border-b-4 border-foreground pb-4 mb-8">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground mb-2">
            Legal
          </div>
          <h1 className="text-4xl font-black tracking-tight text-foreground">
            Disclaimer
          </h1>
        </div>

        <div className="space-y-6 text-[14px] text-foreground/80 leading-relaxed">
          <section>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-2">Not Financial Advice</h2>
            <p>
              Nothing on this platform is financial advice, investment advice, or a solicitation to buy or sell any asset.
              Stackr is a tool. What you do with it is your own decision and your own responsibility.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-2">No Guarantees</h2>
            <p>
              Token prices on bonding curves can go to zero. Most tokens launched on any platform fail.
              Past performance of any token means nothing for future price. Do not put in money you cannot afford to lose.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-2">Smart Contract Risk</h2>
            <p>
              The contracts powering this platform have not been audited by a third party. Smart contracts can contain
              bugs. Interacting with unaudited contracts carries risk. You interact with these contracts at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-2">Non-Custodial</h2>
            <p>
              Stackr is non-custodial. We do not hold your funds, control your wallet, or have the ability to reverse
              any transaction. All transactions are final once confirmed on-chain.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-2">Jurisdictional Restrictions</h2>
            <p>
              By using this platform you confirm that you are not located in a jurisdiction where using decentralized
              finance applications is restricted or prohibited. It is your responsibility to know and follow the laws
              of your country.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-2">Third-Party Tokens</h2>
            <p>
              Anyone can deploy a token on Stackr. The presence of a token on this platform is not an endorsement.
              We do not verify token names, tickers, or the identity of deployers. Always do your own research before
              buying any token.
            </p>
          </section>

          <section>
            <h2 className="text-[12px] font-bold uppercase tracking-widest text-foreground mb-2">No Liability</h2>
            <p>
              To the maximum extent permitted by law, Stackr and its contributors disclaim all liability for losses
              incurred through use of this platform, including but not limited to trading losses, smart contract
              exploits, and interface bugs.
            </p>
          </section>
        </div>

        <div className="mt-14 pt-4 border-t-2 border-border text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Last updated: April 2026
        </div>
      </main>
    </div>
  );
}
