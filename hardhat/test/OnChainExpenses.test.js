const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OnChainExpenses Contract", function () {
    let OnChainExpenses, onChainExpenses, MockUSDStableCoin, mockUSD, owner, creator, payer, iApp;
    const iAppPublicKey = ethers.Wallet.createRandom().address; // Simulate an iApp public key

    // // Increase timeout for Polkadot VM
    // this.timeout(120000); // 2 minutes

    // before(async function() {
    //     // Wait for network to be ready
    //     await new Promise(resolve => setTimeout(resolve, 10000));
    // });

    beforeEach(async function () {
        try {
            // Get the first signer (owner)
            [owner] = await ethers.getSigners();
            if (!owner) {
                throw new Error("Failed to get owner signer");
            }

            // Create additional signers manually
            const provider = owner.provider;
            creator = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
            payer = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);
            iApp = new ethers.Wallet(ethers.Wallet.createRandom().privateKey, provider);

            // Fund the additional accounts with some ETH for gas
            const fundingAmount = ethers.parseEther("1.0"); // 1 ETH
            await owner.sendTransaction({ to: creator.address, value: fundingAmount });
            await owner.sendTransaction({ to: payer.address, value: fundingAmount });
            await owner.sendTransaction({ to: iApp.address, value: fundingAmount });

            // Deploy MockUSDStableCoin
            MockUSDStableCoin = await ethers.getContractFactory("MockUSDStableCoin");
            mockUSD = await MockUSDStableCoin.connect(owner).deploy();
            await mockUSD.waitForDeployment();
            const mockUSDAddress = await mockUSD.getAddress();

            // Deploy OnChainExpenses
            OnChainExpenses = await ethers.getContractFactory("OnChainExpenses");
            onChainExpenses = await OnChainExpenses.connect(owner).deploy(iApp.address, mockUSDAddress);
            await onChainExpenses.waitForDeployment();
            const onChainExpensesAddress = await onChainExpenses.getAddress();

            // Mint some MUSD for the payer
            const payerInitialBalance = ethers.parseUnits("1000", 6); // 1000 MUSD (6 decimals)
            await mockUSD.connect(owner).mint(payer.address, payerInitialBalance);
            expect(await mockUSD.balanceOf(payer.address)).to.equal(payerInitialBalance);

            // Payer approves OnChainExpenses contract to spend MUSD on their behalf
            await mockUSD.connect(payer).approve(onChainExpensesAddress, payerInitialBalance);
        } catch (error) {
            console.error("Error in beforeEach:", error);
            throw error;
        }
    });

    it("Should follow the full expense reporting and payment sequence", async function () {
        const onChainExpensesAddress = await onChainExpenses.getAddress();
        const mockUSDAddress = await mockUSD.getAddress();

        // 1. User (Creator) creates an expense request
        const expenseTitle = "Team Dinner Q3";
        let createTx = await onChainExpenses.connect(creator).createExpenseRequest(expenseTitle, payer.address);
        let receipt = await createTx.wait();
        
        const event = receipt.logs.find(log => log.fragment && log.fragment.name === 'ExpenseCreated');
        expect(event).to.not.be.undefined;
        const expenseId = event.args.expenseId;
        expect(expenseId).to.equal(0); // First expense

        let request = await onChainExpenses.getExpenseRequest(expenseId);
        expect(request.title).to.equal(expenseTitle);
        expect(request.creator).to.equal(creator.address);
        expect(request.payer).to.equal(payer.address);
        expect(request.readyToReview).to.be.false;
        expect(request.fullyPaid).to.be.false;

        // 2. iApp adds expense items
        const item1IpfsHash = "ipfs://hash1";
        const item1Amount = ethers.parseUnits("50", 6); // 50 MUSD
        const item1Category = "Food";
        
        await expect(onChainExpenses.connect(iApp).addExpenseItem(expenseId, item1IpfsHash, item1Amount, item1Category))
            .to.emit(onChainExpenses, "ItemAdded")
            .withArgs(expenseId, item1IpfsHash, item1Amount, item1Category);

        const item2IpfsHash = "ipfs://hash2";
        const item2Amount = ethers.parseUnits("25", 6); // 25 MUSD
        const item2Category = "Drinks";

        await expect(onChainExpenses.connect(iApp).addExpenseItem(expenseId, item2IpfsHash, item2Amount, item2Category))
            .to.emit(onChainExpenses, "ItemAdded")
            .withArgs(expenseId, item2IpfsHash, item2Amount, item2Category);
        
        request = await onChainExpenses.getExpenseRequest(expenseId);
        expect(request.itemCount).to.equal(2);

        let item1 = await onChainExpenses.getExpenseItem(expenseId, 0);
        expect(item1.ipfsHash).to.equal(item1IpfsHash);
        expect(item1.amount).to.equal(item1Amount);
        expect(item1.paid).to.be.false;

        // 3. Creator marks expense as ready for review
        await expect(onChainExpenses.connect(creator).setReadyForReview(expenseId))
            .to.emit(onChainExpenses, "ReadyForReview")
            .withArgs(expenseId);
        
        request = await onChainExpenses.getExpenseRequest(expenseId);
        expect(request.readyToReview).to.be.true;

        // 4. Payer prepares for payment (already approved MUSD spending in beforeEach)
        const payerInitialMUSDBalance = await mockUSD.balanceOf(payer.address);
        const creatorInitialMUSDBalance = await mockUSD.balanceOf(creator.address);

        // 5. Payer batch pays items
        const itemIdsToPay = [0, 1]; // Pay both items
        const totalAmountToPay = item1Amount + item2Amount;

        // Payer checks allowance (optional check, good practice)
        const allowance = await mockUSD.allowance(payer.address, onChainExpensesAddress);
        expect(allowance).to.be.gte(totalAmountToPay);

        await expect(onChainExpenses.connect(payer).batchPayItems(expenseId, itemIdsToPay, totalAmountToPay))
            .to.emit(onChainExpenses, "ItemsPaidBatch")
            .withArgs(expenseId, itemIdsToPay, totalAmountToPay)
            .to.emit(onChainExpenses, "PaymentCompleted") // This event is emitted from batchPayItems as well if fully paid
            .withArgs(expenseId, totalAmountToPay);

        // 6. Verify payment and state changes
        request = await onChainExpenses.getExpenseRequest(expenseId);
        expect(request.fullyPaid).to.be.true;
        expect(request.totalPaidAmount).to.equal(totalAmountToPay);

        item1 = await onChainExpenses.getExpenseItem(expenseId, 0);
        expect(item1.paid).to.be.true;
        let item2 = await onChainExpenses.getExpenseItem(expenseId, 1);
        expect(item2.paid).to.be.true;

        // Verify MUSD balances
        const payerFinalMUSDBalance = await mockUSD.balanceOf(payer.address);
        const creatorFinalMUSDBalance = await mockUSD.balanceOf(creator.address);
        
        expect(payerFinalMUSDBalance).to.equal(payerInitialMUSDBalance - totalAmountToPay);
        expect(creatorFinalMUSDBalance).to.equal(creatorInitialMUSDBalance + totalAmountToPay);

        // Check getUnpaidTotal
        const unpaidTotal = await onChainExpenses.getUnpaidTotal(expenseId);
        expect(unpaidTotal).to.equal(0);

        // Check getExpensesReadyForReview (should be empty for this payer if this was the only one)
        const readyForPayer = await onChainExpenses.getExpensesReadyForReview(payer.address);
        // This assertion depends on whether other expenses might exist for this payer.
        // For this isolated test, it should not contain this expenseId.
        expect(readyForPayer.map(id => Number(id))).to.not.include(Number(expenseId));


        // Check getCreatorExpenses
        const creatorExpenses = await onChainExpenses.getCreatorExpenses(creator.address);
        expect(creatorExpenses.map(id => Number(id))).to.include(Number(expenseId));
    });

    it("Should handle partial payment correctly", async function() {
        const onChainExpensesAddress = await onChainExpenses.getAddress();
        // 1. Create request
        const expenseId = await onChainExpenses.connect(creator).createExpenseRequest("Partial Pay Test", payer.address).then(tx => tx.wait()).then(receipt => receipt.logs.find(log => log.fragment.name === 'ExpenseCreated').args.expenseId);

        // 2. Add items by iApp
        const item1Amount = ethers.parseUnits("100", 6);
        await onChainExpenses.connect(iApp).addExpenseItem(expenseId, "ipfs://itemA", item1Amount, "CatA");
        const item2Amount = ethers.parseUnits("200", 6);
        await onChainExpenses.connect(iApp).addExpenseItem(expenseId, "ipfs://itemB", item2Amount, "CatB");

        // 3. Set ready for review by creator
        await onChainExpenses.connect(creator).setReadyForReview(expenseId);

        // 4. Payer pays only the first item
        const itemIdsToPay = [0]; // Only item 1
        const amountToPay = item1Amount;

        await expect(onChainExpenses.connect(payer).batchPayItems(expenseId, itemIdsToPay, amountToPay))
            .to.emit(onChainExpenses, "ItemsPaidBatch")
            .withArgs(expenseId, itemIdsToPay, amountToPay)
            .to.emit(onChainExpenses, "PaymentCompleted") // PaymentCompleted is emitted per batch
            .withArgs(expenseId, amountToPay);
            
        let request = await onChainExpenses.getExpenseRequest(expenseId);
        expect(request.fullyPaid).to.be.false; // Not fully paid
        expect(request.totalPaidAmount).to.equal(amountToPay);

        let item1 = await onChainExpenses.getExpenseItem(expenseId, 0);
        expect(item1.paid).to.be.true;
        let item2 = await onChainExpenses.getExpenseItem(expenseId, 1);
        expect(item2.paid).to.be.false;
        
        const unpaidTotal = await onChainExpenses.getUnpaidTotal(expenseId);
        expect(unpaidTotal).to.equal(item2Amount);

        // Payer pays the second item
        const itemIdsToPay2 = [1];
        const amountToPay2 = item2Amount;
        
        const creatorBalanceBeforeSecondPayment = await mockUSD.balanceOf(creator.address);

        await expect(onChainExpenses.connect(payer).batchPayItems(expenseId, itemIdsToPay2, amountToPay2))
            .to.emit(onChainExpenses, "ItemsPaidBatch")
            .withArgs(expenseId, itemIdsToPay2, amountToPay2)
            .to.emit(onChainExpenses, "PaymentCompleted")
            .withArgs(expenseId, amountToPay2);
            
        request = await onChainExpenses.getExpenseRequest(expenseId);
        expect(request.fullyPaid).to.be.true; // Now fully paid
        expect(request.totalPaidAmount).to.equal(item1Amount + item2Amount);
        
        item2 = await onChainExpenses.getExpenseItem(expenseId, 1);
        expect(item2.paid).to.be.true;
        
        const creatorBalanceAfterSecondPayment = await mockUSD.balanceOf(creator.address);
        expect(creatorBalanceAfterSecondPayment).to.equal(creatorBalanceBeforeSecondPayment + amountToPay2);
    });

    // Add more tests for edge cases, authorization, failures etc.
    // For example:
    // - Test that only iApp can add items
    // - Test that only creator can set ready for review
    // - Test that only payer can pay
    // - Test failures for insufficient balance/allowance
    // - Test paying for an already paid item
    // - Test with non-existent expenseId or itemId

    it("Should only allow iApp to add expense items", async function() {
        const expenseId = await onChainExpenses.connect(creator).createExpenseRequest("Auth Test", payer.address).then(tx => tx.wait()).then(receipt => receipt.logs.find(log => log.fragment.name === 'ExpenseCreated').args.expenseId);
        await expect(
            onChainExpenses.connect(creator).addExpenseItem(expenseId, "ipfs://bad", ethers.parseUnits("10", 6), "Fail")
        ).to.be.revertedWith("Only iApp can perform this action");
    });

    it("Should only allow creator to set ready for review", async function() {
        const expenseId = await onChainExpenses.connect(creator).createExpenseRequest("Auth Test", payer.address).then(tx => tx.wait()).then(receipt => receipt.logs.find(log => log.fragment.name === 'ExpenseCreated').args.expenseId);
        await onChainExpenses.connect(iApp).addExpenseItem(expenseId, "ipfs://item", ethers.parseUnits("10", 6), "Test");
        await expect(
            onChainExpenses.connect(payer).setReadyForReview(expenseId)
        ).to.be.revertedWith("Only creator can perform this action");
    });
    
    it("Should only allow payer to batch pay items", async function() {
        const expenseId = await onChainExpenses.connect(creator).createExpenseRequest("Auth Test", payer.address).then(tx => tx.wait()).then(receipt => receipt.logs.find(log => log.fragment.name === 'ExpenseCreated').args.expenseId);
        const itemAmount = ethers.parseUnits("10", 6);
        await onChainExpenses.connect(iApp).addExpenseItem(expenseId, "ipfs://item", itemAmount, "Test");
        await onChainExpenses.connect(creator).setReadyForReview(expenseId);
        await expect(
            onChainExpenses.connect(creator).batchPayItems(expenseId, [0], itemAmount)
        ).to.be.revertedWith("Only payer can perform this action");
    });

    it("Should fail batchPayItems if totalAmount mismatch", async function() {
        const expenseId = await onChainExpenses.connect(creator).createExpenseRequest("Mismatch Test", payer.address).then(tx => tx.wait()).then(receipt => receipt.logs.find(log => log.fragment.name === 'ExpenseCreated').args.expenseId);
        const itemAmount = ethers.parseUnits("10", 6);
        await onChainExpenses.connect(iApp).addExpenseItem(expenseId, "ipfs://item", itemAmount, "Test");
        await onChainExpenses.connect(creator).setReadyForReview(expenseId);
        
        const wrongAmount = ethers.parseUnits("5", 6);
        await expect(
            onChainExpenses.connect(payer).batchPayItems(expenseId, [0], wrongAmount)
        ).to.be.revertedWith("Total amount mismatch");
    });

    it("Should fail batchPayItems if insufficient MUSD allowance", async function() {
        const onChainExpensesAddress = await onChainExpenses.getAddress();
        const expenseId = await onChainExpenses.connect(creator).createExpenseRequest("Allowance Test", payer.address).then(tx => tx.wait()).then(receipt => receipt.logs.find(log => log.fragment.name === 'ExpenseCreated').args.expenseId);
        const itemAmount = ethers.parseUnits("10", 6);
        await onChainExpenses.connect(iApp).addExpenseItem(expenseId, "ipfs://item", itemAmount, "Test");
        await onChainExpenses.connect(creator).setReadyForReview(expenseId);

        // Reduce payer's allowance to be less than itemAmount
        await mockUSD.connect(payer).approve(onChainExpensesAddress, ethers.parseUnits("5", 6));
        
        await expect(
            onChainExpenses.connect(payer).batchPayItems(expenseId, [0], itemAmount)
        ).to.be.revertedWith("Insufficient allowance");
    });
    
    it("Should fail batchPayItems if item is already paid", async function() {
        const expenseId = await onChainExpenses.connect(creator).createExpenseRequest("Already Paid Test", payer.address).then(tx => tx.wait()).then(receipt => receipt.logs.find(log => log.fragment.name === 'ExpenseCreated').args.expenseId);
        const itemAmount = ethers.parseUnits("10", 6);
        await onChainExpenses.connect(iApp).addExpenseItem(expenseId, "ipfs://item", itemAmount, "Test");
        await onChainExpenses.connect(creator).setReadyForReview(expenseId);

        // Pay the item first
        await onChainExpenses.connect(payer).batchPayItems(expenseId, [0], itemAmount);
        
        // Attempt to pay the same item again
        await expect(
            onChainExpenses.connect(payer).batchPayItems(expenseId, [0], itemAmount)
        ).to.be.revertedWith("Item already paid");
    });
}); 