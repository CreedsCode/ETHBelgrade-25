import express from 'express';
import bodyParser from 'body-parser';
import DKG from 'dkg.js';
import { BLOCKCHAIN_IDS } from 'dkg.js/constants';
import 'dotenv/config';

const OT_NODE_HOSTNAME = 'https://v6-pegasus-node-02.origin-trail.network';
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
        const result = await publishKnowledgeAsset(content);
        res.status(200).json({ success: true, result });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

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

app.listen(PORT, () => {
    console.log(`API server listening on port ${PORT}`);
}); 