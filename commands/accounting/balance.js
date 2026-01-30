const { SlashCommandBuilder, EmbedBuilder, Embed } = require("discord.js");
const Expense = require("../../schemas/Expense");
const Balance = require("../../schemas/Balance");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("balance")
        .setDescription(
            "Check your current balance and who you owe or are owed by.",
        )
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to check balance for (default: yourself)")
                .setRequired(false),
        ),
    async execute(interaction) {
        const user = interaction.options.getUser("user") || interaction.user;
        const userId = user.id;

        //Calculate pairwise debts
        const expenses = await Expense.find({
            participants: userId,
        });
        const debts = {};

        for (const expense of expenses) {
            const payer = expense.paidBy;
            const splitAmount = expense.amount / expense.participants.length;

            if (payer === userId) {
                // You paid - others owe you (minus what they've already paid)
                for (const participant of expense.participants) {
                    if (participant !== userId) {
                        const remainingAmount =
                            expense.getRemainingAmount(participant);
                        if (remainingAmount > 0) {
                            debts[participant] =
                                (debts[participant] || 0) + remainingAmount;
                        }
                    }
                }
            } else {
                // Someone else paid - you owe them (minus what you've paid)
                const remainingAmount = expense.getRemainingAmount(userId);
                if (remainingAmount > 0) {
                    debts[payer] = (debts[payer] || 0) - remainingAmount;
                }
            }
        }

        const youOwe = [];
        const youAreOwed = [];
        let netBalance = 0;

        for (const [otherUserId, amount] of Object.entries(debts)) {
            if (amount > 0.01) {
                // Only count if more than 1 cent
                youAreOwed.push({ userId: otherUserId, amount });
                netBalance += amount;
            } else if (amount < -0.01) {
                // Only count if more than 1 cent
                youOwe.push({ userId: otherUserId, amount: Math.abs(amount) });
                netBalance += amount; // amount is already negative
            }
        }

        // Fix floating point precision issues (avoid -0)
        if (Math.abs(netBalance) < 0.01) {
            netBalance = 0;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Balance for ${user.username}`)
            .setColor(netBalance >= 0 ? "#00ff00" : "#ff0000")
            .setDescription(`Net Balance: $${netBalance.toFixed(2)}`);

        //Add "You Owe" section if  you have debt
        if (youOwe.length > 0) {
            const oweText = youOwe
                .map((d) => `• <@${d.userId}>: $${d.amount.toFixed(2)}`)
                .join("\n");
            embed.addFields({ name: "Debts", value: oweText, inline: false });
        }

        //Add "You Are Owed" section if you are owed money
        if (youAreOwed.length > 0) {
            const owedText = youAreOwed
                .map((d) => `• <@${d.userId}>: $${d.amount.toFixed(2)}`)
                .join("\n");
            embed.addFields({
                name: "Credits",
                value: owedText,
                inline: false,
            });
        }

        // if no debts or credits
        if (youOwe.length === 0 && youAreOwed.length === 0) {
            embed.setDescription(
                `You have no outstanding debts or credits. Your balance is $0.00`,
            );
        }

        await interaction.reply({ embeds: [embed] });
    },
};
