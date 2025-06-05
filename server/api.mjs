import express from 'express';
import bodyParser from 'body-parser';
import DKG from 'dkg.js';
import { BLOCKCHAIN_IDS } from 'dkg.js/constants';
import 'dotenv/config';
import fs from 'fs/promises';

import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OT_NODE_HOSTNAME = 'https://v6-pegasus-node-03.origin-trail.network';
const OT_NODE_PORT = '8900';

function getDkgClient() {
    return new DKG({
        endpoint: OT_NODE_HOSTNAME,
        port: OT_NODE_PORT,
        blockchain: {
            name: BLOCKCHAIN_IDS.NEUROWEB_TESTNET,
            privateKey: process.env.PRIVATE_KEY,
        },
        maxNumberOfRetries: 300,
        frequency: 2,
        contentType: 'all',
        nodeApiVersion: '/v1',
    });
}

async function publishKnowledgeAsset(content) {
    const DkgClient = getDkgClient();
    return await DkgClient.asset.create(content, {
        epochsNum: 2,
        minimumNumberOfFinalizationConfirmations: 3,
        minimumNumberOfNodeReplications: 1,
    });
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

app.post('/publish', async (req, res) => {
    const content = req.body;
    if (!content || typeof content !== 'object') {
        return res.status(400).json({ error: 'Invalid content. Please provide a valid JSON object.' });
    }
    try {
        console.log('Publishing Knowledge Asset...');
        //const result = await publishKnowledgeAsset(content);
        const result = "test";
        // Store in local file
        const assetRecord = { timestamp: new Date().toISOString(), content, result };
        const dirPath = path.join(__dirname, 'server');
        const filePath = path.join(dirPath, 'published_assets.json');
        let assets = [];
        try {
            const data = await fs.readFile(filePath, 'utf-8');
            assets = JSON.parse(data);
        } catch (e) {
            // File does not exist or is invalid, start fresh
            assets = [];
        }
        assets.push(assetRecord);
        await fs.writeFile(filePath, JSON.stringify(assets, null, 2));
        res.status(200).json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// app.post('/publish', async (req, res) => {
//     const content = req.body;

//     if (!content || typeof content !== 'object') {
//         return res.status(400).json({ error: 'Invalid content. Please provide a valid JSON object.' });
//     }

//     try {
//         console.log('Publishing Knowledge Asset...');
//         // const result = await publishKnowledgeAsset(content);
//         const result = "test";

//         const assetRecord = {
//             timestamp: new Date().toISOString(),
//             content,
//             result
//         };

//         const fileDir = path.join(__dirname, 'server');
//         const filePath = path.join(fileDir, 'published_assets.json');

//         // Ensure directory exists
//         try {
//             await fs.mkdir(fileDir, { recursive: true });
//         } catch (e) {
//             console.error('Failed to ensure directory:', e.message);
//         }

//         let assets = [];
//         try {
//             const data = await fs.readFile(filePath, 'utf-8');
//             assets = JSON.parse(data);
//         } catch (e) {
//             // File doesn't exist or is invalid JSON
//             assets = [];
//         }

//         assets.push(assetRecord);
//         await fs.writeFile(filePath, JSON.stringify(assets, null, 2));

//         res.status(200).json({ success: true, result });
//     } catch (error) {
//         res.status(500).json({ success: false, error: error.message });
//     }
// });

app.post('/query', async (req, res) => {
    const { query, queryType } = req.body;
    if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid query string.' });
    }
    // Default to SELECT if not provided
    const type = queryType || 'SELECT';
    try {
        const DkgClient = getDkgClient();
        const result = await DkgClient.graph.query(query, type);
        res.status(200).json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/published-assets', async (req, res) => {
    const filePath = './server/published_assets.json';
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        const assets = JSON.parse(data);
        res.status(200).json({ success: true, assets });
    } catch (e) {
        // File does not exist or is invalid
        res.status(200).json({ success: true, assets: [] });
    }
});

app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
}); 