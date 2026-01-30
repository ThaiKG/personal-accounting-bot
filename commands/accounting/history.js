const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const Expense = require("../../schemas/Expense");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("history")
        .setDescription("View expense history.")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("Filter by user who paid (default: all users)")
                .setRequired(false),
        )
        .addBooleanOption((option) =>
            option
                .setName("settled")
                .setDescription("Show only settled expenses")
                .setRequired(false),
        )
        .addIntegerOption((option) =>
            option
                .setName("limit")
                .setDescription("Limit the number of expenses shown")
                .setMinValue(1)
                .setMaxValue(50)
                .setRequired(false),
        ),
    async execute(interaction) {
        const filterUser = interaction.options.getUser("user");
        const showSettled = interaction.options.getBoolean("settled");
        const limit = interaction.options.getInteger("limit") || 10;

        // Build query object
        const query = {};

        if (filterUser) {
            query.paidBy = filterUser.id;
        }

        //Query expenses
        const expenses = await Expense.find(query)
            .sort({ date: -1 })
            .limit(limit);

        //Filter by settlement status if specified
        let filteredExpenses = expenses;
        if (showSettled !== null) {
            filteredExpenses = expenses.filter((exp) => {
                if (showSettled) {
                    return exp.isFullySettled;
                } else {
                    return !exp.isFullySettled;
                }
            });
        }

        if (filteredExpenses.length === 0) {
            return interaction.reply({
                content: "No expenses found matching your filters.",
                ephemeral: true,
            });
        }

        const embeds = [];

        for (const expense of filteredExpenses) {
            const embed = new EmbedBuilder()
                .setColor(expense.isFullySettled ? "#00ff00" : "#ffaa00")
                .setTitle(
                    `$${expense.amount.toFixed(2)} - ${expense.description || "No description"}`,
                )
                .addFields(
                    {
                        name: "Paid By",
                        value: `<@${expense.paidBy}>`,
                        inline: true,
                    },
                    {
                        name: "Participants",
                        value: expense.participants
                            .map((pid) => `<@${pid}>`)
                            .join(", "),
                        inline: true,
                    },
                    {
                        name: "Date",
                        value: expense.date.toDateString(),
                        inline: true,
                    },
                );

            if (expense.settlements.length > 0) {
                const settlementText = expense.settlements
                    .map(
                        (s) =>
                            `• <@${s.userId}>: $${s.amountPaid.toFixed(2)} (${s.datePaid.toLocaleDateString()})`,
                    )
                    .join("\n");

                embed.addFields({
                    name: "Settlements",
                    value: settlementText,
                    inline: false,
                });
            }

            const status = expense.isFullySettled ? "Fully Settled" : "Pending";
            embed.setFooter({ text: `Status: ${status}` });

            embeds.push(embed);
        }

        // Send the embeds
        if (embeds.length <= 10) {
            await interaction.reply({ embeds });
        } else {
            // Discord limit: max 10 embeds per message
            await interaction.reply({
                embeds: embeds.slice(0, 10),
                content: `Showing 10 of ${embeds.length} expenses. Use filters to narrow results.`,
            });
        }
    },
};
