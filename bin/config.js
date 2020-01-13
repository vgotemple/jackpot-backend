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
