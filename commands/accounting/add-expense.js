const { SlashCommandBuilder } = require("discord.js");
const mongoose = require("mongoose");
const Expense = require("../../schemas/Expense");
const Balance = require("../../schemas/Balance");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add-expense")
        .setDescription("Add an expense that was paid for")
        .addNumberOption((option) =>
            option
                .setName("amount")
                .setDescription("Amount paid")
                .setRequired(true),
        )
        .addUserOption((option) =>
            option
                .setName("paidby")
                .setDescription("Who paid for this expense")
                .setRequired(true),
        )
        .addUserOption((option) =>
            option
                .setName("split1")
                .setDescription("Person to split with (including payer)")
                .setRequired(true),
        )
        .addUserOption((option) =>
            option
                .setName("split2")
                .setDescription("Additional person")
                .setRequired(false),
        )
        .addUserOption((option) =>
            option
                .setName("split3")
                .setDescription("Additional person")
                .setRequired(false),
        )
        .addUserOption((option) =>
            option
                .setName("split4")
                .setDescription("Additional person")
                .setRequired(false),
        )
        .addUserOption((option) =>
            option
                .setName("split5")
                .setDescription("Additional person")
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("description")
                .setDescription("What was this for?")
                .setRequired(false),
        ),
    async execute(interaction) {
        const paidBy = interaction.options.getUser("paidby").id;
        const amount = interaction.options.getNumber("amount");
        const description =
            interaction.options.getString("description") ||
            "No description provided";

        // Collect participants from all split options
        const participants = [];
        for (let i = 1; i <= 5; i++) {
            const user = interaction.options.getUser(`split${i}`);
            if (user) participants.push(user.id);
        }

        // Ensure payer is included in participants
        if (!participants.includes(paidBy)) {
            participants.push(paidBy);
        }

        // Validation
        if (amount <= 0) {
            return interaction.reply({
                content: "Amount must be greater than 0!",
                ephemeral: true,
            });
        }

        if (participants.length === 0) {
            return interaction.reply({
                content: "You need at least one participant!",
                ephemeral: true,
            });
        }

        const splitAmount = amount / participants.length;

        // Start a MongoDB transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // 1. Create the expense document
            const expense = await Expense.create(
                [
                    {
                        paidBy,
                        amount,
                        description,
                        participants,
                        date: new Date(),
                        settled: false,
                    },
                ],
                { session },
            );

            // 2. Update balances for all participants
            for (const userId of participants) {
                // Find or create balance document
                let balance = await Balance.findOne({ userId }).session(
                    session,
                );

                if (!balance) {
                    balance = new Balance({ userId });
                }

                // Update based on role
                if (userId === paidBy) {
                    // Payer: increase totalPaid and totalOwed (for their share)
                    balance.totalPaid += amount;
                    balance.totalOwed += splitAmount;
                } else {
                    // Non-payer: only increase totalOwed
                    balance.totalOwed += splitAmount;
                }

                // Recalculate net balance
                balance.netBalance = balance.totalPaid - balance.totalOwed;
                balance.lastUpdated = new Date();

                await balance.save({ session });
            }

            // 3. Commit the transaction
            await session.commitTransaction();

            // Success response
            await interaction.reply(
                `Expense added! $${amount.toFixed(2)} split ${participants.length} ways ($${splitAmount.toFixed(2)} each)\n` +
                    `Paid by: <@${paidBy}>\n` +
                    `Participants: ${participants.map((id) => `<@${id}>`).join(", ")}\n` +
                    `Description: ${description}`,
            );
        } catch (error) {
            // 4. Rollback on error
            await session.abortTransaction();
            console.error("Transaction error:", error);
            await interaction.reply({
                content:
                    "Failed to add expense. Please try again.\nError: " +
                    error.message,
                ephemeral: true,
            });
        } finally {
            // 5. Always end the session
            session.endSession();
        }
    },
};
