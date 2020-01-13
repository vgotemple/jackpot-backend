var BlockchainAPI = require("./blockchain");
var config = require("../bin/config");

var gameCheckInterval;

var GameStatus = {
    WAITING_FOR_DEPOSITS: 0,
    COUNTDOWN: 1,
    WAITING_FOR_OUTCOME: 2,
    ROLLING: 3,
    ROLLED: 4,
};

var gameId = 0;
var currentGame = null;

var rolling = false;

// Saves all deposits that come in while it rolls
var depositCache = [];

function getCurrentGame () {
    return currentGame;
}

async function gameCheck () {
    // Checking if game was found
    if (currentGame) {
        // Update pot to Database
        saveCurrentPot();
        // Check if still waiting for deposits
        if (currentGame.status == GameStatus.WAITING_FOR_DEPOSITS || currentGame.status == GameStatus.COUNTDOWN) {
            let deposits = currentGame.deposits;

            // Checking how many unique depositors there are
            let uniqueDepositors = []
            for (i in deposits) {
                if (!uniqueDepositors.includes(deposits[i].accountName)) uniqueDepositors.push(deposits[i].accountName);
            }
            // Checking if enough unique depositors
            if (uniqueDepositors.length >= config.jackpot.minDepositors) {
                // Set state to countdown if enough
                currentGame.status = GameStatus.COUNTDOWN;
            } else {
                // Reset countdown time if not enough depositors
                currentGame.countdown = config.jackpot.countdownTime;
                currentGame.status = GameStatus.WAITING_FOR_DEPOSITS;
            }
        }
        // Checking if counting down
        if (currentGame.status == GameStatus.COUNTDOWN) {
            // Reset countdown if invalid
            if (currentGame.countdown == null) currentGame.countdown = config.jackpot.countdownTime;
            currentGame.countdown--;
            // Log every 5 seconds when countdown running
            currentGame.countdown % 5 == 0 ? console.log("[Jackpot]", "Rolls in "+ currentGame.countdown) : null;
            // Sending out jackpot countdown
            if (global.io) global.io.sockets.emit("jackpot_countdown", currentGame.countdown);

            // Contacting ORNG if countdown at 0
            if (currentGame.countdown == 0) {
                // Updating status when waiting for outcome
                currentGame.status = GameStatus.WAITING_FOR_OUTCOME;

                // Requesting random outcome
                requestOutcome();
            }
        }
        // If waiting for outcome to be generated (~7 seconds)
        if (currentGame.status == GameStatus.WAITING_FOR_OUTCOME) {
            // If transactions.js updated the currentGame's outcome from orng
            if (currentGame.outcome) { 
                // Checking if already rolling (Only run it once!)
                if (!rolling) {
                    // setting to rolling
                    rolling = true;

                    // Updating status
                    currentGame.status = GameStatus.ROLLING;
                    // announceing status update 
                    if (global.io) global.io.sockets.emit("jackpot_status", currentGame.status);


                    let deposits = currentGame.deposits;
                    let winner;

                    let outcome = currentGame.outcome.percent;

                    let winningTicket = Math.ceil(currentGame.worth * outcome);

                    let tmpTicket = 0;

                    // Calculating who is winner based on deposits
                    for (i in deposits) {
                        let deposit = deposits[i];
                        if (winningTicket > tmpTicket && winningTicket <= tmpTicket + deposit.worth) {
                            winner = deposit.accountName;
                        }
                        tmpTicket += deposit.worth;
                    }

                    // Logging who won
                    console.log("[Jackpot]", "Winner:", winner, "Outcome:", outcome, "Winning Ticket:", winningTicket);

                    currentGame.winner = winner;
                    currentGame.winningTicket = winningTicket;
                    // Saving current pot
                    saveCurrentPot();

                    // Rolll out winnings
                    rollWinnings(winner, deposits, currentGame.worth);

                    // Setting game to rolled
                    setTimeout(() => {
                        currentGame.status = GameStatus.ROLLED;
                        rolling = false;
                        // Save updated pot
                        saveCurrentPot();
                    }, config.jackpot.spinningTime * 1000);
                }
            }
        }
        if (currentGame.status == GameStatus.ROLLED) {
            // Create new Game if already rolled
            createGame()
        }
        // Update status
        if (global.io) global.io.sockets.emit("jackpot_status", currentGame.status);
    } else {
        // Create game if not found
        createGame()
    }
}

function requestOutcome() {
    return new Promise((resolve, reject) => {
        // Requesting random outcome
        BlockchainAPI.requestRand(config.jackpot.assoc_id);
    });
}

function setOutcome(outcome) {
    return new Promise(resolve => {
        // Calculating percent from outcome data
        let percent = calcPercent(outcome.data);
        // Inserting percentage
        outcome.percent = percent;
        // updating current game's outcome
        currentGame.outcome = outcome;
        resolve()
    })
}

// Formula to calculate percentage from outcome
function calcPercent(outcome) {
    // substring because the first 16 characters are based from the assoc_id and will stay the same
    var seed = parseInt(outcome.substr(16), 16);
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

// start a new game
function createGame () {
    gameId++;
    let worth = 0;
    // add all deposits that happend while rolling
    for (let i = 0; i<depositCache.length; i++) {
        worth += depositCache[i].worth;
    }
    // new game object
    var game = {
        id: gameId,
        status: GameStatus.WAITING_FOR_DEPOSITS,
        deposits: depositCache,
        worth: worth,
        countdown: config.jackpot.countdownTime,
    };
    console.error("[Jackpot]", `New Game #${gameId} created.`);
    // reset cached deposits
    depositCache = [];
    // update current game
    currentGame = game;
    // Update that new round began
    if (global.io) global.io.sockets.emit("jackpot_game", currentGame);
}

function rollWinnings (winner, deposits, worth) {
    // Announce the winner (Spinner can start rolling, etc.)
    global.io.sockets.emit("jackpot_winner", winner)
    let winnings = [];
    let rake = [];
    let tax = worth * (config.jackpot.houseEdge / 100);
    //
    let sentProfit = false;
    for (let i = 0; i<deposits.length; i++) {
        let deposit = deposits[i];
        deposit.nfts = deposit.nfts.sort((a,b) => a.worth - b.worth)
        for (let j = 0; j<deposit.nfts.length; j++) {
            let nft = deposit.nfts[j];
            // Winner gets all of own items back
            if (winner != deposit.accountName) {
                // check if item is worth less than houseedge 
                // and 
                // check if winner already got atleast one nft as profit
                if (nft.worth <= tax && sentProfit) {
                    // add to rake list
                    rake.push(nft.id);
                    // updated house edge
                    tax -= nft.worth;
                } else {
                    // set that profit was sent
                    sentProfit = true;
                    // add to winnings list
                    winnings.push(nft.id);
                }
            } else {
                // add to winnings list
                winnings.push(nft.id);
            }
        }
    }
    // Send winnings to winner
    sendWinnings(winner, winnings, currentGame.id);
    if (rake.length > 0) {
        BlockchainAPI.sendNFTs(config.jackpot.ownerAccountName, rake, `House Edge #${currentGame.id}`).catch(err => {
            console.error("[Jackpot]", "Failed sending rake.", err);
            global.DB.collection("rake").insertOne({
                pot: currentGame.id,
                rake: rake,
            })
        })
    } else {
        console.log("[Jackpot]", `#${gameId}: No rake in this pot`)
    }
}

function sendWinnings(winner, winnings, gameId) {
    console.log("[Jackpot]", `#${gameId}: Sending ${winnings.length} to ${winner}`)
    BlockchainAPI.sendNFTs(winner, winnings, `Jackpot Winnings #${gameId}`).then(() => {
    }).catch(err => {
        console.error("[Jackpot]", "Failed sending prizes, trying again.", err);
        setTimeout(() => {
            sendWinnings(winner, winnings, gameId);
        }, 5000)
    })
}


function deposit (accountName, nfts, worth, trx_id) {
    return new Promise(async (resolve) => {
        // deposit object
        let deposit = {
            accountName: accountName,
            nfts: nfts,
            worth: worth,
            trx_id: trx_id,
        }
        if (currentGame.status == GameStatus.WAITING_FOR_DEPOSITS || currentGame.status == GameStatus.COUNTDOWN) {
            // Add to pot
            depositToPot(deposit)
            // save current pot
            saveCurrentPot();
        } else {
            // add to depositCache for next round (If already started)
            depositCache.push(deposit);
        }
        resolve()
    });
}

function saveCurrentPot () {
    // update lastDBUpdate
    currentGame.lastDBUpdate = new Date().getTime();
    // update current pot, create if doesn't not exists
    this.DB.collection("jackpots").updateOne({ id: currentGame.id }, {$set: currentGame}, { upsert: true })
}

function fetchLastJackpot () {
    return new Promise(async resolve => {
        // Fetch last Games, Check if there is a pot to resume
        let lastGames = await this.DB.collection("jackpots").find().sort({_id: -1}).limit(1).toArray();
        // if a pot exists
        if (lastGames && lastGames.length > 0) {
            let lastGame = lastGames[0];
            gameId = lastGame.id;
            // Check if its still active / waiting for outcome
            if (lastGame.status == GameStatus.WAITING_FOR_DEPOSITS || lastGame.status == GameStatus.COUNTDOWN || lastGame.status == GameStatus.WAITING_FOR_OUTCOME) {
                currentGame = lastGame;
                currentGame.countdown = config.jackpot.countdownTime;
                console.log("[Jackpot]", `#${currentGame.id}: Loaded last game`)
            } else {
                // Create game if already rolled
                createGame();
            }
            resolve()
        } else {
            // create game if no pot exists
            createGame();
            resolve()
        }
    })
}

function depositToPot (deposit) {
    // Updated pot worth based on deposit
    currentGame.worth += deposit.worth;
    // add deposit to current game
    currentGame.deposits.push(deposit);
    // emit new deposit
    if (global.io) global.io.sockets.emit("jackpot_deposit", deposit);
}

function startJackpot () {
    // run initial game check
    gameCheck();
    console.log("[Jackpot]", "Game started.")
    // start jackpot gamemode listener
    gameCheckInterval = setInterval(gameCheck, 1000);
}

module.exports = {
    start: async () => {
        // Fetch and load most recent pot
        await fetchLastJackpot();
        // start jackpot gamemode
        startJackpot();
    },
    stopjackpot: () => {
        // stop jackpot gamemode
        clearInterval(gameCheckInterval);
    },
    startJackpot: startJackpot,
    getCurrentGame: getCurrentGame,
    deposit: deposit,
    GameStatus: GameStatus,
    setOutcome: setOutcome,
};
