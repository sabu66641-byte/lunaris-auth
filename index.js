console.log("FILE LOADED");

require("dotenv").config();

const fetch = require("node-fetch");

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
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});
app.use(express.json());

// ====== ENV ======
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const ROLE_ID = process.env.ROLE_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const SITE_URL = process.env.SITE_URL;
const PORT = process.env.PORT || 3000;

// ====== DISCORD CLIENT ======
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// ====== /complete（ロール付与） ======
app.post("/complete", async (req, res) => {
    try {
        const userId = req.body?.userId;

        console.log("COMPLETE HIT:", userId);

        if (!userId) {
            return res.status(400).json({ error: "no_userId" });
        }

        const guild = await client.guilds.fetch(GUILD_ID);

        const member = await guild.members.fetch(userId).catch(err => {
            console.log("MEMBER FETCH ERROR:", err);
            return null;
        });

        if (!member) {
            console.log("MEMBER NOT FOUND");
            return res.status(404).json({ error: "member_not_found" });
        }

        const role = await guild.roles.fetch(ROLE_ID).catch(err => {
            console.log("ROLE FETCH ERROR:", err);
            return null;
        });

        if (!role) {
            console.log("ROLE NOT FOUND");
            return res.status(404).json({ error: "role_not_found" });
        }

        try {
            await member.roles.add(role.id);
            console.log("ROLE ADDED SUCCESS");
        } catch (err) {
            console.log("ROLE ADD FAILED:", err);
            return res.status(500).json({
                error: "role_add_failed",
                message: err.message
            });
        }

        return res.json({ ok: true });

    } catch (err) {
        console.log("COMPLETE ERROR:", err);
        return res.status(500).json({ error: "server_error" });
    }
});

app.post("/exchange", async (req, res) => {
    try {
        const code = req.body?.code;

        if (!code) {
            return res.status(400).json({ error: "no_code" });
        }

        // ① code → access_token 交換
        const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code: code,
                redirect_uri: process.env.REDIRECT_URI,
                scope: "identify guilds.join"
            })
        });

        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
            console.log("TOKEN ERROR:", tokenData);
            return res.status(400).json({ error: "token_failed", details: tokenData });
        }

        // ② ユーザー情報取得
        const userRes = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        const user = await userRes.json();
        const userId = user.id;

        console.log("USER:", userId);

        // ③ ギルド取得
        const guild = await client.guilds.fetch(process.env.GUILD_ID);

        // ④ メンバー取得
        const member = await guild.members.fetch(userId);

        // ⑤ ロール付与
        await member.roles.add(process.env.ROLE_ID);

        console.log("ROLE ADDED:", userId);

        return res.json({ ok: true });

    } catch (err) {
        console.log("EXCHANGE ERROR:", err);
        return res.status(500).json({ error: "server_error", message: err.message });
    }
});

app.get("/ping", (req, res) => {
    console.log("PING OK");
    res.send("pong");
});

// ====== BOT起動 ======
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} READY`);

    const channel = await client.channels.fetch(CHANNEL_ID);

    const embed = new EmbedBuilder()
        .setTitle("Lunaris Verification Gateway")
        .setDescription("以下のボタンから認証を開始してください")
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
});

// ====== START ======
client.login(TOKEN);

app.listen(PORT, () => {
    console.log("API RUNNING ON", PORT);
});
