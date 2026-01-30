const { SlashCommandBuilder } = require("discord.js");
const Expense = require("../../schemas/Expense");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("settle")
        .setDescription("Settle your share of an expense.")
        .addUserOption((option) =>
            option
                .setName("to")
                .setDescription("The user you are settling with")
                .setRequired(true),
        )
        .addNumberOption((option) =>
            option
                .setName("amount")
                .setDescription("The amount to settle")
                .setRequired(true),
        ),
    async execute(interaction) {
        const fromUser = interaction.user.id;
        const toUser = interaction.options.getUser("to").id;
        const amount = interaction.options.getNumber("amount");

        //validation
        if (amount <= 0) {
            return interaction.reply({
                content: "Amount must be greater than zero.",
                ephemeral: true,
            });
        }

        if (fromUser === toUser) {
            return interaction.reply({
                content: "You cannot settle with yourself.",
                ephemeral: true,
            });
        }

        // Find expenses where toUser paid and fromUser is a participant
        const expenses = await Expense.find({
            paidBy: toUser,
            participants: fromUser,
        });

        const unsettledExpenses = expenses.filter(
            (exp) => exp.getRemainingAmount(fromUser) > 0,
        );

        if (unsettledExpenses.length === 0) {
            return interaction.reply({
                content: `You don't owe <@${toUser}> any money!.`,
                ephemeral: true,
            });
        }

        //calculate total owed
        const totalOwed = unsettledExpenses.reduce(
            (sum, exp) => sum + exp.getRemainingAmount(fromUser),
            0,
        );

        if (amount > totalOwed) {
            return interaction.reply({
                content: `You only owe <@${toUser}> a total of $${totalOwed.toFixed(2)}.`,
                ephemeral: true,
            });
        }

        //Start transaction
        const session = await Expense.startSession();
        session.startTransaction();

        try {
            let remainingAmount = amount;

            //Apply payment to expenses, oldest first
            for (const expense of unsettledExpenses) {
                if (remainingAmount <= 0) break;

                const owed = expense.getRemainingAmount(fromUser);
                const paymentAmount = Math.min(owed, remainingAmount);

                //Add settlement record to expense
                expense.settlements.push({
                    userId: fromUser,
                    amountPaid: paymentAmount,
                    date: new Date(),
                });

                await expense.save({ session });
                remainingAmount -= paymentAmount;
            }

            await session.commitTransaction();

            // Calculate remaining debt after settlement
            const remainingDebt = totalOwed - amount;

            // Build response message
            let message = `Settlement recorded!\n`;
            message += `You paid <@${toUser}> $${amount.toFixed(2)}\n\n`;

            if (remainingDebt > 0.01) {
                message += `Remaining debt to <@${toUser}>: $${remainingDebt.toFixed(2)}`;
            } else {
                message += `All debts to <@${toUser}> are now settled!`;
            }

            await interaction.reply(message);
        } catch (error) {
            await session.abortTransaction();
            console.error("Settlement error:", error);
            await interaction.reply({
                content: "Failed to record settlement. Please try again.",
                ephemeral: true,
            });
        } finally {
            session.endSession();
        }
    },
};
