const hre = require('hardhat');
require('dotenv').config();

async function main() {
  // Get signers
  const deployer = new hre.ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, hre.ethers.provider);
  const payer = new hre.ethers.Wallet(process.env.USER_KEY, hre.ethers.provider);
  const requester = new hre.ethers.Wallet(process.env.APPROVER_KEY, hre.ethers.provider);

  console.log('Deployer address:', deployer.address);
  console.log('Payer address:', payer.address);
  console.log('Requester address:', requester.address);

  // Deploy MUSD token
  console.log('\nDeploying MUSD token...');
  const MockUSDStableCoin = await hre.ethers.getContractFactory('MockUSDStableCoin');
  const musd = await MockUSDStableCoin.deploy();
  await musd.waitForDeployment();
  console.log('MUSD deployed to:', await musd.getAddress());

  // Get initial balances
  console.log('\nInitial balances:');
  console.log('Deployer:', await musd.balanceOfInUSD(deployer.address));
  console.log('Payer:', await musd.balanceOfInUSD(payer.address));
  console.log('Requester:', await musd.balanceOfInUSD(requester.address));

  // Transfer some tokens to payer for testing
  console.log('\nTransferring tokens to payer...');
  const transferAmount = hre.ethers.parseUnits('1000', 6); // 1000 MUSD
  await musd.transfer(payer.address, transferAmount);
  console.log('Payer new balance:', await musd.balanceOfInUSD(payer.address));

  // Demonstrate allowance setup for expense payment
  console.log('\nSetting up allowance for expense payment...');
  const expenseAmount = hre.ethers.parseUnits('100', 6); // 100 MUSD
  await musd.connect(payer).approve(deployer.address, expenseAmount);
  console.log('Allowance set:', await musd.amountInUSD(await musd.allowance(payer.address, deployer.address)));

  // Simulate expense payment
  console.log('\nProcessing expense payment...');
  await musd.transferFrom(payer.address, requester.address, expenseAmount);
  
  // Final balances
  console.log('\nFinal balances:');
  console.log('Payer:', await musd.balanceOfInUSD(payer.address));
  console.log('Requester:', await musd.balanceOfInUSD(requester.address));

  // Demonstrate batch payment capability
  console.log('\nDemonstrating batch payment...');
  const batchAmount = hre.ethers.parseUnits('50', 6); // 50 MUSD each
  const recipients = [requester.address, deployer.address];
  const amounts = [batchAmount, batchAmount];
  
  await musd.connect(payer).approve(deployer.address, batchAmount * BigInt(2));
  await musd.transferFrom(payer.address, recipients[0], amounts[0]);
  await musd.transferFrom(payer.address, recipients[1], amounts[1]);
  
  console.log('\nBalances after batch payment:');
  console.log('Payer:', await musd.balanceOfInUSD(payer.address));
  console.log('Requester:', await musd.balanceOfInUSD(requester.address));
  console.log('Deployer:', await musd.balanceOfInUSD(deployer.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 