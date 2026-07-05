console.log("FILE LOADED");

require("dotenv").config();

const express = require("express");
const fetch = require("node-fetch");
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

// CORS（サイトからの通信許可）
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

// ===== ENV =====
const {
    TOKEN,
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI,
    GUILD_ID,
    ROLE_ID,
    CHANNEL_ID,
    SITE_URL,
    PORT = 3000
} = process.env;

// ===== DISCORD CLIENT =====
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// =========================
// OAuth + ROLE付与
// =========================
app.post("/exchange", async (req, res) => {
    try {
        const code = req.body?.code;
        if (!code) return res.status(400).json({ error: "no_code" });

        // ===== 1. code -> token =====
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI
            })
        });

        const tokenText = await tokenRes.text();

        let tokenData;
        try {
            tokenData = JSON.parse(tokenText);
        } catch {
            return res.status(500).json({
                error: "invalid_token_response",
                raw: tokenText
            });
        }

        if (!tokenData.access_token) {
            return res.status(400).json({
                error: "token_failed",
                details: tokenData
            });
        }

        // ===== 2. user取得 =====
        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const user = await userRes.json();
        const userId = user?.id;

        if (!userId) {
            return res.status(400).json({ error: "user_fetch_failed" });
        }

        console.log("USER:", userId);

        // ===== 3. guild取得 =====
        const guild = await client.guilds.fetch(GUILD_ID);

        // ===== 4. member取得 =====
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            return res.status(404).json({ error: "member_not_found" });
        }

        // ===== 5. role取得 =====
        const role = await guild.roles.fetch(ROLE_ID);
        if (!role) {
            return res.status(404).json({ error: "role_not_found" });
        }

        // ===== 6. role付与 =====
        if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role.id);
        }

        console.log("ROLE ADDED:", userId);

        return res.json({ ok: true });

    } catch (err) {
        console.log("EXCHANGE ERROR:", err);
        return res.status(500).json({
            error: "server_error",
            message: err.message
        });
    }
});

// =========================
// ping
// =========================
app.get("/ping", (req, res) => {
    res.send("pong");
});

// =========================
// BOT起動
// =========================
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} READY`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        const embed = new EmbedBuilder()
            .setTitle("Lunaris Verification")
            .setDescription("下のボタンから認証してください")
            .setColor(0x1E40AF);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel("認証開始")
                .setStyle(ButtonStyle.Link)
                .setURL(SITE_URL)
        );

        await channel.send({
            embeds: [embed],
            components: [row]
        });

        console.log("VERIFY MESSAGE SENT");

    } catch (err) {
        console.log("READY ERROR:", err);
    }
});

// =========================
// START
// =========================
client.login(TOKEN);

app.listen(PORT, () => {
    console.log("API RUNNING ON", PORT);
});
