const hre = require('hardhat');
require('dotenv').config();

async function main() {
  console.log('Starting deployment...');
  
  // Get the deployer account
  const deployer = new hre.ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, hre.ethers.provider);
  const iAppWallet = new hre.ethers.Wallet(process.env.IAPP_PRIVATE_KEY, hre.ethers.provider);
  
  console.log('Deployer address:', deployer.address);
  console.log('iApp address:', iAppWallet.address);
  
  // Get current nonce
  const nonce = await hre.ethers.provider.getTransactionCount(deployer.address);
  console.log('Current nonce:', nonce);
  
  // Deploy MockUSDStableCoin
  console.log('\nDeploying MockUSDStableCoin...');
  const MockUSDStableCoin = await hre.ethers.getContractFactory('MockUSDStableCoin');
  const musd = await MockUSDStableCoin.deploy({
    nonce: nonce
  });
  await musd.waitForDeployment();
  const musdAddress = await musd.getAddress();
  console.log('MockUSDStableCoin deployed to:', musdAddress);

  // Deploy OnChainExpenses
  console.log('\nDeploying OnChainExpenses...');
  const OnChainExpenses = await hre.ethers.getContractFactory('OnChainExpenses');
  const expenses = await OnChainExpenses.deploy(
    iAppWallet.address, // iApp address from environment
    musdAddress,
    {
      nonce: nonce + 1
    }
  );
  await expenses.waitForDeployment();
  const expensesAddress = await expenses.getAddress();
  console.log('OnChainExpenses deployed to:', expensesAddress);

  // Verify the deployment
  console.log('\nVerifying deployment...');
  const iAppAddress = await expenses.iAppPublicKey();
  const stableCoinAddress = await expenses.stableCoin();
  
  console.log('\nDeployment Summary:');
  console.log('-------------------');
  console.log('MockUSDStableCoin:', musdAddress);
  console.log('OnChainExpenses:', expensesAddress);
  console.log('iApp Public Key:', iAppAddress);
  console.log('Stable Coin:', stableCoinAddress);

  // Save deployment info to a file
  const deploymentInfo = {
    mockUSD: musdAddress,
    onChainExpenses: expensesAddress,
    iAppPublicKey: iAppAddress,
    stableCoin: stableCoinAddress,
    network: 'passetHub',
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  fs.writeFileSync(
    'deployment-info.json',
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log('\nDeployment info saved to deployment-info.json');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 