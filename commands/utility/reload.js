const { SlashCommandBuilder } = require("discord.js");
const fs = require("node:fs");
const path = require("node:path");

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

        // Find the command file in any subfolder
        const foldersPath = path.join(__dirname, "..");
        const commandFolders = fs.readdirSync(foldersPath);

        let commandPath = null;
        for (const folder of commandFolders) {
            const commandsPath = path.join(foldersPath, folder);
            const commandFiles = fs
                .readdirSync(commandsPath)
                .filter((file) => file.endsWith(".js"));

            for (const file of commandFiles) {
                if (file.toLowerCase() === `${commandName}.js`) {
                    commandPath = path.join(commandsPath, file);
                    break;
                }
            }
            if (commandPath) break;
        }

        if (!commandPath) {
            return interaction.reply({
                content: `Could not find command file for \`${commandName}\`!`,
                ephemeral: true,
            });
        }

        // Delete from cache and reload
        delete require.cache[require.resolve(commandPath)];

        try {
            const newCommand = require(commandPath);
            interaction.client.commands.set(commandName, newCommand);
            await interaction.reply(
                `Command \`${commandName}\` was reloaded successfully!`,
            );
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: `There was an error while reloading the command \`${commandName}\`:\n\`${error.message}\``,
                ephemeral: true,
            });
        }
    },
};
