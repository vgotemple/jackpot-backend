const express = require('express');
const socketIO = require("socket.io");
const http = require('http');
const bodyParser = require('body-parser');

var MongoClient = require('mongodb').MongoClient;

const config = require('./bin/config');

if (!config.blockchain.privateKey) return console.error("[Setup] Please connect a blockchain private key");
if (!config.blockchain.accountName) return console.error("[Setup] Please connect a blockchain account name for the private key");
if (!config.jackpot.ownerAccountName) return console.error("[Setup] Please enter the owner's account name");

let transactions = require('./src/transactions');
let jackpot = require('./src/jackpot');

const port = config.port || process.env.PORT || 80;

const app = express()
app.use(express.urlencoded({
    extended: true
}));
app.use(express.json());

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

const server = http.createServer(app);
global.io = socketIO(server);

app.get("/jackpot", (req, res) => {
    let game = jackpot.getCurrentGame();
    res.send(game);
})

app.get("/jackpot/history", async (req, res) => {
    let page = 1;
    try {
        
    if (req.query.page) page = parseInt(req.query.page);
    } catch (err) {}
    let lastGames = await this.DB.collection("jackpots").find({ status: jackpot.GameStatus.ROLLED}).sort({id: -1}).limit(15).skip(15 * (page-1)).toArray();
    res.send(lastGames);
})

server.listen(port, err => {
    if (err) throw new Error(err);
    console.log("[Server]", "Socket and Web Connection started")
});

MongoClient.connect(config.database.url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}, (err, db) => {
    console.log("[Database]", "Connected to database.")
    if (err)
        throw new Error(err);
        
    global.DB = db.db(config.database.db);

    DB.collection("handled_transactions").createIndex({ "trx_id": 1 }, { unique: true }).catch(err => console.log("Index error"));
    DB.collection("jackpots").createIndex({ "id": 1 }, { unique: true }).catch(err => console.log("Index error"));

    socketManager();

    jackpot.start();
    global.JackpotGame = jackpot;
    transactions.registerHandler();
});

function socketManager () {
    io.on("connection", socket => {
        // Send new connected the jackpot game
        let game = jackpot.getCurrentGame();
        socket.emit("jackpot_game", game);

        // Update jackpot on request
        socket.on("jackpot_game", () => {
            let game = jackpot.getCurrentGame();
            socket.emit("jackpot_game", game);
        })

        // Ping Check
        socket.on("ping", text => {
            socket.emit("pong", text)
        })

        socket.on("disconnect", () => {})
    });
}