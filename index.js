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

// ====== 共通のロール付与関数 ======
async function assignRole(userId) {
    const guild = await client.guilds.fetch(GUILD_ID).catch(() => null);
    if (!guild) return { success: false, error: "Guild not found" };

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return { success: false, error: "Member not found" };

    const role = await guild.roles.fetch(ROLE_ID).catch(() => null);
    if (!role) return { success: false, error: "Role not found" };

    if (!member.roles.cache.has(role.id)) {
        await member.roles.add(role.id);
    }
    console.log(`[SUCCESS] Role assigned to: ${userId}`);
    return { success: true };
}

// ====== ① ロール付与API ======
// もしサイトが code ではなく直接 userId を送ってきた場合もここで処理します
app.post("/complete", async (req, res) => {
    try {
        const userId = req.body?.userId;
        const code = req.body?.code;

        // もし userId ではなく code が直接送られてきた場合は、まずIDに引き換える
        if (!userId && code) {
            const userIdFromCode = await exchangeCodeToId(code);
            if (!userIdFromCode) return res.status(400).json({ error: "Invalid code" });
            const result = await assignRole(userIdFromCode);
            if (!result.success) return res.status(500).json({ error: result.error });
            return res.json({ ok: true, userId: userIdFromCode });
        }

        if (!userId) return res.status(400).json({ error: "Missing identity data" });

        const result = await assignRole(userId);
        if (!result.success) return res.status(500).json({ error: result.error });

        return res.json({ ok: true });
    } catch (err) {
        console.error("COMPLETE ERROR:", err);
        return res.status(500).json({ error: "failed" });
    }
});

// ====== ② トークン交換API ======
// サイトが最初に code を送ってきた際、IDを返すと同時に、その場でロールも付与してしまいます
app.post("/exchange", async (req, res) => {
    try {
        const code = req.body.code;
        if (!code) return res.status(400).json({ error: "no code" });

        const userId = await exchangeCodeToId(code);
        if (!userId) return res.status(500).json({ error: "Token exchange failed" });

        // 【超重要】サイト側が次に進む前に、ボット側で先回リしてロールを付与してしまう
        await assignRole(userId);

        return res.json({
            userId: userId
        });

    } catch (err) {
        console.error("EXCHANGE ERROR:", err);
        return res.status(500).json({ error: "failed" });
    }
});

// DiscordのcodeをユーザーIDに変換する共通ヘルパー
async function exchangeCodeToId(code) {
    try {
        const tokenRes = await fetch("https://discord.com", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: "authorization_code",
                code,
                redirect_uri: process.env.REDIRECT_URI
            })
        });

        if (!tokenRes.ok) return null;
        const tokenData = await tokenRes.json();

        const userRes = await fetch("https://discord.com", {
            headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });

        if (!userRes.ok) return null;
        const user = await userRes.json();
        return user.id;
    } catch {
        return null;
    }
}

// ====== ③ 起動メッセージ ======
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} READY`);
    try {
        const channel = await client.channels.fetch(process.env.CHANNEL_ID);
        const messages = await channel.messages.fetch({ limit: 50 });
        const existingMsg = messages.find(m => m.author.id === client.user.id && m.embeds?.title === "Lunaris Verification Gateway");

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
        }
    } catch (err) {
        console.error("READY ERROR:", err);
    }
});

client.login(TOKEN);

app.listen(PORT, () => {
    console.log("API RUNNING ON", PORT);
});
