const {
    Api,
    JsonRpc,
    RpcError
} = require('eosjs');
const {
    JsSignatureProvider
} = require('eosjs/dist/eosjs-jssig');
const {
    TextDecoder,
    TextEncoder
} = require('text-encoding');

const fetch = require("node-fetch");
const config = require('../bin/config')

const defaultPrivateKey = config.blockchain.privateKey;
let accountName = config.blockchain.accountName;

const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new JsonRpc('https://wax.greymass.com', {
    fetch
});

const api = new Api({
    rpc,
    signatureProvider,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
});

function findSigningValue () {
    return new Promise((resolve, reject) => {
        let sign_val = parseInt(Math.random() * 100000000000) + 246246;
        rpc.get_table_rows({
            json: true,
            code: 'orng.wax',
            scope: "orng.wax",
            lower_bound: sign_val,
            table: 'signvals.a',
            limit: 1,
        }).then(result => {
            if (result && result.rows && result.rows.length > 0 && result.rows[0] == sign_val) {
                findSigningValue().then(resolve).catch(reject);
            } else {
                resolve(sign_val)
            }
        }).catch(reject);
    })
}


module.exports = {
    sendNFTs: (to, assets, memo) => {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await api.transact({
                    actions: [{
                        account: 'simpleassets',
                        name: 'transfer',
                        authorization: [{
                            actor: accountName,
                            permission: 'active',
                        }],
                        data: {
                            from: accountName,
                            to: to,
                            assetids: assets,
                            memo: memo,
                        },
                    }]
                }, {
                    blocksBehind: 3,
                    expireSeconds: 30,
                });
                resolve(result);
            } catch (e) {
                console.log('\nCaught exception: ' + e);
                if (e instanceof RpcError)
                    console.log(JSON.stringify(e.json, null, 2));
                reject(e)
            }
        })
    },
    requestRand: (assoc_id) => {
        return new Promise(async (resolve, reject) => {
            try {
                let sign_val = await findSigningValue();
                console.log("[orng.wax]", "Found Signing Value", sign_val)
                const result = await api.transact({
                    actions: [{
                        account: 'orng.wax',
                        name: 'requestrand',
                        authorization: [{
                            actor: accountName,
                            permission: 'active',
                        }],
                        data: {
                            assoc_id: assoc_id,
                            signing_value: sign_val,
                            caller: accountName
                        },
                    }]
                }, {
                    blocksBehind: 3,
                    expireSeconds: 30,
                });
                resolve(result);
            } catch (e) {
                console.log('\nCaught exception: ' + e);
                if (e instanceof RpcError)
                    console.log(JSON.stringify(e.json, null, 2));
                reject(e)
            }
        })
    },
};

