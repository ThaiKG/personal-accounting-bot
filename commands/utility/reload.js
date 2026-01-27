const { SlashCommandBuilder } = require("discord.js");
const { cooldown } = require("./ping");

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName("reload")
        .setDescription("Reloads a command.")
        .addStringOption((option) =>
            option
                .setName("command")
                .setDescription("The command to reload")
                .setRequired(true),
        ),
    async execute(interaction) {
        const commandName = interaction.options
            .getString("command", true)
            .toLowerCase();
        const command = interaction.client.commands.get(commandName);

        if (!command) {
            return interaction.reply({
                content: `There is no command with name \`${commandName}\`!`,
                ephemeral: true,
            });
        }

        delete require.cache[require.resolve(`./${commandName}.js`)];
        try {
            const newCommand = require(`./${commandName}.js`);
            interaction.client.commands.set(commandName, newCommand);
            await interaction.reply(`Command \`${commandName}\` was reloaded!`);
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: `There was an error while reloading the command \`${commandName}\`:\n\`${error.message}\``,
                ephemeral: true,
            });
        }
    },
};
