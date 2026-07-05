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

// ===== BOT =====
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// =====================
// OAuth → ロール付与
// =====================
app.post("/exchange", async (req, res) => {
    try {
        const code = req.body?.code;
        if (!code) return res.status(400).json({ ok: false });

        // token取得
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

        const token = await tokenRes.json();
        if (!token.access_token) return res.status(400).json({ ok: false });

        // user取得
        const user = await fetch("https://discord.com/api/users/@me", {
            headers: {
                Authorization: `Bearer ${token.access_token}`
            }
        }).then(r => r.json());

        const guild = await client.guilds.fetch(GUILD_ID);

        const member = await guild.members.fetch(user.id).catch(() => null);
        if (!member) return res.json({ ok: false });

        const role = await guild.roles.fetch(ROLE_ID);
        if (!role) return res.json({ ok: false });

        await member.roles.add(role.id).catch(() => {});

        return res.json({ ok: true });

    } catch {
        return res.status(500).json({ ok: false });
    }
});

// =====================
// Bot起動時メッセージ
// =====================
client.once(Events.ClientReady, async () => {
    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) return;

        await channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle("認証")
                    .setDescription("下のボタンから認証してください")
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
    } catch {}
});

// =====================
client.login(TOKEN);
app.listen(PORT);
