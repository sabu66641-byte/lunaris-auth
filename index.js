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

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
});

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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

app.get("/ping", (req, res) => {
    res.send("pong");
});

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

        const raw = await tokenRes.text();

        console.log("TOKEN STATUS:", tokenRes.status);
        console.log("TOKEN RAW:", raw);

        let token;

        try {
            token = JSON.parse(raw);
        } catch {
            return res.status(500).json({
                ok: false,
                error: "TOKEN_NOT_JSON",
                body: raw
            });
        }

        if (!token.access_token) {
            return res.status(400).json({
                ok: false,
                error: token
            });
        }

        const user = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${token.access_token}`
            }
        }).then(r => r.json());

        console.log("USER:", user.id);

        const guild = await client.guilds.fetch(GUILD_ID);

        const member = await guild.members.fetch(user.id);

        if (!member.roles.cache.has(ROLE_ID)) {
            await member.roles.add(ROLE_ID);
        }

        console.log("ROLE ADDED:", user.id);

        return res.json({
            ok: true
        });

    } catch (err) {

        console.error(err);

        return res.status(500).json({
            ok: false,
            error: err.message
        });
    }
});

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

client.login(TOKEN)
    .then(() => console.log("LOGIN SUCCESS"))
    .catch(err => console.error("LOGIN FAILED:", err));

app.listen(PORT, () => {
    console.log("API RUNNING ON PORT", PORT);
});
