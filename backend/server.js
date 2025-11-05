const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Environment variables:
// BOT_TOKEN - from @BotFather
// ADMIN_CHAT_ID - your Telegram ID or group ID
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error("❌ Please set BOT_TOKEN and ADMIN_CHAT_ID environment variables.");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const app = express();
app.use(bodyParser.json({ limit: '15mb' }));

app.post('/submit', async (req, res) => {
  try {
    const { name, email, phone, geo, selfie } = req.body;

    if (!name || !email || !phone || !selfie) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Extract selfie from Base64
    const match = selfie.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Invalid selfie format" });

    const imageBuffer = Buffer.from(match[2], 'base64');
    const tempPath = path.join(__dirname, `selfie_${Date.now()}.jpg`);
    fs.writeFileSync(tempPath, imageBuffer);

    // Create readable location
    const locationText = geo ? `https://www.google.com/maps?q=${geo.lat},${geo.lon}` : "Not Available";

    // Send to YOUR Telegram
    await bot.sendPhoto(ADMIN_CHAT_ID, tempPath, {
      caption:
        `📋 *New Event Entry*\n\n` +
        `👤 *Name:* ${name}\n` +
        `📧 *Email:* ${email}\n` +
        `📞 *Phone:* ${phone}\n` +
        `📍 *Location:* ${locationText}\n` +
        `🕒 *Time:* ${new Date().toLocaleString()}`,
      parse_mode: "Markdown"
    });

    fs.unlinkSync(tempPath);

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`➡️  Submissions will be sent to Telegram chat ID: ${ADMIN_CHAT_ID}`);
});
