const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const PORT = process.env.PORT || 3000;

if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
  console.error("❌ BOT_TOKEN or ADMIN_CHAT_ID not set.");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const app = express();

// ✅ Allow frontend to call backend (CORS fix)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

app.use(bodyParser.json({ limit: '15mb' }));

app.post('/submit', async (req, res) => {
  try {
    const { name, email, phone, geo, selfie } = req.body;
    if (!name || !email || !phone || !selfie)
      return res.status(400).json({ error: "Missing required fields" });

    const match = selfie.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return res.status(400).json({ error: "Invalid selfie format" });
    
    const imageBuffer = Buffer.from(match[2], 'base64');
    const filePath = path.join(__dirname, `selfie_${Date.now()}.jpg`);
    fs.writeFileSync(filePath, imageBuffer);

    const locationText = geo ? `https://www.google.com/maps?q=${geo.lat},${geo.lon}` : "Not Available";

    await bot.sendPhoto(ADMIN_CHAT_ID, filePath, {
      caption:
        `📋 *New Event Entry*\n\n` +
        `👤 *Name:* ${name}\n` +
        `📧 *Email:* ${email}\n` +
        `📞 *Phone:* ${phone}\n` +
        `📍 *Location:* ${locationText}\n` +
        `🕒 *Time:* ${new Date().toLocaleString()}`,
      parse_mode: "Markdown"
    });

    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("✅ Backend is running. Use POST /submit to send data.");
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`➡️ Sending submissions to Telegram ID: ${ADMIN_CHAT_ID}`);
});
