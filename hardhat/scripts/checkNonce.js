const hre = require('hardhat');
require('dotenv').config();

async function main() {
  const deployer = new hre.ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, hre.ethers.provider);
  
  const nonce = await hre.ethers.provider.getTransactionCount(deployer.address);
  console.log('Current nonce for', deployer.address, 'is:', nonce);
  
  // Get the latest block
  const block = await hre.ethers.provider.getBlock('latest');
  console.log('Latest block number:', block.number);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 