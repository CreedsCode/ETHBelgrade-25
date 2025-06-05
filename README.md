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

## Video Demo

https://youtube.com/shorts/bckDWpPqLKw?feature=share

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

The project uses a smart contract deployed at `0x3BF50174762538e3111008A38db4Da16C277128F`, and here is the link to our passet hub deployment:"https://blockscout-passet-hub.parity-testnet.parity.io/address/0x3BF50174762538e3111008A38db4Da16C277128F?tab=index"

Here is our iexec interaction: "https://explorer.iex.ec/bellecour/deal/0x233052d28ba136bac2d6a5ac144ea34196c6141138cbb5fb0440c9de522e73a5"

## Iexec Iapp

A key innovation in this project lies in how the iApp handles decryption: the private key required to unlock the encrypted expense data is embedded directly into the task's secure message payload and accessed only within the Trusted Execution Environment (TEE). This approach avoids any on-chain exposure or external storage, ensuring that the key remains inaccessible outside the enclave. This design is made possible by iExec’s DataProtector SDK, which underpins the entire privacy model. Without it, our promise of end-to-end encryption, anonymous submission, and trustless processing for pseudonymous DAO contributors would not be feasible.

## OriginTrail DKG

By creating assets from all expense submissions into the OriginTrail Decentralized Knowledge Graph (DKG), this project unlocks powerful, queryable insights for DAOs. The DKG transforms raw expense data into a structured, semantic layer—making it possible to analyze historical financial patterns using natural language queries instead of complex database syntax. This dramatically lowers the barrier to financial transparency, enabling contributors, community members, and even external auditors to surface trends, detect anomalies, or explore spending categories without technical expertise. The DKG integration is what turns anonymized reimbursement into actionable organizational intelligence—bridging privacy and accessibility in a uniquely decentralized way

