const { ethers } = require("hardhat");

async function deploy() {
  const token = "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34";

  const factory = await ethers.getContractFactory("LendleVesting");
  const vestingContract = await factory.deploy(token);
  await vestingContract.waitForDeployment();
  console.log("Vesting deployed to:", vestingContract.target);
}

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});
