const { KnownNetworkErrorCodes } = require("discord.js");
const { Schema, model } = require("mongoose");

const balanceSchema = new Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
    },
    totalPaid: {
        type: Number,
        default: 0,
    },
    totalOwed: {
        type: Number,
        default: 0,
    },
    netBalance: {
        type: Number,
        default: 0,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
});
