import fs from 'fs/promises';
import figlet from 'figlet';
import { IExecDataProtectorDeserializer } from '@iexec/dataprotector-deserializer';

// ⚠️ Your JavaScript code will be run in a Node.js v14.4 environment with npm v6.
const main = async () => {
  try {
    const { IEXEC_OUT } = process.env;

    let messages = [];

    // Example of process.argv:
    // [ '/usr/local/bin/node', '/app/src/app.js', 'Bob' ]
    const args = process.argv.slice(2);
    console.log(`Received ${args.length} args`);
    messages.push(args.join(' '));

    try {
      const deserializer = new IExecDataProtectorDeserializer();
      // The protected data mock created for the purpose of this Hello World journey
      // contains an object with a key "secretText" which is a string
      const protectedName = await deserializer.getValue('secretText', 'string');
      console.log('Found a protected data');
      messages.push(protectedName);
    } catch (e) {
      console.log('It seems there is an issue with your protected data:', e);
    }

    // Transform input text into an ASCII Art text
    const asciiArtText = figlet.textSync(
      `Hello, ${messages.join(' ') || 'World'}!`
    );

    // Write result to IEXEC_OUT
    await fs.writeFile(`${IEXEC_OUT}/result.txt`, asciiArtText);

    // Build and save a "computed.json" file
    const computedJsonObj = {
      'deterministic-output-path': `${IEXEC_OUT}/result.txt`,
    };
    await fs.writeFile(
      `${IEXEC_OUT}/computed.json`,
      JSON.stringify(computedJsonObj)
    );
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
};

main();
