const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const usdc = (n) => ethers.parseUnits(String(n), 6);
const id = (s) => ethers.keccak256(ethers.toUtf8Bytes(s));
const WEEK = 7 * 24 * 3600;

describe("CommitmentEscrowV2", () => {
  let token, escrow, owner, a, b, c, outsider;

  beforeEach(async () => {
    [owner, a, b, c, outsider] = await ethers.getSigners();
    token = await (await ethers.getContractFactory("MockUSDC")).deploy();
    escrow = await (await ethers.getContractFactory("CommitmentEscrowV2")).deploy(token.target);
    for (const u of [a, b, c]) {
      await token.mint(u.address, usdc(1000));
      await token.connect(u).approve(escrow.target, usdc(1000));
      await escrow.connect(u).deposit(usdc(100));
    }
  });

  describe("solo forfeit plans", () => {
    it("routes forfeits per weighted plan, remainder to last entry", async () => {
      const burn = await escrow.BURN_ADDRESS();
      // 50% burn, 30% to outsider (a "charity"), 20% back to self
      await escrow.connect(a).setForfeitPlan(
        [burn, outsider.address, a.address],
        [5000, 3000, 2000]
      );
      await escrow.connect(a).commit(id("t1"), usdc(10), (await time.latest()) + 100);
      await time.increase(200);
      await escrow.connect(b).expire(id("t1"));

      expect(await token.balanceOf(burn)).to.equal(usdc(5));
      expect(await token.balanceOf(outsider.address)).to.equal(usdc(3));
      expect(await token.balanceOf(a.address)).to.equal(usdc(900 + 2));
      expect(await escrow.platformBalance()).to.equal(0);
    });

    it("rejects plans not summing to 10000", async () => {
      await expect(
        escrow.connect(a).setForfeitPlan([a.address], [9999])
      ).to.be.revertedWith("weights must sum to 10000");
    });

    it("defaults to platform with no plan", async () => {
      await escrow.connect(a).commit(id("t2"), usdc(10), (await time.latest()) + 100);
      await time.increase(200);
      await escrow.connect(b).expire(id("t2"));
      expect(await escrow.platformBalance()).to.equal(usdc(10));
    });
  });

  describe("pod mode: parimutuel split", () => {
    const POD = id("pod1");

    beforeEach(async () => {
      const periodZero = await time.latest();
      await escrow.connect(a).createPod(
        POD, [a.address, b.address, c.address], usdc(0.2) / 60n || 3333n, 300, periodZero, WEEK
      );
    });

    it("expired pod stakes pool by period; majority split vote pays completers by stake", async () => {
      const deadline = (await time.latest()) + 3600; // inside period 0
      // A stakes $48 (4h), B stakes $12 (1h): both "complete".
      // C stakes $24 (2h) and misses -> $24 pool.
      await escrow.connect(a).commitPod(POD, id("pa"), usdc(48), deadline);
      await escrow.connect(b).commitPod(POD, id("pb"), usdc(12), deadline);
      await escrow.connect(c).commitPod(POD, id("pc"), usdc(24), deadline);
      await escrow.connect(a).complete(id("pa"));
      await escrow.connect(b).complete(id("pb"));
      await time.increase(2 * 3600);
      await escrow.connect(outsider).expire(id("pc"));
      expect(await escrow.podPool(POD, 0)).to.equal(usdc(24));

      // Week 0 over: agents compute completers-split-by-stake:
      // A: 48/60 = 8000 bps, B: 12/60 = 2000 bps, C: 0.
      await time.increase(WEEK);
      const shares = [8000, 2000, 0];
      await escrow.connect(a).votePeriodSplit(POD, 0, shares);
      await escrow.connect(b).votePeriodSplit(POD, 0, shares);
      await escrow.connect(c).votePeriodSplit(POD, 0, shares);
      await escrow.connect(outsider).resolvePeriod(POD, 0);

      const [aBal] = await escrow.getUserInfo(a.address);
      const [bBal] = await escrow.getUserInfo(b.address);
      const [cBal] = await escrow.getUserInfo(c.address);
      expect(aBal).to.equal(usdc(100 + 19.2)); // 24 * 0.8
      expect(bBal).to.equal(usdc(100 + 4.8));  // 24 * 0.2
      expect(cBal).to.equal(usdc(100 - 24));
      expect(await escrow.podPool(POD, 0)).to.equal(0);
    });

    it("no majority on mismatched splits; refund failsafe returns pool to contributors", async () => {
      const deadline = (await time.latest()) + 3600;
      await escrow.connect(c).commitPod(POD, id("pc2"), usdc(24), deadline);
      await time.increase(2 * 3600);
      await escrow.connect(outsider).expire(id("pc2"));

      await time.increase(WEEK);
      // Agents disagree (anomaly): no two vectors match.
      await escrow.connect(a).votePeriodSplit(POD, 0, [8000, 2000, 0]);
      await escrow.connect(b).votePeriodSplit(POD, 0, [5000, 5000, 0]);
      await escrow.connect(c).votePeriod(POD, 0, 4, ethers.ZeroAddress); // Recall
      await expect(escrow.resolvePeriod(POD, 0)).to.be.revertedWith("no majority");

      // Past refund deadline (periodEnd + 2 periods) anyone can trigger the failsafe.
      await time.increase(15 * 24 * 3600);
      await escrow.connect(outsider).refundPeriod(POD, 0);
      const [cBal] = await escrow.getUserInfo(c.address);
      expect(cBal).to.equal(usdc(100)); // made whole
    });

    it("majority anomaly vote can roll the pool into next period", async () => {
      const deadline = (await time.latest()) + 3600;
      await escrow.connect(a).commitPod(POD, id("pa3"), usdc(10), deadline);
      await time.increase(2 * 3600);
      await escrow.connect(outsider).expire(id("pa3"));

      await time.increase(WEEK);
      await escrow.connect(a).votePeriod(POD, 0, 7, ethers.ZeroAddress); // Rollover
      await escrow.connect(b).votePeriod(POD, 0, 7, ethers.ZeroAddress);
      await escrow.connect(c).votePeriod(POD, 0, 7, ethers.ZeroAddress);
      await escrow.connect(outsider).resolvePeriod(POD, 0);
      expect(await escrow.podPool(POD, 0)).to.equal(0);
      expect(await escrow.podPool(POD, 1)).to.equal(usdc(10));
    });

    it("supports a short period for live testing (10-min pod resolves in minutes)", async () => {
      const SHORT = id("shortpod");
      const periodLength = 600; // 10 minutes
      const wz = await time.latest();
      await escrow.connect(a).createPod(SHORT, [a.address, b.address], 3333n, 20, wz, periodLength);
      const [, , , , p] = await escrow.getPod(SHORT);
      expect(p).to.equal(periodLength);

      // b stakes and misses within period 0.
      const deadline = (await time.latest()) + 120;
      await escrow.connect(b).commitPod(SHORT, id("sp"), usdc(10), deadline);
      await time.increase(200);
      await escrow.connect(a).expire(id("sp"));
      expect(await escrow.podPool(SHORT, 0)).to.equal(usdc(10));

      // Period 0 ends 600s after periodZero; a completed nothing either, so
      // both agree the pool rolls forward — resolvable minutes in, not days.
      await time.increase(600);
      await escrow.connect(a).votePeriod(SHORT, 0, 7, ethers.ZeroAddress); // Rollover
      await escrow.connect(b).votePeriod(SHORT, 0, 7, ethers.ZeroAddress);
      await escrow.connect(a).resolvePeriod(SHORT, 0);
      expect(await escrow.podPool(SHORT, 1)).to.equal(usdc(10));
    });

    it("non-members cannot commit, log, or vote", async () => {
      await expect(
        escrow.connect(outsider).commitPod(POD, id("px"), usdc(1), (await time.latest()) + 100)
      ).to.be.revertedWith("not a member");
      await expect(
        escrow.connect(outsider).logProgress(POD, 13, 5000, 45)
      ).to.be.revertedWith("not a member");
      await time.increase(WEEK + 10);
      await expect(
        escrow.connect(outsider).votePeriodSplit(POD, 0, [10000, 0, 0])
      ).to.be.revertedWith("not a member");
    });
  });

  describe("pod membership (per-period rosters)", () => {
    const P = id("rosterpod");
    const PERIOD = 1000;
    let z;

    beforeEach(async () => {
      z = await time.latest();
      // a is creator/admin; a + b to start.
      await escrow.connect(a).createPod(P, [a.address, b.address], 3333n, 20, z, PERIOD);
    });

    it("add/remove take effect next period; past periods keep their roster", async () => {
      // Period 0: a stakes $10 and misses -> pool[0]=$10.
      await escrow.connect(a).commitPod(P, id("r0"), usdc(10), z + 300);
      await time.increase(400);
      await escrow.connect(b).expire(id("r0"));

      // Admin adds c — effective next period only.
      await escrow.connect(a).addMember(P, c.address);
      expect((await escrow.membersOf(P, 0)).length).to.equal(2); // period 0 roster unchanged
      expect((await escrow.membersOf(P, 1)).length).to.equal(3); // c joins period 1
      const [fp, lm] = await escrow.latestMembers(P);
      expect(fp).to.equal(1n);
      expect(lm).to.include(c.address);

      // Period 0 over: resolve with the 2-member roster. c cannot vote on it.
      await time.increase(700); // now > z + 1000 = end of period 0
      await expect(
        escrow.connect(c).votePeriodSplit(P, 0, [10000, 0])
      ).to.be.revertedWith("not a member");
      await escrow.connect(a).votePeriodSplit(P, 0, [10000, 0]);
      await escrow.connect(b).votePeriodSplit(P, 0, [10000, 0]);
      await escrow.connect(outsider).resolvePeriod(P, 0);
      const [aBal] = await escrow.getUserInfo(a.address);
      expect(aBal).to.equal(usdc(100)); // staked 10, missed, won the 10 back via split
    });

    it("a removed member is still refunded for a period they forfeited into", async () => {
      await escrow.connect(a).addMember(P, c.address); // -> [a,b,c] from period 1
      await time.increase(PERIOD + 10); // enter period 1

      // Period 1: c stakes $6 and misses -> pool[1]=$6, c is a contributor.
      const d = (await time.latest()) + 300;
      await escrow.connect(c).commitPod(P, id("r1"), usdc(6), d);
      await time.increase(400);
      await escrow.connect(a).expire(id("r1"));

      // Admin removes c — effective period 2. c stays a member of period 1.
      await escrow.connect(a).removeMember(P, c.address);
      expect((await escrow.membersOf(P, 2)).length).to.equal(2);
      expect(await escrow.membersOf(P, 1)).to.include(c.address);

      // Nobody reaches majority on period 1; past the refund window c is made whole.
      await time.increase(PERIOD * 3);
      await escrow.connect(outsider).refundPeriod(P, 1);
      const [cBal] = await escrow.getUserInfo(c.address);
      expect(cBal).to.equal(usdc(100)); // forfeit returned despite being removed
    });

    it("guards: only admin changes the roster, and never below 2 members", async () => {
      await expect(escrow.connect(b).addMember(P, c.address)).to.be.revertedWith("not admin");
      await expect(escrow.connect(a).removeMember(P, b.address)).to.be.revertedWith("min 2 members");
      // Accumulated changes in the same pending period: add c then remove b -> [a,c].
      await escrow.connect(a).addMember(P, c.address);
      await escrow.connect(a).removeMember(P, b.address);
      const [, lm] = await escrow.latestMembers(P);
      expect(lm.map((x) => x.toLowerCase())).to.have.members([a.address.toLowerCase(), c.address.toLowerCase()]);
      expect(await escrow.podAdmin(P)).to.equal(a.address);
    });
  });
});
