const { ethers } = require("hardhat");

async function deploy() {
  const factory = await ethers.getContractFactory("ProtocolRevenueDistribution");
  const prd = await factory.deploy();
  await prd.waitForDeployment();
  console.log("ProtocolRevenueDistribution Impl deployed to:", prd.target);
}

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});