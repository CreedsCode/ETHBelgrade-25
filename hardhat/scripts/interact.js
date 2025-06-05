const hre = require('hardhat');
require('dotenv').config();

async function main() {
  // Contract address from your deployment
  const contractAddress = '0xdCE56C2A4926a9fCb09Cb0C2C4394a3168574b29';

  // Get the contract instance
  const Storage = await hre.ethers.getContractFactory('Storage');
  
  // Create instances with different roles
  const deployer = new hre.ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, hre.ethers.provider);
  const iApp = new hre.ethers.Wallet(process.env.IAPP_PRIVATE_KEY, hre.ethers.provider);
  const user = new hre.ethers.Wallet(process.env.USER_KEY, hre.ethers.provider);
  const approver = new hre.ethers.Wallet(process.env.APPROVER_KEY, hre.ethers.provider);

  console.log('Deployer address:', deployer.address);
  console.log('iApp address:', iApp.address);
  console.log('User address:', user.address);
  console.log('Approver address:', approver.address);

  // Get contract instances for each role
  const storageDeployer = Storage.attach(contractAddress).connect(deployer);
  const storageIApp = Storage.attach(contractAddress).connect(iApp);
  const storageUser = Storage.attach(contractAddress).connect(user);
  const storageApprover = Storage.attach(contractAddress).connect(approver);

  // Get current value
  console.log('\nGetting current value...');
  const currentValue = await storageDeployer.retrieve();
  console.log('Current stored value:', currentValue.toString());

  // Store a new value as deployer
  console.log('\nStoring new value as deployer...');
  const newValue = 42;
  const tx1 = await storageDeployer.store(newValue);
  await tx1.wait();
  console.log('Transaction confirmed');

  // Get updated value
  const updatedValue = await storageDeployer.retrieve();
  console.log('Updated stored value:', updatedValue.toString());

  // Try to store as iApp
  console.log('\nTrying to store as iApp...');
  try {
    const tx2 = await storageIApp.store(100);
    await tx2.wait();
    console.log('iApp storage successful');
  } catch (error) {
    console.log('iApp storage failed:', error.message);
  }

  // Try to store as user
  console.log('\nTrying to store as user...');
  try {
    const tx3 = await storageUser.store(200);
    await tx3.wait();
    console.log('User storage successful');
  } catch (error) {
    console.log('User storage failed:', error.message);
  }

  // Try to store as approver
  console.log('\nTrying to store as approver...');
  try {
    const tx4 = await storageApprover.store(300);
    await tx4.wait();
    console.log('Approver storage successful');
  } catch (error) {
    console.log('Approver storage failed:', error.message);
  }

  // Get final value
  const finalValue = await storageDeployer.retrieve();
  console.log('\nFinal stored value:', finalValue.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });