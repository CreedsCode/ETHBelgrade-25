![onchain-expenses-high-resolution-logo](https://github.com/user-attachments/assets/06d561ac-2450-4be5-8717-eec2caafc059)

<p align="center">
  <a href="https://www.linkedin.com/in/agustin-schiariti/">
    <img src="https://img.shields.io/badge/Reach_Agustin-On_LinkedIn-Green">
  </a>
  <a href="https://www.linkedin.com/in/agustin-schiariti/">
    <img src="https://img.shields.io/badge/Reach_Maharaja-On_LinkedIn-Green">
  </a>
  <a href="https://www.linkedin.com/in/agustin-schiariti/">
    <img src="https://img.shields.io/badge/Reach_Dercio-On_LinkedIn-Green">
  </a>
</p>

<p align="center">
  <a href="## ✨ Overview"> Overview </a> •
  <a href="## ⭐ Hacky Highlights"> Hacky Highlights </a> •
  <a href="## 🔑 Key Features (MVP)"> Key Features </a> •
  <a href="## 👙 Polkadot Passet hub Smart Contract"> Smart Contracts </a> • 
  <a href="## 🟡 Iexec Iapp"> Iexec Iapp </a> • 
  <a href="## 🔗 OriginTrail DKG"> OriginTrail DKG </a> • 

  
</p>

## ✨ Overview

This project is a privacy-first expense submission system designed for DAOs. Users upload receipts, which are sanitized and encrypted via iExec’s DataProtector SDK, then processed in a Trusted Execution Environment (TEE). The iApp decrypts the data securely and submits validated expenses to the Polkadot Asset Hub (testnet). All expenses are also indexed on the OriginTrail decentralized knowledge graph, enabling transparent, composable queries. The system ensures pseudonymous contributors can be reimbursed fairly while protecting against internal bias and favoritism—bringing neutrality, privacy, and auditability to decentralized finance operations.

## ⭐ Hacky Highlights
- Recreating EVM fetch after block processed function in polkadot vm. By scraping the data at the anticipated next consolidated block from blockscout, scrape initiated after block completion.
- using 'name' parameter in dkg json format for data information/description. Akin to writing a letter on the inside of the envelope.
- Hard-coded all variables in the Iapp app.js file, to expedite ethers.js integration.
- Folding the private key of the Iapp into the secret message so that the iapp has the only accesspoint to the smart contract.

---
## Key Features
 - OCR processing receipts
 - iapp (privacy)
 - Crosschain compatibility future proof
 - DKG (transparency plus analytics)

   
## Polkadot Passet hub Smart Contract

The project uses a smart contract deployed at `0x3BF50174762538e3111008A38db4Da16C277128F` with the following main functions:

hardhat/scripts/interact.js:
const contractAddress = '0xdCE56C2A4926a9fCb09Cb0C2C4394a3168574b29';
hardhat/ignition/modules/OnChainExpensesModule.js:
"0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Fixed iApp address for testing
JSON (deployment/config):
iapp/deployed.json:
"134": "0xD9B5557c036608F12fc19dfe61345B321410B0BD"
iapp/orders.json:
"app": "0xD9B5557c036608F12fc19dfe61345B321410B0BD",
(plus several zero addresses for restrictions)
iapp/cache/runs.json:
"iAppAddress": "0x66e70D6E1Ad4bF5bb89D3B42b4Dd90271A86FaC6",
iapp/cache/deployments.json:
"appContractAddress": "0x3cE239ba9A9e2C2250093D8d7E5c3Ea9b88C811b",
"appContractAddress": "0x66e70D6E1Ad4bF5bb89D3B42b4Dd90271A86FaC6",
iapp/iexec.json:
"app": "0x3cE239ba9A9e2C2250093D8d7E5c3Ea9b88C811b",
(plus several zero addresses for restrictions)
hardhat/ignition/deployments/chain-420420421/deployed_addresses.json:
"OnChainExpensesModule#MockUSDStableCoin": "0xe58EFf17B8E10C919350C521d3249076cbac338E"
hardhat/ignition/deployments/chain-420420420/deployed_addresses.json:
"StorageModule#Storage": "0xE86E5e51b57D83c4420c78eB1bd30453cA2C0a8F",
"OnChainExpensesModule#MockUSDStableCoin": "0xDa98d56F3357422ba9397F102E8C311Fd3fE004A"
Other addresses (owners, etc.):
iapp/cache/deployments.json:
"owner": "0x71F883581F602c73addf7F57821649470Eab61F5"
iapp/iexec.json:
"owner": "0x8B00A47763d5Ce39a9bCd2740077A935a8c61C87"

## Iexec Iapp

A key innovation in this project lies in how the iApp handles decryption: the private key required to unlock the encrypted expense data is embedded directly into the task's secure message payload and accessed only within the Trusted Execution Environment (TEE). This approach avoids any on-chain exposure or external storage, ensuring that the key remains inaccessible outside the enclave. This design is made possible by iExec’s DataProtector SDK, which underpins the entire privacy model. Without it, our promise of end-to-end encryption, anonymous submission, and trustless processing for pseudonymous DAO contributors would not be feasible.

## OriginTrail DKG

By creating assets from all expense submissions into the OriginTrail Decentralized Knowledge Graph (DKG), this project unlocks powerful, queryable insights for DAOs. The DKG transforms raw expense data into a structured, semantic layer—making it possible to analyze historical financial patterns using natural language queries instead of complex database syntax. This dramatically lowers the barrier to financial transparency, enabling contributors, community members, and even external auditors to surface trends, detect anomalies, or explore spending categories without technical expertise. The DKG integration is what turns anonymized reimbursement into actionable organizational intelligence—bridging privacy and accessibility in a uniquely decentralized way

