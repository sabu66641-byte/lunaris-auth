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

// 🔥 追加：観測用カウンタ
let exchangeCount = 0;

const usedCodes = new Set();
const processingCodes = new Set();

app.post("/exchange", async (req, res) => {
    exchangeCount++;

    // 🔥 追加：基本観測ログ
    console.log("==== EXCHANGE HIT ====");
    console.log("COUNT:", exchangeCount);
    console.log("IP:", req.ip);

    try {
        const code = req.body.code;

        if (!code) {
            return res.status(400).json({ ok: false, error: "NO_CODE" });
        }

        if (usedCodes.has(code)) {
            return res.status(400).json({
                ok: false,
                error: "CODE_ALREADY_USED"
            });
        }

        if (processingCodes.has(code)) {
            return res.status(429).json({
                ok: false,
                error: "CODE_PROCESSING"
            });
        }

        processingCodes.add(code);

        console.log("CODE RECEIVED:", code);

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

        if (!tokenRes.ok) {
            processingCodes.delete(code);

            return res.status(400).json({
                ok: false,
                error: "TOKEN_REQUEST_FAILED",
                status: tokenRes.status,
                raw: tokenText
            });
        }

        let token;
        try {
            token = JSON.parse(tokenText);
        } catch {
            processingCodes.delete(code);
            return res.status(500).json({ ok: false, error: "TOKEN_PARSE_ERROR" });
        }

        if (!token.access_token) {
            processingCodes.delete(code);
            return res.status(400).json({
                ok: false,
                error: "NO_ACCESS_TOKEN"
            });
        }

        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${token.access_token}`
            }
        });

        const user = await userRes.json();

        if (!user.id) {
            processingCodes.delete(code);
            return res.status(400).json({
                ok: false,
                error: "USER_FETCH_FAILED"
            });
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(user.id);

        if (!member.roles.cache.has(ROLE_ID)) {
            await member.roles.add(ROLE_ID);
        }

        usedCodes.add(code);
        processingCodes.delete(code);

        return res.json({ ok: true });

    } catch (err) {
        console.error("EXCHANGE ERROR:", err);

        return res.status(500).json({
            ok: false,
            error: "FATAL_ERROR"
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
