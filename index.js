console.log("FILE LOADED");

require("dotenv").config();

const express = require("express");
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events
} = require("discord.js");

const fetch = require("node-fetch");

// =====================
// 環境変数
// =====================
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const PORT = process.env.PORT || 3000;

// =====================
// Discord
// =====================
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// =====================
// ボタン処理
// =====================
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== "verify_start") return;

    console.log("BUTTON PRESSED");

    await interaction.reply({
        content: "認証中...",
        ephemeral: true
    });

    await fetch(`http://localhost:${PORT}/complete`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId: interaction.user.id
        })
    });
});

// =====================
// 起動時メッセージ
// =====================
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} READY`);

    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = new EmbedBuilder()
        .setTitle("Lunaris Verification Gateway")
        .setDescription("以下のボタンから認証を開始してください")
        .setColor(0x1E40AF);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("verify_start")
            .setLabel("認証開始")
            .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
        embeds: [embed],
        components: [row]
    });
});

// =====================
// ロール付与API
// =====================
const app = express();
app.use(express.json());

app.post("/complete", async (req, res) => {
    console.log("COMPLETE HIT");

    const userId = req.body?.userId;
    if (!userId) return res.status(400).end();

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId);
        const role = await guild.roles.fetch(ROLE_ID);

        await member.roles.add(role.id);

        console.log("ROLE ADDED");

        return res.json({ ok: true });

    } catch (err) {
        console.log("ERROR:", err);
        return res.status(500).end();
    }
});

// =====================
// 起動
// =====================
app.listen(PORT, () => {
    console.log("API RUNNING ON", PORT);
});

client.login(TOKEN);
