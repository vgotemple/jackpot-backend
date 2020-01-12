let request = require("request");
var config = require("../bin/config");

let botAccountName = config.blockchain.accountName;

module.exports = {
    getAssetData: (assetid, owner) => {
        return new Promise((resolve, reject) => {
            var postData = {
                "json": true,
                "code": "simpleassets",
                "scope": owner ? owner : botAccountName,
                "table": "sassets",
                "table_key": "",
                "lower_bound": assetid,
                "upper_bound": null,
                "index_position": 1,
                "key_type": "i64",
                "limit": 1,
                "reverse": false,
                "show_payer": false
            };
            var url = 'https://wax.greymass.com/v1/chain/get_table_rows';
            var options = {
                method: 'post',
                body: postData,
                json: true,
                url: url
            }
            request(options, (err, res, body) => {
                try {
                    body = JSON.parse(body);
                } catch (err) {}
                let nft = body.rows[0];
                resolve(nft);
            })
        })
    },
    getAssetPricing: (name) => {
        return new Promise((resolve, reject) => {
            // Todo More VGO
            request("https://morevgo.com/pricing?market_name="+name, { json: true }, (err, res, body) => {
                if (err) return reject(err);
                try {
                    body = JSON.parse(body);
                } catch (e) {}
                if (body && body.length == 1) {
                    let vgo = body[0];
                    resolve(vgo.price);
                } else {
                    reject("Pricing not found " + name)
                }
            })
        })
    },
    getVGOAsset: (name) => {
        return new Promise((resolve, reject) => {
            request("https://morevgo.com/pricing?market_name="+name, { json: true }, (err, res, body) => {
                if (err) return reject(err);
                try {
                    body = JSON.parse(body);
                } catch (e) {}
                if (body && body.length == 1) {
                    let vgo = body[0];
                    resolve(vgo);
                } else {
                    reject("VGO Asset not found " + name)
                }
            })
        })
    },
}