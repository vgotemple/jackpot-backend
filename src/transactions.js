var request = require("request");
var config = require("../bin/config");
var NFTAPI = require("./nftdata")
var BlockchainAPI = require("./blockchain")

let botAccountName = config.blockchain.accountName;

function fetchRecentTransactions () {
    var postData = {
        "account_name": botAccountName,
        "pos": -1,
        "offset": -100
    };
    var url = 'https://wax.greymass.com/v1/history/get_actions';
    var options = {
        method: 'post',
        body: postData,
        json: true,
        url: url
    }
    request(options, async (err, res, body) => {
        try {
            body = JSON.parse(body);
        } catch (err) {}
        let actions = body.actions;
        actions = actions.reverse()
        for (i in actions) {
            let action = actions[i];
            handleAction(action).catch(err => {})
        }
    })
}

async function handleAction(action) {
    let {
        trx_id,
        act
    } = action.action_trace;
    return new Promise(async (resolve, reject) => {
        /** handle received random */
        if (act.account == botAccountName && act.name == "receiverand" && act.authorization[0].actor == "orng.wax") {
            // Add to handled Transactions. (If already handled this will throw an error (Which we catch))
            global.DB.collection("handled_transactions").insertOne({ trx_id: trx_id }).then(async res => {
                let outcome = {
                    trx_id: trx_id,
                    data: act.data,
                };
                try {
                    // Add outcome to system
                    console.log("[orng.wax]", "Received outcome", outcome)
                    await global.JackpotGame.setOutcome(outcome)
                } catch (err) {
                    console.error(err)
                }
                resolve()
            }).catch(reject)
        } 
        /** handle deposit */
        else if (act.account == "simpleassets" && act.name == "transfer") {
            // Check if recipient of NFT is the jackpot's bot
            if (act.data.to == botAccountName && act.data.from != botAccountName) {
                // Get Current Game
                let currentGame = global.JackpotGame.getCurrentGame();
                // Check if memo is referring to jackpot deposit and if there is a game running, otherwise ignore
                if (act.data.memo == "Deposit#Jackpot" && currentGame) {
                    // Add to handled Transactions. (If already handled this will throw an error (Which we catch))
                    global.DB.collection("handled_transactions").insertOne({ trx_id: trx_id, currentGame: currentGame.id  }).then(async res => {
    
                        let nfts = [];
                        let totalWorth = 0;
                        // Go through all deposited assets
                        for (i in act.data.assetids) {
                            let assetid = act.data.assetids[i];
                            // Fetch asset data for nft
                            let assetData = await NFTAPI.getAssetData(assetid);
                            if (assetData) {
                                // parse to json
                                try {assetData.idata = JSON.parse(assetData.idata)} catch (e) {}
                                try {assetData.mdata = JSON.parse(assetData.mdata)} catch (e) {}
                                let name = assetData.mdata.name ? assetData.mdata.name : assetData.idata.name;
                                // Check if is a real VGO item
                                if (assetData.author == "vgo") {
                                    try {
                                        // Fetch NFTs MoreVGO data
                                        let { market_name, rarity, price } = await NFTAPI.getVGOAsset(name);
                                        totalWorth += price;
                                        assetData.id = assetid;
                                        assetData.rarity = rarity;
                                        assetData.worth = price;
                                        console.log("[Deposit]", "From: " + act.data.from, "Item: "+market_name, "Worth: $" + (price / 100));
                                        nfts.push(assetData);
                                    } catch (err) {
                                        // Refund NFT if couldnt fetch more data
                                        console.error("Failed to fetch data for "+market_name, "AssetID:", assetid)
                                        console.error("Output: ", err)
                                        BlockchainAPI.sendNFTs(act.data.from, [assetid], `Refund: Failed to fetch pricing for this nft.`)
                                    }
                                } else {
                                    console.log("[Jackpot]", act.data.from, "tried to deposit NON VGO item.")
                                    BlockchainAPI.sendNFTs(act.data.from, [assetid], `Refund: Only VGO is allowed on this site`)
                                }
                            }
                        }
                        // Check if there are vgo items deposited and there is a worth
                        if (totalWorth <= 0) return resolve();
                        // Add deposit to system
                        await global.JackpotGame.deposit(act.data.from, nfts, totalWorth, trx_id)
                        act.trx_id = trx_id;
                        resolve()
                    }).catch(reject);
                    return;
                } else {
                    return resolve()
                }
            } else {
                return resolve()
            }
        } else {
            return resolve()
        }
    })
}

function registerHandler () {
    fetchRecentTransactions();
    setInterval(fetchRecentTransactions, 1000);
}

module.exports = {
    registerHandler: registerHandler,
}