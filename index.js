console.log("FILE LOADED");

require("dotenv").config();

const express = require("express");
const {
    Client,
    GatewayIntentBits,
    Events,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const app = express();
app.use(express.json());

// ====== ENV ======
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const PORT = process.env.PORT || 3000;

// ====== DISCORD CLIENT ======
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ====== ロール付与API（サイトから呼ぶ） ======
app.post("/complete", async (req, res) => {
    try {
        const userId = req.body?.userId;
        if (!userId) return res.status(400).end();

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return res.status(404).end();

        const role = await guild.roles.fetch(ROLE_ID).catch(() => null);
        if (!role) return res.status(500).end();

        await member.roles.add(role.id);

        return res.json({ ok: true });
    } catch (err) {
        console.log("ERROR:", err);
        return res.status(500).end();
    }
});

// ====== 起動 ======
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} READY`);

    const channel = await client.channels.fetch(process.env.CHANNEL_ID);

    const embed = new EmbedBuilder()
        .setTitle("Lunaris Verification Gateway")
        .setDescription("以下のボタンから認証を開始してください")
        .setColor(0x1E40AF);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("認証開始")
            .setStyle(ButtonStyle.Link)
            .setURL(process.env.SITE_URL)
    );

    await channel.send({
        embeds: [embed],
        components: [row]
    });

    console.log("VERIFY MESSAGE SENT");
});

client.login(TOKEN);

// ====== EXPRESS START ======

app.post("/exchange", async (req, res) => {
    try {
        const code = req.body.code;

        if (!code) return res.status(400).json({ error: "no code" });

        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.REDIRECT_URI
            })
        });

        const tokenData = await tokenRes.json();

        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const user = await userRes.json();

        return res.json({
            userId: user.id
        });

    } catch (err) {
        console.log("EXCHANGE ERROR:", err);
        return res.status(500).json({ error: "failed" });
    }
});

app.listen(PORT, () => {
    console.log("API RUNNING ON", PORT);
});
