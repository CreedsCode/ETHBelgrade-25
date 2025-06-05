import DKG from 'dkg.js';
import { BLOCKCHAIN_IDS } from 'dkg.js/constants';
import 'dotenv/config';

const OT_NODE_HOSTNAME = 'https://v6-pegasus-node-02.origin-trail.network';
const OT_NODE_PORT = '8900';

const DkgClient = new DKG({
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

(async () => {
    const content = {
        public: {
            '@context': 'https://www.schema.org',
            '@id': 'urn:first-dkg-ka:info:hello-dkg',
            '@type': 'CreativeWork',
            'name': 'Hello DKG',  // 🎯 Remember this name for querying!
            'description': 'My first Knowledge Asset on the Decentralized Knowledge Graph!'
        },
    };

    console.log('Publishing Knowledge Asset...');
    
    const create_result = await DkgClient.asset.create(content, {
        epochsNum: 2,
        minimumNumberOfFinalizationConfirmations: 3,
        minimumNumberOfNodeReplications: 1,
    });

    console.log('Success! Your Knowledge Asset has been published:');
    console.log(JSON.stringify(create_result, null, 2));
})();