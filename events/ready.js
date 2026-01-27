const { Events } = require("discord.js");
const mongoose = require("mongoose");
const mongoURL = process.env.MONGODB_URI;

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Ready! Logged in as ${client.user.tag}`);

        if (!mongoURL) return;

        try {
            await mongoose.connect(mongoURL);
            console.log("Connected to MongoDB");
        } catch (error) {
            console.error("MongoDB connection error:", error);
        }
    },
};
