const { SlashCommandBuilder } = require("discord.js");
const mongoose = require("mongoose");
const Expense = require("../../schemas/Expense");
const Balance = require("../../schemas/Balance");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("delete-expense")
        .setDescription("Delete your most recent expense"),
    async execute(interaction) {
        const userId = interaction.user.id;

        // Find user's most recent expense
        const expense = await Expense.findOne({ paidBy: userId })
            .sort({ date: -1 })
            .limit(1);

        if (!expense) {
            return interaction.reply({
                content: "You have no expenses to delete!",
                ephemeral: true,
            });
        }

        // Check if expense has any settlements
        if (expense.settlements.length > 0) {
            return interaction.reply({
                content:
                    `❌ Cannot delete expense with settlements!\n` +
                    `Expense: $${expense.amount.toFixed(2)} - ${expense.description || "No description"}\n` +
                    `${expense.settlements.length} settlement(s) recorded.\n` +
                    `Contact participants to reverse settlements first.`,
                ephemeral: true,
            });
        }

        // Start transaction to reverse balances and delete
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            const splitAmount = expense.amount / expense.participants.length;

            // Reverse balance updates for all participants
            for (const participantId of expense.participants) {
                const balance = await Balance.findOne({
                    userId: participantId,
                }).session(session);

                if (balance) {
                    if (participantId === expense.paidBy) {
                        // Payer: subtract what was added in addExpense
                        balance.totalPaid -= expense.amount;
                        balance.totalOwed -= splitAmount;
                    } else {
                        // Non-payer: subtract what was added
                        balance.totalOwed -= splitAmount;
                    }

                    // Recalculate net balance
                    balance.netBalance = balance.totalPaid - balance.totalOwed;
                    balance.lastUpdated = new Date();
                    await balance.save({ session });
                }
            }

            // Delete the expense document
            await Expense.findByIdAndDelete(expense._id, { session });

            // Commit the transaction
            await session.commitTransaction();

            await interaction.reply(
                `✅ Expense deleted successfully!\n` +
                    `$${expense.amount.toFixed(2)} - ${expense.description || "No description"}\n` +
                    `Date: ${expense.date.toDateString()}`,
            );
        } catch (error) {
            // Rollback on error
            await session.abortTransaction();
            console.error("Delete expense error:", error);
            await interaction.reply({
                content:
                    "❌ Failed to delete expense. Please try again.\nError: " +
                    error.message,
                ephemeral: true,
            });
        } finally {
            // Always end the session
            session.endSession();
        }
    },
};
