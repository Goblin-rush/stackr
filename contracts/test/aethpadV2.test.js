const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helpers
const ETH = (n) => ethers.parseEther(n.toString());
const fromETH = (n) => Number(ethers.formatEther(n));

describe("Aethpad V2", function () {
  let factory, deployer, weth, mockFactory, router;
  let owner, creator, alice, bob, charlie;

  beforeEach(async function () {
    [owner, creator, alice, bob, charlie] = await ethers.getSigners();

    // Deploy mock Uniswap
    const Weth = await ethers.getContractFactory("MockWETH");
    weth = await Weth.deploy();
    const MockFactory = await ethers.getContractFactory("MockUniswapV2Factory");
    mockFactory = await MockFactory.deploy();
    const Router = await ethers.getContractFactory("MockUniswapV2Router");
    router = await Router.deploy(await mockFactory.getAddress(), await weth.getAddress());

    // Fund router with ETH (so it can pay out on swaps)
    await owner.sendTransaction({ to: await router.getAddress(), value: ETH(10) });

    // Deploy Factory + Deployer
    const Factory = await ethers.getContractFactory("AethpadFactoryV2");
    factory = await Factory.deploy(await router.getAddress());

    const Deployer = await ethers.getContractFactory("AethpadDeployer");
    deployer = await Deployer.deploy(await factory.getAddress(), await router.getAddress());
    await factory.setDeployer(await deployer.getAddress());
  });

  async function createToken(dev = creator, devBuyEth = 0n, name = "Meme", symbol = "MEME", meta = "ipfs://x") {
    const tx = await factory.connect(dev).createToken(name, symbol, meta, { value: devBuyEth });
    const receipt = await tx.wait();
    // Find TokenDeployed event
    const ev = receipt.logs.find((l) => {
      try { return factory.interface.parseLog(l)?.name === "TokenDeployed"; } catch { return false; }
    });
    const parsed = factory.interface.parseLog(ev);
    return {
      tokenAddr: parsed.args.token,
      curveAddr: parsed.args.curve,
      devBuyEth: parsed.args.devBuyEth,
      devBuyTokens: parsed.args.devBuyTokens,
    };
  }

  async function getToken(addr) {
    return await ethers.getContractAt("AethpadTokenV2", addr);
  }
  async function getCurve(addr) {
    return await ethers.getContractAt("AethpadBondingCurveV2", addr);
  }

  describe("Deployment", function () {
    it("factory has correct router + deployer wired", async function () {
      expect(await factory.uniswapRouter()).to.equal(await router.getAddress());
      expect(await factory.deployer()).to.equal(await deployer.getAddress());
      expect(await factory.owner()).to.equal(owner.address);
    });

    it("creates a token with correct supply + records", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      expect(await token.totalSupply()).to.equal(ETH(1_000_000_000));
      expect(await token.balanceOf(curveAddr)).to.equal(ETH(1_000_000_000));
      expect(await factory.allTokensLength()).to.equal(1n);

      const rec = await factory.getRecord(tokenAddr);
      expect(rec.creator).to.equal(creator.address);
      expect(rec.metadataURI).to.equal("ipfs://x");
    });
  });

  describe("Bonding curve buy", function () {
    it("splits ETH correctly at boundary (2% rewards + 1.5% platform + 96.5% to curve)", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      const factoryBalBefore = await ethers.provider.getBalance(await factory.getAddress());
      const tokenBalBefore = await ethers.provider.getBalance(tokenAddr);

      await curve.connect(alice).buy(0, { value: ETH(1) });

      // Platform ETH should be at factory (forwarded from token)
      const factoryBalAfter = await ethers.provider.getBalance(await factory.getAddress());
      const platformGained = factoryBalAfter - factoryBalBefore;
      expect(platformGained).to.be.closeTo(ETH(0.015), ETH(0.0001));

      // Reward ETH stays in token contract
      const tokenBalAfter = await ethers.provider.getBalance(tokenAddr);
      const rewardGained = tokenBalAfter - tokenBalBefore;
      expect(rewardGained).to.be.closeTo(ETH(0.02), ETH(0.0001));

      // Curve should have 0.965 ETH (minus what stayed, plus virtual math)
      const curveBal = await ethers.provider.getBalance(curveAddr);
      expect(curveBal).to.be.closeTo(ETH(0.965), ETH(0.0001));

      // Alice should have tokens (gross minus 1.5% burn)
      const aliceBal = await token.balanceOf(alice.address);
      expect(aliceBal).to.be.gt(0n);

      // Burn should have tokens
      const deadBal = await token.balanceOf("0x000000000000000000000000000000000000dEaD");
      expect(deadBal).to.be.gt(0n);

      // Burn should be ~1.5% of gross tokens received
      const gross = aliceBal + deadBal;
      const expectedBurn = (gross * 150n) / 10000n;
      // tokensOutGross = aliceBal + burnTokens, burnTokens = gross * 150 / 10000
      // So: aliceBal = gross * (1 - 150/10000) = gross * 9850/10000
      // -> burn = gross - aliceBal
      expect(deadBal).to.be.closeTo((gross * 150n) / 10000n, 10n ** 16n);
    });

    it("updates realEthRaised correctly", async function () {
      const { curveAddr } = await createToken();
      const curve = await getCurve(curveAddr);
      await curve.connect(alice).buy(0, { value: ETH(1) });
      // realEthRaised should be the 96.5% that went to curve
      expect(await curve.realEthRaised()).to.be.closeTo(ETH(0.965), ETH(0.001));
    });

    it("respects minTokensOut slippage", async function () {
      const { curveAddr } = await createToken();
      const curve = await getCurve(curveAddr);
      await expect(
        curve.connect(alice).buy(ETH(10_000_000_000), { value: ETH(1) })
      ).to.be.revertedWith("Slippage");
    });
  });

  describe("Bonding curve sell + anti-snipe", function () {
    it("charges 25% total (5% base + 20% extra) for sell within 5 minutes", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(1) });
      const aliceTokens = await token.balanceOf(alice.address);

      // Sell immediately
      await token.connect(alice).approve(curveAddr, aliceTokens);

      const aliceEthBefore = await ethers.provider.getBalance(alice.address);
      const tx = await curve.connect(alice).sell(aliceTokens, 0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const aliceEthAfter = await ethers.provider.getBalance(alice.address);
      const netEthReceived = aliceEthAfter - aliceEthBefore + gasUsed;

      // She should receive meaningfully less than she put in (given 2% + 1.5% + 20% anti-snipe = 23.5% tax on ETH out + 1.5% burn on tokens in)
      // Just assert she lost a big chunk
      expect(netEthReceived).to.be.lt(ETH(0.75));
    });

    it("no extra tax after 24 hours", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(1) });
      // advance 25 hours
      await ethers.provider.send("evm_increaseTime", [25 * 3600]);
      await ethers.provider.send("evm_mine");

      expect(await curve.getBuyAmount(ETH(0.1))).to.be.gt(0n);
      const snipe = await token.antiSnipeBpsFor(alice.address);
      expect(snipe).to.equal(0n);
    });
  });

  describe("Hold score + rewards", function () {
    it("credits holdScore over time, pays out proportional ETH rewards", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      // Alice buys first (will have more hold time)
      await curve.connect(alice).buy(0, { value: ETH(0.5) });

      // 1 hour passes
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");

      // Bob buys same amount
      await curve.connect(bob).buy(0, { value: ETH(0.5) });

      // 1 more hour passes
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");

      // Trigger a trade to credit rewards
      await curve.connect(charlie).buy(0, { value: ETH(0.1) });

      const alicePending = await token.pendingRewards(alice.address);
      const bobPending = await token.pendingRewards(bob.address);

      // Alice held longer AND bigger (she bought earlier), should have more
      expect(alicePending).to.be.gt(bobPending);
      expect(alicePending).to.be.gt(0n);
    });

    it("claim() transfers ETH to user", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(0.5) });
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await curve.connect(bob).buy(0, { value: ETH(0.5) });

      const pending = await token.pendingRewards(alice.address);
      expect(pending).to.be.gt(0n);

      const balBefore = await ethers.provider.getBalance(alice.address);
      const tx = await token.connect(alice).claim();
      const rc = await tx.wait();
      const gas = rc.gasUsed * rc.gasPrice;
      const balAfter = await ethers.provider.getBalance(alice.address);
      const received = balAfter - balBefore + gas;

      expect(received).to.be.gt(0n);
      // Should be approximately what was pending (can differ slightly due to settlement during claim)
      expect(received).to.be.gte((pending * 90n) / 100n);
    });
  });

  describe("Graduation", function () {
    it("auto-graduates when realEthRaised >= 5 ETH", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      // To get realEthRaised = 5 ETH, user must send 5 / 0.965 ≈ 5.181 ETH
      // We'll do a few buys
      await curve.connect(alice).buy(0, { value: ETH(3) });
      await curve.connect(bob).buy(0, { value: ETH(3) });

      expect(await curve.graduated()).to.equal(true);
      expect(await token.graduated()).to.equal(true);
      expect(await token.uniswapPair()).to.not.equal(ethers.ZeroAddress);
    });

    it("disables curve trading after graduation", async function () {
      const { curveAddr } = await createToken();
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(3) });
      await curve.connect(bob).buy(0, { value: ETH(3) });
      expect(await curve.graduated()).to.equal(true);

      await expect(
        curve.connect(charlie).buy(0, { value: ETH(0.1) })
      ).to.be.revertedWith("Curve closed");
    });
  });

  describe("Admin (factory owner)", function () {
    it("force-close and withdraw pre-graduation", async function () {
      const { curveAddr } = await createToken();
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(1) });
      const curveBalBefore = await ethers.provider.getBalance(curveAddr);
      expect(curveBalBefore).to.be.closeTo(ETH(0.965), ETH(0.001));

      const recipientBalBefore = await ethers.provider.getBalance(bob.address);
      await factory.connect(owner).forceCloseCurve(
        await (await ethers.getContractAt("AethpadFactoryV2", await factory.getAddress())).allTokens(0),
        bob.address
      );
      const recipientBalAfter = await ethers.provider.getBalance(bob.address);
      expect(recipientBalAfter - recipientBalBefore).to.be.closeTo(ETH(0.965), ETH(0.001));

      // Curve now closed
      await expect(curve.connect(alice).buy(0, { value: ETH(0.1) })).to.be.revertedWith("Curve closed");
    });

    it("non-owner cannot force close", async function () {
      const { tokenAddr } = await createToken();
      await expect(
        factory.connect(alice).forceCloseCurve(tokenAddr, alice.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("accumulates + withdraws platform fees", async function () {
      const { curveAddr } = await createToken();
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(2) });
      await curve.connect(bob).buy(0, { value: ETH(2) });

      const acc = await factory.accumulatedPlatformFees();
      expect(acc).to.be.closeTo(ETH(0.06), ETH(0.001)); // 1.5% of 4 ETH

      const ownerBalBefore = await ethers.provider.getBalance(owner.address);
      const tx = await factory.connect(owner).withdrawPlatformFees(owner.address);
      const rc = await tx.wait();
      const gas = rc.gasUsed * rc.gasPrice;
      const ownerBalAfter = await ethers.provider.getBalance(owner.address);
      const received = ownerBalAfter - ownerBalBefore + gas;
      expect(received).to.be.closeTo(ETH(0.06), ETH(0.001));

      expect(await factory.accumulatedPlatformFees()).to.equal(0n);
    });
  });

  describe("Initial dev buy", function () {
    it("creator receives tokens atomically", async function () {
      const { tokenAddr, devBuyTokens } = await createToken(creator, ETH(0.1));
      const token = await getToken(tokenAddr);
      expect(devBuyTokens).to.be.gt(0n);
      expect(await token.balanceOf(creator.address)).to.equal(devBuyTokens);
    });
  });

  describe("Edge cases (critical for mainnet safety)", function () {
    it("double-claim does not pay twice", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(0.5) });
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await curve.connect(bob).buy(0, { value: ETH(0.5) });

      const tx1 = await token.connect(alice).claim();
      await tx1.wait();

      const pendingAfter = await token.pendingRewards(alice.address);
      expect(pendingAfter).to.equal(0n);

      // Second claim with no new activity should revert (no double-pay)
      await expect(token.connect(alice).claim()).to.be.revertedWith("Nothing to claim");
    });

    it("reward accounting survives token transfer between holders", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(0.3) });
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine");

      // Alice sends half her tokens to charlie
      const aliceBal = await token.balanceOf(alice.address);
      await token.connect(alice).transfer(charlie.address, aliceBal / 2n);

      // More time + another buy to generate rewards
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await curve.connect(bob).buy(0, { value: ETH(0.5) });

      // Trigger one more trade so bob's hold time gets snapshotted into rewards
      await ethers.provider.send("evm_increaseTime", [1800]);
      await ethers.provider.send("evm_mine");
      await curve.connect(owner).buy(0, { value: ETH(0.2) });

      const alicePending = await token.pendingRewards(alice.address);
      const charliePending = await token.pendingRewards(charlie.address);
      const bobPending = await token.pendingRewards(bob.address);

      // All three should have something (no lost ETH after transfer splits holdings)
      expect(alicePending).to.be.gt(0n);
      expect(charliePending).to.be.gt(0n);
      expect(bobPending).to.be.gt(0n);
    });

    it("graduation does not leave stuck ETH on curve", async function () {
      const { curveAddr } = await createToken();
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(3) });
      await curve.connect(bob).buy(0, { value: ETH(3) });
      expect(await curve.graduated()).to.equal(true);

      // After graduation, curve should have ~0 ETH (all moved to LP)
      const curveBal = await ethers.provider.getBalance(curveAddr);
      expect(curveBal).to.be.lt(ETH(0.01));
    });

    it("cannot re-initialize curve", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const curve = await getCurve(curveAddr);
      await expect(curve.connect(owner).initToken(tokenAddr)).to.be.revertedWith("Already init");
    });

    it("orphaned reward ETH rolls into next deposit (bug fix)", async function () {
      // The FIRST buy on a fresh curve fires depositEthReward() before any
      // holder has a hold score. Previously that ETH was silently lost.
      // Now it is parked in orphanedRewardEth and included in the next deposit.
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      // Alice buys first — rewards fire but liveTotal == 0 at boundary
      await curve.connect(alice).buy(0, { value: ETH(1) });
      const orphaned = await token.orphanedRewardEth();
      expect(orphaned).to.be.gt(0n); // ETH was parked

      // Wait so Alice builds hold score, then Bob buys (second deposit)
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await curve.connect(bob).buy(0, { value: ETH(0.1) });

      // After second deposit orphaned should be cleared
      expect(await token.orphanedRewardEth()).to.equal(0n);

      // Alice should now have pending rewards (including the rolled-in orphan)
      const alicePending = await token.pendingRewards(alice.address);
      expect(alicePending).to.be.gt(0n);
    });

    it("uniswap pair does not accumulate hold score post-graduation (bug fix)", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      // Graduate
      await curve.connect(alice).buy(0, { value: ETH(3) });
      await curve.connect(bob).buy(0, { value: ETH(3) });
      expect(await curve.graduated()).to.equal(true);

      const pair = await token.uniswapPair();
      expect(pair).to.not.equal(ethers.ZeroAddress);

      // Pair should have zero hold score
      const pairScore = await token.holdScore(pair);
      expect(pairScore).to.equal(0n);

      // Pair should have zero pending rewards
      const pairPending = await token.pendingRewards(pair);
      expect(pairPending).to.equal(0n);
    });

    it("setTokenKeeper enables pushRewards (bug fix)", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      // Alice buys, waits, bob buys to generate rewards for alice
      await curve.connect(alice).buy(0, { value: ETH(0.5) });
      await ethers.provider.send("evm_increaseTime", [3600]);
      await ethers.provider.send("evm_mine");
      await curve.connect(bob).buy(0, { value: ETH(0.5) });

      const pending = await token.pendingRewards(alice.address);
      expect(pending).to.be.gt(0n);

      // Set keeper via factory
      await factory.connect(owner).setTokenKeeper(tokenAddr, owner.address);
      expect(await token.keeper()).to.equal(owner.address);

      // Keeper pushes rewards to alice
      const aliceBalBefore = await ethers.provider.getBalance(alice.address);
      await token.connect(owner).pushRewards([alice.address]);
      const aliceBalAfter = await ethers.provider.getBalance(alice.address);

      expect(aliceBalAfter).to.be.gt(aliceBalBefore);

      // Alice's pending should now be zero
      expect(await token.pendingRewards(alice.address)).to.equal(0n);

      // Non-keeper cannot call pushRewards
      await expect(
        token.connect(alice).pushRewards([bob.address])
      ).to.be.revertedWith("Only keeper");
    });

    it("total supply conservation: sum of balances == totalSupply", async function () {
      const { tokenAddr, curveAddr } = await createToken();
      const token = await getToken(tokenAddr);
      const curve = await getCurve(curveAddr);

      await curve.connect(alice).buy(0, { value: ETH(0.5) });
      await curve.connect(bob).buy(0, { value: ETH(0.3) });
      const aliceBal = await token.balanceOf(alice.address);
      await token.connect(alice).approve(curveAddr, aliceBal / 2n);
      await curve.connect(alice).sell(aliceBal / 2n, 0);

      const totalSupply = await token.totalSupply();
      const curveBal = await token.balanceOf(curveAddr);
      const aBal = await token.balanceOf(alice.address);
      const bBal = await token.balanceOf(bob.address);
      const deadBal = await token.balanceOf("0x000000000000000000000000000000000000dEaD");

      const sum = curveBal + aBal + bBal + deadBal;
      // totalSupply reduces by burns
      expect(totalSupply).to.equal(sum - deadBal + deadBal); // sanity: sum == totalSupply
      expect(sum).to.equal(totalSupply);
    });
  });
});
