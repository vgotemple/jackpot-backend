# jackpot-backend
 VGO Jackpot Backend on Blockchain

___
## Setup

**Requirements:**
- NodeJS
- MongoDB
- nginx / apache2
- Wallet on WAX Blockchain (Private Key) (Enough Resources on that Wallet aswell)

**Installation:**
_Run following commands_
> git clone https://github.com/vgotemple/jackpot-backend.git

> cd jackpot-backend

> npm i

**Configure:**
_Now open ```bin/config.js``` and edit your details_
```js
module.exports = {
    database: {
        url: 'mongodb://localhost:27017/', // Connection to MongoDB Database
        db: 'jackpot-site', // database name
    },
    port: 1337, // Where the socket connection accessible
    blockchain: {
        privateKey: "", // Private Key for your wallet
        accountName: "", // Wallet Account Name (That manages the NFTs)
    },
    jackpot: {
        assoc_id: 1, // ORNG, (Identifier)
        houseEdge: 10, // How much % of the winnings you take as your cut
        countdownTime: 45, // How long it takes to start new round
        minDepositors: 2, // How many unique depositers there have to be to start the game
        spinningTime: 6, // Amount of seconds it waits after winner revealed
        ownerAccountName: "", // Wallet Account Name (The house edge will be sent here)
    },
};
```

**Start:**
_Now start it with:_
> npm start

**Objects:**

Jackpot Game:
```jsonc
{
   "id": 1, // GameID
   "countdown": 60, // CountDown in seconds
   "deposits": [ {/** Deposit Object */} ], // all deposits in this pot
   "lastDBUpdate": 1278583978990, // last time database updated this pot
   "status": 0, // game status (see: GameStatus Object)
   "worth": 1230, // pot worth in cents
   "outcome":
   {
        "trx_id": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // transaction id for orng outcome generation
        "data": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", // orng outcome
        "percent": 0.420691337 // calculated outcome from orng outcome
   },
   "winner": "winner.wam", // winner of pot
   "winningTicket": 99 // ticket that won
}
```

Deposit:
```jsonc
{
    "accountName": "depositor.wam", // account that deposited the nft
    "nfts":
    [
        {
            "id": "100000000378323", // assetid
            "author": "vgo", // author of nft
            "category": "............1", // nft category by simpleassets
            "idata": {}, // Immutable asset data
            "mdata":
            {
                "name": "Dual Berettas | Trigger Happy (Battle-Scarred)", // VGO Skin Name
                "img": "QmWz9qM6z5NL1F11rtMdQcYj2Cxdqsyye5BZbwREWf8Nm5", // VGO Skin Image (Link: https://ipfs.io/ipfs/QmWz9qM6z5NL1F11rtMdQcYj2Cxdqsyye5BZbwREWf8Nm5)
                "unique": "QmPaYpbudFJhnUcRSSWqouoFKEXuknb2X9HJR41wUfWAMc", // Unique Data (Link: https://ipfs.io/ipfs/QmPaYpbudFJhnUcRSSWqouoFKEXuknb2X9HJR41wUfWAMc)
                "generic": "QmRdFvXcgWisohhRFa4LFTHTpMEj6ftd3jAskedBjz5yUt" // Generic Skin Data (Link: https://ipfs.io/ipfs/QmRdFvXcgWisohhRFa4LFTHTpMEj6ftd3jAskedBjz5yUt)
            },
            "rarity": "Mil-Spec", // rarity of vgo skin
            "worth": 3 // VGO Skin worth in cents
        }
    ],
    "worth": 3, // total deposit worth in cents
    "trx_id": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" // Deposit transaction id
}
```

GameStatus:
```jsonc
{
    "WAITING_FOR_DEPOSITS": 0,
    "COUNTDOWN": 1,
    "WAITING_FOR_OUTCOME": 2,
    "ROLLING": 3,
    "ROLLED": 4,
}
```

**Endpoints:**

Socket:

Live socket.io connection: `http://127.0.0.1:1337/socket.io/`



Jackpot:

Current Jackpot Information: `http://127.0.0.1:1337/jackpot/` 

History Pots: `http://127.0.0.1:1337/jackpot/history`

**nginx:**
_Example config:_
```nginx
server {
    listen 80;
    listen [::]:80;

    server_name yourdomain.com www.yourdomain.com; # configure your domain

    root /var/www/yourdomain.com; # Link frontend files

    index index.html;

    location / {
        # Link here to your front end if required:
        try_files $uri $uri/ /index.html =404;
    }

    location /socket.io/ {
        proxy_pass http://localhost:1337/socket.io/; # edit port here
    }

    location /jackpot/ {
        proxy_pass http://localhost:1337/jackpot/; # edit port here
    }
}
```
_With the config:_
Live socket.io connection: `https://yourdomain.com/socket.io/`

Current Jackpot Information: `https://yourdomain.com/jackpot/` 

History Pots: `https://yourdomain.com/jackpot/history`


**Socket Actions:**


_On Connection:_ `socket.emit("jackpot_game", gameObject)`

_On client.on("jackpot\_game"):_ `socket.emit("jackpot_game", gameObject)`

_On client.on("ping", input):_ `socket.emit("pong", input)`


Jackpot Interval:

_On Countdown:_ `socket.emit("jackpot_countdown", gameObject.countdown)`

_On Update:_ `socket.emit("jackpot_status", gameObject.status)`

_On Status Update:_ `socket.emit("jackpot_status", gameObject.status)`

_On Deposit:_ `socket.emit("jackpot_deposit", depositObject)`

_On Roll (When Spinner starts):_ `socket.emit("jackpot_winner", gameObject.winner)`

_On New Game:_ `socket.emit("jackpot_game", gameObject)`

___
