const { expect } = require("chai");
const { ethers } = require("hardhat");

const ownerAddr = '0x0c38845C2587e2fb0b7fba1cfB27f260F74066Aa';
const poolAdminAddr = '0xB6eEdA94Bbb926881489F32489092C28e1a92484';
const router = '0xD9F4e85489aDCD0bAF0Cd63b4231c6af58c26745';
const lendingPool = '0xCFa5aE7c2CE8Fadc6426C1ff872cA45378Fb7cF3';
const lendTokenAddr = "0x25356aeca4210eF7553140edb9b8026089E49396";
let stakingConfigurator, prdProxy;
let poolAdmin, owner, prd, deployer;

const ausd = "0x90f22aa619217765c8ea84b18130ff60ad0d5de1";
const usdc = "0xf36afb467d1f05541d998bbbcd5f7167d67bd8fc";
const usdt = "0xe71cbaaa6b093fce66211e6f218780685077d8b5";
const cmeth = "0x68a1b2756b41ce837d73a801e18a06e13eac50e1";
const meth = "0x0e927aa52a38783c1fd5dfa5c8873cbdbd01d2ca";
const weth = "0x787cb0d29194f0faca73884c383cf4d2501bb874";
const usde = "0x2cfa1e69c8a8083aa52cfcf22d8caff7521e1e7e";
const susde = "0x8e3f5e745a030a384fbd19c97a56da5337147376";
const mnt = "0x683696523512636b46a826a7e3d1b0658e8e2e1c";
const fbtc = "0xdef3542bb1b2969c1966dd91ebc504f4b37462fe";
const wbtc = "0x44cccbbd7a5a9e2202076ea80c185da0058f1715";

let reserves, paths;

const aTokens = [ausd, usdc, usdt, cmeth, meth, weth, usde, susde, mnt, fbtc, wbtc];

const ODOS_QUOTE_API = 'https://api.odos.xyz/sor/quote/v2';
const ODOS_ASSEMBLE_API = 'https://api.odos.xyz/sor/assemble';

async function buildPaths(prdProxy) {
  reserves = [];
  paths = [];

  for (let i = 0; i < aTokens.length; i++) {
    const reserve = aTokens[i]; // this is aToken address
    const aToken = await ethers.getContractAt("IAToken", reserve);

    // balance of prdProxy in this reserve
    const balance = await aToken.balanceOf(prdProxy.target);
    if (balance == 0) continue;

    const halfBalance = balance / 2n;

    // underlying asset of this aToken
    const underlying = await aToken.UNDERLYING_ASSET_ADDRESS();

    // build ODOS quote body
    const quoteBody = {
      chainId: 5000,
      inputTokens: [
        {
          tokenAddress: underlying,
          amount: halfBalance.toString(),
        },
      ],
      outputTokens: [
        {
          tokenAddress: lendTokenAddr,
          proportion: 1,
        },
      ],
      userAddr: prdProxy.target,
      slippageLimitPercent: 5,
      referralCode: 0,
      disableRFQs: true,
      compact: true,
    };

    const quoteResp = await fetch(ODOS_QUOTE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quoteBody),
    });
    const quoteJson = await quoteResp.json();
    if (!quoteJson.pathId) continue;

    // call assemble API
    const assembleBody = {
      userAddr: prdProxy.target,
      pathId: quoteJson.pathId,
      simulate: false,
      receiver: ownerAddr, // where funds go after swap
    };

    const assembleResp = await fetch(ODOS_ASSEMBLE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assembleBody),
    });
    const assembleJson = await assembleResp.json();
    if (!assembleJson.transaction.data) continue;

    // push the call data
    reserves.push(aToken);
    paths.push(assembleJson.transaction.data);
  }

  return {reserves, paths};
}

describe("Test ProtocolRevenueDistribution", function () {
  beforeEach(async function () {
    [deployer] = await ethers.getSigners();

    owner = await ethers.getImpersonatedSigner(ownerAddr);
    await deployer.sendTransaction({
      value: ethers.parseEther("1"),
      to: ownerAddr,
    });

    poolAdmin = await ethers.getImpersonatedSigner(poolAdminAddr);
    await deployer.sendTransaction({
      value: ethers.parseEther("1"),
      to: poolAdminAddr,
    });

    const Prd = await ethers.getContractFactory("ProtocolRevenueDistribution");
    prd = await Prd.deploy();
    await prd.waitForDeployment();

    const Lend = await ethers.getContractFactory("LendleToken");
    lendToken = Lend.attach(lendTokenAddr);

    const StakingConfigurator = await ethers.getContractFactory("StakingConfigurator");
    stakingConfigurator = StakingConfigurator.attach('0xE5F9fFc0D0D70EED59364b44B1F11900B39dB37B');

    await stakingConfigurator.connect(poolAdmin).setProtocolRevenueDistributionImpl(prd.target, "0x");

    const Proxy = await ethers.getContractFactory("ProtocolRevenueDistribution");
    prdProxy = Proxy.attach("0x53B7183cfF6d109189165e7eE4C1Ebb922E1E6E5");
  });

  context("setDistributor()", function () {
    it("should allow to set distributor correctly", async function () {
      await prdProxy.connect(owner).setDistributor(ownerAddr);

      expect(await prdProxy.distributor()).to.equal(ownerAddr);
    });
  });

  context("distribute()", function () {
    it("should allow to distribute revenue correctly", async function () {
      this.timeout(120000);

      await prdProxy.initAddresses(lendingPool, router);
      await prdProxy.connect(owner).setDistributor(ownerAddr);

      const { reserves, paths } = await buildPaths(prdProxy);

      console.log('Reserves and paths have been built');

      const balanceBefore = await lendToken.balanceOf(owner);
      console.log('Balance before: ', balanceBefore.toString());
      const gas  = await prdProxy.estimateGas["distribute(address[],bytes[])"](reserves, paths);
      console.log('Gas: ', gas.toString());
      await prdProxy.connect(owner).distribute(reserves, paths);

      const balanceAfter = await lendToken.balanceOf(owner);
      console.log('Balance after: ', balanceAfter.toString());
    });
  });
});
