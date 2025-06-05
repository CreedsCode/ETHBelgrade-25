const hre = require('hardhat');
require('dotenv').config();

async function main() {
  // Get signers for different roles
  const deployer = new hre.ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, hre.ethers.provider);
  const iApp = new hre.ethers.Wallet(process.env.IAPP_PRIVATE_KEY, hre.ethers.provider);
  const user = new hre.ethers.Wallet(process.env.USER_KEY, hre.ethers.provider);
  const payer = new hre.ethers.Wallet(process.env.APPROVER_KEY, hre.ethers.provider);

  console.log('Role Addresses:');
  console.log('Deployer:', deployer.address);
  console.log('iApp:', iApp.address);
  console.log('User/Requester:', user.address);
  console.log('Payer:', payer.address);

  // Deploy MUSD token
  console.log('\n1. Deploying MUSD token...');
  const MockUSDStableCoin = await hre.ethers.getContractFactory('MockUSDStableCoin');
  const musd = await MockUSDStableCoin.deploy();
  await musd.waitForDeployment();
  console.log('MUSD deployed to:', await musd.getAddress());

  // Deploy OnChainExpenses contract
  console.log('\n2. Deploying OnChainExpenses contract...');
  const OnChainExpenses = await hre.ethers.getContractFactory('OnChainExpenses');
  const expenses = await OnChainExpenses.deploy(iApp.address, await musd.getAddress());
  await expenses.waitForDeployment();
  console.log('OnChainExpenses deployed to:', await expenses.getAddress());

  // Transfer MUSD to payer for testing
  console.log('\n3. Setting up initial balances...');
  const initialAmount = hre.ethers.parseUnits('5000', 6); // 5000 MUSD
  await musd.transfer(payer.address, initialAmount);
  console.log('Payer balance:', await musd.balanceOfInUSD(payer.address));

  // Create expense request
  console.log('\n4. Creating expense request...');
  const tx1 = await expenses.connect(user).createExpenseRequest(
    "Q4 2023 Business Trip",
    payer.address
  );
  const receipt1 = await tx1.wait();
  const event1 = receipt1.logs.find(log => log.fragment?.name === 'ExpenseCreated');
  const expenseId = event1.args.expenseId;
  console.log('Expense created with ID:', expenseId);

  // Simulate iApp processing receipts and adding items
  console.log('\n5. iApp processing receipts and adding items...');
  const items = [
    {
      ipfsHash: "QmReceipt1",
      amount: hre.ethers.parseUnits('150', 6), // $150
      category: "Travel"
    },
    {
      ipfsHash: "QmReceipt2",
      amount: hre.ethers.parseUnits('75', 6), // $75
      category: "Meals"
    },
    {
      ipfsHash: "QmReceipt3",
      amount: hre.ethers.parseUnits('200', 6), // $200
      category: "Accommodation"
    }
  ];

  for (const item of items) {
    await expenses.connect(iApp).addExpenseItem(
      expenseId,
      item.ipfsHash,
      item.amount,
      item.category
    );
  }
  console.log('Items added by iApp');

  // Mark expense as ready for review
  console.log('\n6. Marking expense as ready for review...');
  await expenses.connect(user).setReadyForReview(expenseId);
  console.log('Expense marked as ready for review');

  // Get expense details
  console.log('\n7. Getting expense details...');
  const [title, creator, expensePayer, timestamp, readyToReview, fullyPaid, totalPaid, itemCount] = 
    await expenses.getExpenseRequest(expenseId);
  console.log('Expense details:');
  console.log('Title:', title);
  console.log('Creator:', creator);
  console.log('Payer:', expensePayer);
  console.log('Ready for review:', readyToReview);
  console.log('Fully paid:', fullyPaid);
  console.log('Total paid:', hre.ethers.formatUnits(totalPaid, 6), 'MUSD');
  console.log('Item count:', itemCount);

  // Get all items
  console.log('\n8. Getting all expense items...');
  const [ipfsHashes, amounts, categories, paidStatus, timestamps] = 
    await expenses.getAllExpenseItems(expenseId);
  
  console.log('Expense items:');
  for (let i = 0; i < ipfsHashes.length; i++) {
    console.log(`Item ${i}:`);
    console.log('  IPFS Hash:', ipfsHashes[i]);
    console.log('  Amount:', hre.ethers.formatUnits(amounts[i], 6), 'MUSD');
    console.log('  Category:', categories[i]);
    console.log('  Paid:', paidStatus[i]);
  }

  // Payer approves MUSD spending
  console.log('\n9. Payer approving MUSD spending...');
  const totalAmount = amounts.reduce((a, b) => a + b, BigInt(0));
  await musd.connect(payer).approve(await expenses.getAddress(), totalAmount);
  console.log('MUSD spending approved');

  // Payer processes batch payment
  console.log('\n10. Processing batch payment...');
  const itemIds = [0, 1, 2]; // Pay for all items
  await expenses.connect(payer).batchPayItems(expenseId, itemIds, totalAmount);
  console.log('Batch payment completed');

  // Final state check
  console.log('\n11. Final state check...');
  const [,,, , , finalFullyPaid, finalTotalPaid] = await expenses.getExpenseRequest(expenseId);
  console.log('Expense fully paid:', finalFullyPaid);
  console.log('Total paid amount:', hre.ethers.formatUnits(finalTotalPaid, 6), 'MUSD');
  
  // Check final balances
  console.log('\nFinal balances:');
  console.log('Payer:', await musd.balanceOfInUSD(payer.address));
  console.log('User/Requester:', await musd.balanceOfInUSD(user.address));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 