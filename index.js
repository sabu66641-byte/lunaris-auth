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

// CORS
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

// ENV
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

// Discord bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ======================
// health check
// ======================
app.get("/ping", (req, res) => {
    res.send("pong");
});

// ======================
// OAuth exchange
// ======================
app.post("/exchange", async (req, res) => {
    try {
        const code = req.body.code;

        if (!code) {
            return res.status(400).json({
                ok: false,
                error: "NO_CODE"
            });
        }

        console.log("CODE RECEIVED");

        // ======================
        // TOKEN交換
        // ======================
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

        console.log("TOKEN STATUS:", tokenRes.status);
        console.log("TOKEN RAW:", tokenText);

        let token;
        try {
            token = JSON.parse(tokenText);
        } catch {
            return res.status(500).json({
                ok: false,
                error: "TOKEN_PARSE_ERROR",
                raw: tokenText
            });
        }

        if (!token.access_token) {
            return res.status(400).json({
                ok: false,
                error: "TOKEN_NO_ACCESS",
                detail: token
            });
        }

        // ======================
        // USER取得
        // ======================
        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${token.access_token}`
            }
        });

        const user = await userRes.json();

        console.log("USER RESPONSE:", user);

        if (!user || !user.id) {
            return res.status(400).json({
                ok: false,
                error: "USER_FETCH_FAILED",
                detail: user
            });
        }

        console.log("USER ID:", user.id);

        // ======================
        // GUILD取得
        // ======================
        let guild;
        try {
            guild = await client.guilds.fetch(GUILD_ID);
        } catch (err) {
            console.error("GUILD FETCH ERROR:", err);
            return res.status(500).json({
                ok: false,
                error: "GUILD_FETCH_FAILED"
            });
        }

        // ======================
        // MEMBER取得
        // ======================
        let member;
        try {
            member = await guild.members.fetch(user.id);
        } catch (err) {
            console.error("MEMBER FETCH ERROR:", err);

            return res.status(500).json({
                ok: false,
                error: "MEMBER_FETCH_FAILED",
                detail: err.message
            });
        }

        // ======================
        // ROLE付与
        // ======================
        if (!member.roles.cache.has(ROLE_ID)) {
            await member.roles.add(ROLE_ID);
        }

        console.log("ROLE ADDED:", user.id);

        return res.json({
            ok: true
        });

    } catch (err) {
        console.error("EXCHANGE FATAL ERROR:", err);

        return res.status(500).json({
            ok: false,
            error: "FATAL_ERROR",
            detail: err.message
        });
    }
});

// ======================
// bot起動時
// ======================
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} READY`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);

        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("Lunaris Verification")
                    .setDescription("下のボタンから認証してください。")
                    .setColor(0x1E40AF)
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel("認証開始")
                        .setStyle(ButtonStyle.Link)
                        .setURL(SITE_URL)
                )
            ]
        });

        console.log("VERIFY MESSAGE SENT");

    } catch (err) {
        console.error("READY ERROR:", err);
    }
});

// ======================
// login
// ======================
client.login(TOKEN)
    .then(() => console.log("LOGIN SUCCESS"))
    .catch(err => console.error("LOGIN FAILED:", err));

// ======================
// server start
// ======================
app.listen(PORT, () => {
    console.log("API RUNNING ON PORT", PORT);
});
