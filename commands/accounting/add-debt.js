const { SlashCommandBuilder } = require("discord.js");
const mongoose = require("mongoose");
const Expense = require("../../schemas/Expense");
const Balance = require("../../schemas/Balance");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("add-debt")
        .setDescription("Add a direct debt (not a split expense)")
        .addUserOption((option) =>
            option
                .setName("borrower")
                .setDescription("Person who borrowed/owes the money")
                .setRequired(true),
        )
        .addUserOption((option) =>
            option
                .setName("lender")
                .setDescription("Person who lent/is owed the money")
                .setRequired(true),
        )
        .addNumberOption((option) =>
            option
                .setName("amount")
                .setDescription("Amount owed")
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName("description")
                .setDescription("What is this debt for?")
                .setRequired(false),
        ),
    async execute(interaction) {
        const fromUser = interaction.options.getUser("borrower").id;
        const toUser = interaction.options.getUser("lender").id;
        const amount = interaction.options.getNumber("amount");
        const description =
            interaction.options.getString("description") || "Direct debt";

        // Validation
        if (amount <= 0) {
            return interaction.reply({
                content: "Amount must be greater than 0!",
                ephemeral: true,
            });
        }

        if (fromUser === toUser) {
            return interaction.reply({
                content: "Cannot create debt to yourself!",
                ephemeral: true,
            });
        }

        // Start MongoDB transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Create expense where:
            // - Payer is "to" (the person who is owed)
            // - Only participant is "from" (the person who owes)
            // This creates a 1-to-1 debt without splitting
            const expense = await Expense.create(
                [
                    {
                        paidBy: toUser,
                        amount: amount,
                        description: description,
                        participants: [fromUser], // Only the debtor, not the creditor
                        date: new Date(),
                    },
                ],
                { session },
            );

            // Update balance for the person who owes
            let fromBalance = await Balance.findOne({
                userId: fromUser,
            }).session(session);

            if (!fromBalance) {
                fromBalance = new Balance({ userId: fromUser });
            }

            // They owe the full amount (not split)
            fromBalance.totalOwed += amount;
            fromBalance.netBalance =
                fromBalance.totalPaid - fromBalance.totalOwed;
            fromBalance.lastUpdated = new Date();
            await fromBalance.save({ session });

            // Update balance for the person who is owed
            let toBalance = await Balance.findOne({ userId: toUser }).session(
                session,
            );

            if (!toBalance) {
                toBalance = new Balance({ userId: toUser });
            }

            // They "paid" the full amount
            toBalance.totalPaid += amount;
            toBalance.netBalance = toBalance.totalPaid - toBalance.totalOwed;
            toBalance.lastUpdated = new Date();
            await toBalance.save({ session });

            // Commit the transaction
            await session.commitTransaction();

            // Success response
            await interaction.reply(
                `✅ Debt added!\n` +
                    `<@${fromUser}> owes <@${toUser}> $${amount.toFixed(2)}\n` +
                    `Description: ${description}`,
            );
        } catch (error) {
            // Rollback on error
            await session.abortTransaction();
            console.error("Transaction error:", error);
            await interaction.reply({
                content:
                    "❌ Failed to add debt. Please try again.\nError: " +
                    error.message,
                ephemeral: true,
            });
        } finally {
            // Always end the session
            session.endSession();
        }
    },
};
