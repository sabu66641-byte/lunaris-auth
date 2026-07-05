console.log("FILE LOADED");

require("dotenv").config();
const fetch = require("node-fetch");
const express = require("express");
const { Client, GatewayIntentBits, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const app = express();
app.use(express.json());

// ===== CORS =====
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

// ===== ENV =====
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SITE_URL = process.env.SITE_URL;
const PORT = process.env.PORT || 3000;

// ===== DISCORD CLIENT =====
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== OAuth + ROLE =====
app.post("/exchange", async (req, res) => {
    try {
        const code = req.body?.code;
        if (!code) return res.status(400).json({ error: "no_code" });

        // 1. token取得
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.REDIRECT_URI,
                scope: "identify guilds.join"
            })
        });

        const tokenData = await tokenRes.json();
        if (!tokenData.access_token) {
            console.log("TOKEN ERROR:", tokenData);
            return res.status(400).json({ error: "token_failed" });
        }

        // 2. user取得
        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const user = await userRes.json();
        if (!user.id) {
            return res.status(400).json({ error: "user_failed" });
        }

        console.log("USER:", user.id);

        // 3. guild
        const guild = await client.guilds.fetch(GUILD_ID);

        // 4. member取得（強制）
        const member = await guild.members.fetch(user.id);

        // 5. role取得
        const role = await guild.roles.fetch(ROLE_ID);

        // 6. すでに持ってる場合スキップ
        if (member.roles.cache.has(role.id)) {
            return res.json({ ok: true, already: true });
        }

        // 7. 付与
        await member.roles.add(role.id);

        console.log("ROLE ADDED SUCCESS:", user.id);

        return res.json({ ok: true });

    } catch (err) {
        console.log("EXCHANGE ERROR:", err);
        return res.status(500).json({ ok: false, error: err.message });
    }
});

// ===== BOT起動時メッセージ =====
let sent = false;

client.once(Events.ClientReady, async () => {
    if (sent) return;
    sent = true;

    console.log(`${client.user.tag} READY`);

    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = new EmbedBuilder()
        .setTitle("Lunaris Verification Gateway")
        .setDescription("認証ボタンを押してください")
        .setColor(0x1E40AF);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel("認証開始")
            .setStyle(ButtonStyle.Link)
            .setURL(SITE_URL)
    );

    await channel.send({ embeds: [embed], components: [row] });

    console.log("VERIFY MESSAGE SENT");
});

client.login(TOKEN);

app.listen(PORT, () => {
    console.log("API RUNNING ON", PORT);
});
