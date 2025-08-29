const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function createVestingSchedules() {
  try {
    console.log("🚀 Starting vesting schedule creation...\n");

    // Read the JSON file
    const jsonPath = path.join(__dirname, "../contracts/vesting/vesting-schedules.json");
    
    if (!fs.existsSync(jsonPath)) {
      throw new Error(`JSON file not found at: ${jsonPath}`);
    }
    
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    
    const { vestingSchedules, config } = jsonData;
    
    // Validate JSON structure
    if (!vestingSchedules || !Array.isArray(vestingSchedules)) {
      throw new Error("Invalid JSON structure: 'vestingSchedules' array is required");
    }
    
    if (!config) {
      throw new Error("Invalid JSON structure: 'config' object is required");
    }
    
    // Validate config
    if (!config.vestingContractAddress || config.vestingContractAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Please set a valid vesting contract address in the JSON config");
    }

    console.log(`📋 Found ${vestingSchedules.length} vesting schedules to create`);
    console.log(`🏗️  Vesting Contract: ${config.vestingContractAddress}`);
    console.log(`🌐 Network: ${config.network}\n`);

    // Get the vesting contract
    const vestingContract = await ethers.getContractAt("LendleVesting", config.vestingContractAddress);
    console.log("✅ Connected to vesting contract");

    // Get token address from contract
    const tokenAddress = await vestingContract.getToken();
    console.log(`🪙 Token Address: ${tokenAddress}`);

    // Get token contract
    const tokenContract = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", tokenAddress);
    
    // Check contract balance
    const contractBalance = await tokenContract.balanceOf(config.vestingContractAddress);
    console.log(`💰 Contract Balance: ${ethers.formatUnits(contractBalance, 18)} tokens`);

    // Calculate total required amount
    const totalRequired = vestingSchedules.reduce((sum, schedule) => {
      return sum + BigInt(schedule.amount);
    }, 0n);
    
    console.log(`📊 Total Required: ${ethers.formatUnits(totalRequired, 18)} tokens`);

    if (contractBalance < totalRequired) {
      console.log(`⚠️  Warning: Insufficient tokens in contract. Need ${ethers.formatUnits(totalRequired, 18)}, but have ${ethers.formatUnits(contractBalance, 18)}`);
      console.log(`💡 Please transfer more tokens to the contract before proceeding.`);
      console.log(`   Required: ${ethers.formatUnits(totalRequired, 18)} tokens`);
      console.log(`   Current: ${ethers.formatUnits(contractBalance, 18)} tokens`);
      console.log(`   Missing: ${ethers.formatUnits(totalRequired - contractBalance, 18)} tokens`);
      return;
    }

    console.log("\n📝 Creating vesting schedules...\n");

    // Create each vesting schedule
    for (let i = 0; i < vestingSchedules.length; i++) {
      const schedule = vestingSchedules[i];
      
      console.log(`📅 Creating schedule ${i + 1}/${vestingSchedules.length}:`);
      console.log(`   Beneficiary: ${schedule.beneficiary}`);
      console.log(`   Amount: ${ethers.formatUnits(schedule.amount, 18)} tokens`);
      console.log(`   Duration: ${schedule.duration / 86400} days`);
      console.log(`   Start Time: ${new Date(schedule.startTime * 1000).toISOString()}`);
      console.log(`   Description: ${schedule.description}`);

      try {
        // Create vesting schedule
        const tx = await vestingContract.createVestingSchedule(
          schedule.beneficiary,
          schedule.startTime,
          schedule.cliff,
          schedule.duration,
          schedule.slicePeriodSeconds,
          schedule.revocable,
          schedule.amount
        );

        console.log(`   ⏳ Transaction hash: ${tx.hash}`);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log(`   ✅ Schedule created successfully! Gas used: ${receipt.gasUsed.toString()}`);

        // Get the vesting schedule ID
        const beneficiary = schedule.beneficiary;
        const vestingCount = await vestingContract.getVestingSchedulesCountByBeneficiary(beneficiary);
        const scheduleId = await vestingContract.computeVestingScheduleIdForAddressAndIndex(beneficiary, vestingCount - 1);
        
        console.log(`   🆔 Schedule ID: ${scheduleId}`);
        
        // Check releasable amount
        const releasableAmount = await vestingContract.computeReleasableAmount(scheduleId);
        console.log(`   🎯 Releasable amount: ${ethers.formatUnits(releasableAmount, 18)} tokens`);

      } catch (error) {
        console.error(`   ❌ Error creating schedule: ${error.message}`);
        throw error;
      }

      console.log(""); // Empty line for readability
    }

    console.log("🎉 All vesting schedules created successfully!");
    
    // Final summary
    const totalSchedules = await vestingContract.getVestingSchedulesCount();
    const totalAmount = await vestingContract.getVestingSchedulesTotalAmount();
    
    console.log("\n📊 Final Summary:");
    console.log(`   Total Schedules: ${totalSchedules}`);
    console.log(`   Total Amount: ${ethers.formatUnits(totalAmount, 18)} tokens`);
    console.log(`   Contract Balance: ${ethers.formatUnits(await tokenContract.balanceOf(config.vestingContractAddress), 18)} tokens`);

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Helper function to validate addresses
function isValidAddress(address) {
  return ethers.isAddress(address) && address !== ethers.ZeroAddress;
}

// Helper function to validate amounts
function isValidAmount(amount) {
  try {
    const bigAmount = BigInt(amount);
    return bigAmount > 0n;
  } catch {
    return false;
  }
}

// Run the script
if (require.main === module) {
  createVestingSchedules().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createVestingSchedules };
