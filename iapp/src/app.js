import fs from "node:fs/promises";
import figlet from "figlet";
import { IExecDataProtectorDeserializer } from "@iexec/dataprotector-deserializer";

const main = async () => {
  const { IEXEC_OUT, IEXEC_IN, IEXEC_INPUT_FILES_NUMBER } = process.env;
  let computedJsonObj = {};

  try {
    let messages = []; // For Figlet

    const args = process.argv.slice(2);
    console.log(`Received ${args.length} command-line arguments:`, args);
    if (args.length > 0) {
      messages.push(`Args: ${args.join(" ")}`); // Add CLI args to messages for Figlet
    }

    // --- Start of Protected Data Deserialization ---
    try {
      const deserializer = new IExecDataProtectorDeserializer();
      console.log("Attempting to deserialize protected expense data...");

      const expenseId = await deserializer.getValue('expenseId', 'string');
      const title = await deserializer.getValue('title', 'string');
      const payer = await deserializer.getValue('payer', 'string');
      const totalAmount = await deserializer.getValue('totalAmount', 'string');
      const receiptsJSON = await deserializer.getValue('receipts', 'string');

      console.log("--- Deserialized Protected Data ---");
      console.log("Expense ID:", expenseId || "Not found");
      console.log("Title:", title || "Not found");
      console.log("Payer:", payer || "Not found");
      console.log("Total Amount:", totalAmount || "Not found");
      console.log("Receipts (JSON String):", receiptsJSON || "Not found/empty");
      console.log("------------------------------------");

      if (expenseId) messages.push(`ID: ${expenseId}`);
      if (title) messages.push(`Title: ${title}`);
      if (totalAmount) messages.push(`Total: ${totalAmount}`);
      
      if (receiptsJSON) {
        try {
          const parsedReceipts = JSON.parse(receiptsJSON);
          console.log("Parsed Receipts Data:", parsedReceipts);
          if (Array.isArray(parsedReceipts)) {
            messages.push(`${parsedReceipts.length} receipt(s)`);
            if (parsedReceipts.length > 0) {
                // console.log("Details of first receipt:", parsedReceipts[0]);
            }
          } else {
            messages.push("(Receipts data is not an array)");
          }
        } catch (parseError) {
          console.error("Failed to parse receipts JSON:", parseError.message);
          messages.push("(Receipts JSON malformed)");
        }
      } else {
        messages.push("(No receipts data)");
      }

      // --- Telegram Bot Logic (adapted from your example) ---
      const chatId = args[0]; // Expects Telegram Chat ID as the first CLI argument
      const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN; // Expects token in env

      if (telegramBotToken && title && chatId) {
        try {
          const bot = new TelegramBot(telegramBotToken);
          const telegramMessage = `New Expense Protected on iExec:
ID: ${expenseId || 'N/A'}
Title: ${title}
Amount: ${totalAmount || 'N/A'}
Payer: ${payer || 'N/A'}`;
          await bot.sendMessage(chatId, telegramMessage);
          console.log(`Expense details sent to Telegram chat ${chatId}`);
        } catch (err) {
          console.error("Failed to send message to Telegram:", err.message || err);
        }
      } else {
        let missingInfo = [];
        if (!telegramBotToken) missingInfo.push("TELEGRAM_BOT_TOKEN environment variable");
        if (!title) missingInfo.push("deserialized 'title' (from protected data)");
        if (!chatId) missingInfo.push("chatId (as first CLI argument)");
        if (missingInfo.length > 0) {
            console.log(`Skipping Telegram notification due to missing info: ${missingInfo.join(', ')}.`);
        } else {
            console.log("Skipping Telegram notification (title, chatId, or token not available).");
        }
      }
      // --- End of Telegram Bot Logic ---

    } catch (e) {
      console.error("Error during iExec data deserialization or subsequent processing:", e.message || e);
      messages.push("(Error: Could not process protected data)");
    }
    // --- End of Protected Data Deserialization ---

    // --- Input File Handling ---
    const numInputFiles = parseInt(IEXEC_INPUT_FILES_NUMBER || "0", 10);
    if (numInputFiles > 0 && IEXEC_IN) {
        console.log(`Processing ${numInputFiles} input files from ${IEXEC_IN}...`);
        for (let i = 1; i <= numInputFiles; i++) {
            const inputFileName = process.env[`IEXEC_INPUT_FILE_NAME_${i}`];
            if (inputFileName) {
                const inputFilePath = `${IEXEC_IN}/${inputFileName}`;
                const outputFilePath = `${IEXEC_OUT}/inputFile_${i}_${inputFileName}`;
                try {
                    console.log(`  Copying input file ${i} ('${inputFileName}') to '${outputFilePath}'`);
                    await fs.copyFile(inputFilePath, outputFilePath);
                } catch (copyError) {
                    console.error(`  Failed to copy input file '${inputFileName}':`, copyError.message);
                }
            } else {
                console.warn(`  Input file name for index ${i} is undefined.`);
            }
        }
    } else {
        console.log("No input files to process or IEXEC_IN not defined.");
    }
    // --- End Input File Handling ---

    // --- App and Requester Secret Handling (from your example) ---
    const { IEXEC_APP_DEVELOPER_SECRET } = process.env;
    if (IEXEC_APP_DEVELOPER_SECRET) {
      const redactedAppSecret = IEXEC_APP_DEVELOPER_SECRET.replace(/./g, "*");
      console.log(`Got an app secret (${redactedAppSecret})!`);
    } else {
      console.log(`App secret (IEXEC_APP_DEVELOPER_SECRET) is not set.`);
    }

    const { IEXEC_REQUESTER_SECRET_1, IEXEC_REQUESTER_SECRET_42 } = process.env;
    if (IEXEC_REQUESTER_SECRET_1) {
      const redactedRequesterSecret = IEXEC_REQUESTER_SECRET_1.replace(/./g,"*");
      console.log(`Got requester secret 1 (${redactedRequesterSecret})!`);
    } else {
      console.log(`Requester secret 1 (IEXEC_REQUESTER_SECRET_1) is not set.`);
    }
    if (IEXEC_REQUESTER_SECRET_42) {
      const redactedRequesterSecret = IEXEC_REQUESTER_SECRET_42.replace(/./g,"*");
      console.log(`Got requester secret 42 (${redactedRequesterSecret})!`);
    } else {
      console.log(`Requester secret 42 (IEXEC_REQUESTER_SECRET_42) is not set.`);
    }
    // --- End App and Requester Secret Handling ---

    // --- Figlet Output Generation ---
    // Use a relevant summary from messages for Figlet, or a default.
    // The messages array will contain: CLI args (if any), ID, Title, Total, Receipts count.
    const figletMessage = messages.length > 0 ? messages.join(' | ') : "iExec Task Done";
    console.log("Generating Figlet text for:", figletMessage)
    const asciiArtText = figlet.textSync(figletMessage, { horizontalLayout: 'full' });

    if (IEXEC_OUT) {
        await fs.writeFile(`${IEXEC_OUT}/result.txt`, "hi");
        console.log(`Result saved to ${IEXEC_OUT}/result.txt`);
        computedJsonObj = {
        "deterministic-output-path": `${IEXEC_OUT}/result.txt`,
        };
    } else {
        console.error("IEXEC_OUT is not defined. Cannot write result.txt.");
        computedJsonObj = {
            "error-message": "IEXEC_OUT not defined, result.txt not written.",
        };
    }
    // --- End Figlet Output Generation ---

  } catch (e) {
    console.error("Critical error in main process:", e.message || e, e.stack);
    // Ensure IEXEC_OUT has a fallback for error reporting if it's not defined.
    const finalIexecOutForError = IEXEC_OUT || "/iexec_out";
    computedJsonObj = {
      "deterministic-output-path": finalIexecOutForError, // Report error relative to output dir
      "error-message": `Main process failed: ${e.message || String(e)}`,
    };
  } finally {
    const finalIexecOut = IEXEC_OUT || "/iexec_out"; // Fallback for IEXEC_OUT
    if (!IEXEC_OUT) {
        console.warn("Warning: IEXEC_OUT environment variable not set. Defaulting to /iexec_out for computed.json.");
        try {
            // Try to create directory if it doesn't exist (mostly for local testing)
            await fs.mkdir(finalIexecOut, { recursive: true });
        } catch (dirError) {
            // Log error but proceed to try writing computed.json
            console.error(`Failed to ensure ${finalIexecOut} directory exists:`, dirError.message);
        }
    }
    try {
        await fs.writeFile(
            `${finalIexecOut}/computed.json`,
            JSON.stringify(computedJsonObj, null, 2) // Pretty print JSON
        );
        console.log(`computed.json saved to ${finalIexecOut}/computed.json`);
    } catch (writeError) {
        console.error(`FATAL: Could not write computed.json to ${finalIexecOut}:`, writeError.message);
        // If computed.json cannot be written, the task might be considered failed by iExec SDK
    }
  }
};

main().catch(e => {
  // Catchall for any unhandled promise rejections from main() itself.
  console.error("Unhandled error in main execution:", e.message || e, e.stack);
  process.exit(1); // Ensure process exits with error if main fails catastrophically
});

// Add a listener for unhandled promise rejections globally, just in case.
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});
