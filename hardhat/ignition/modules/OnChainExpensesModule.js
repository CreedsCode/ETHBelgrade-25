const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
require("dotenv").config();

module.exports = buildModule("OnChainExpensesModule", (m) => {
  // Deploy MockUSDStableCoin first
  const mockUSD = m.contract("MockUSDStableCoin", [], {
    nonce: 11 // Current nonce
  });

  // Deploy OnChainExpenses with a fixed iApp address for testing
  const onChainExpenses = m.contract("OnChainExpenses", [
    "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Fixed iApp address for testing
    mockUSD, // Ignition handles resolving this to the address of the mockUSD contract
  ], {
    nonce: 12 // Next nonce
  });

  // Return the deployed contracts
  return { mockUSD, onChainExpenses };
}); 