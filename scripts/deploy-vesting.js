const { ethers } = require("hardhat");

async function deploy() {
  const token = "0x25356aeca4210ef7553140edb9b8026089e49396";

  const factory = await ethers.getContractFactory("LendleVesting");
  const vestingContract = await factory.deploy(token);
  await vestingContract.waitForDeployment();
  console.log("Vesting deployed to:", vestingContract.target);
}

deploy().catch((error) => {
  console.error(error);
  process.exit(1);
});
