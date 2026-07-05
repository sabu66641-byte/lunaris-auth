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

// ====== ① ロール付与API（サイトが最後に叩く） ======
app.post("/complete", async (req, res) => {
    try {
        const userId = req.body?.userId;
        if (!userId) return res.status(400).json({ error: "Missing userId" });

        // 指定のサーバーを取得
        const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
        if (!guild) return res.status(500).json({ error: "Guild not found" });

        // メンバーを取得
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return res.status(404).json({ error: "Member not found in guild" });

        // ロールを取得
        const role = await guild.roles.fetch(ROLE_ID).catch(() => null);
        if (!role) return res.status(500).json({ error: "Role not found" });

        // すでに持っていればそのまま成功を返す（エラーで落とさない）
        if (member.roles.cache.has(role.id)) {
            return res.json({ ok: true, message: "Already verified" });
        }

        // ロール付与
        await member.roles.add(role.id);
        console.log(`[SUCCESS] Role added to user: ${userId}`);

        return res.json({ ok: true });
    } catch (err) {
        console.error("COMPLETE API ERROR:", err);
        return res.status(500).json({ error: "Internal server error" });
    }
});

// ====== ② トークン交換API（Discord認証の直後にサイトが叩く） ======
app.post("/exchange", async (req, res) => {
    try {
        const code = req.body.code;
        if (!code) return res.status(400).json({ error: "no code" });

        // Discordにcodeを送ってトークンを貰う
        const tokenRes = await fetch("https://discord.com", {
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

        if (!tokenRes.ok) {
            const errData = await tokenRes.json().catch(() => ({}));
            return res.status(tokenRes.status).json({ error: "Token exchange failed", details: errData });
        }

        const tokenData = await tokenRes.json();

        // トークンを使ってユーザーの情報を取得
        const userRes = await fetch("https://discord.com", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        if (!userRes.ok) return res.status(userRes.status).json({ error: "Failed to fetch user" });

        const user = await userRes.json();

        // サイト側にユーザーIDを返す（サイトがこれを受け取って /complete を叩く）
        return res.json({
            userId: user.id
        });

    } catch (err) {
        console.error("EXCHANGE API ERROR:", err);
        return res.status(500).json({ error: "failed" });
    }
});

// ====== ③ 起動・チャンネルへの埋め込みメッセージ送信 ======
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} READY`);

    try {
        const channel = await client.channels.fetch(process.env.CHANNEL_ID).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            console.error("Channel not found or is not text-based");
            return;
        }

        // チャンネル内の過去50件を取得して重複がないかチェック
        const messages = await channel.messages.fetch({ limit: 50 }).catch(() => []);
        const existingMsg = messages.find(m => m.author.id === client.user.id && m.embeds?.[0]?.data?.title === "Lunaris Verification Gateway");

        // 既にメッセージがあれば新しく送らない
        if (!existingMsg) {
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

            await channel.send({ embeds: [embed], components: [row] });
            console.log("VERIFY MESSAGE SENT");
        } else {
            console.log("VERIFY MESSAGE ALREADY EXISTS (SKIPPED)");
        }
    } catch (err) {
        console.error("READY EVENT ERROR:", err);
    }
});

client.login(TOKEN);

// ====== Expressサーバー起動 ======
app.listen(PORT, () => {
    console.log("API RUNNING ON PORT", PORT);
});
