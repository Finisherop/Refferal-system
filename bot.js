import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update } from "firebase/database";

// =========================
// 1️⃣ Firebase Config
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyC_SO0ZnItNVoWif48MyMeznuLsA-jq52k",
  authDomain: "tgfjf-5bbfe.firebaseapp.com",
  databaseURL: "https://tgfjf-5bbfe-default-rtdb.firebaseio.com/",
  projectId: "tgfjf-5bbfe",
  storageBucket: "tgfjf-5bbfe.firebasestorage.app",
  messagingSenderId: "898327972915",
  appId: "1:898327972915:web:8450b0cfdf69134474e746",
};

const appFB = initializeApp(firebaseConfig);
const db = getDatabase(appFB);

// =========================
// 2️⃣ Telegram Bot Setup
// =========================
const BOT_TOKEN = "8366558036:AAEp2ojpSnODauWLC5I5AR9pVvDd-A3ROCw";
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// =========================
// 3️⃣ Express Setup
// =========================
const app = express();
app.use(express.json());
app.get("/", (_, res) => res.send("🤖 Telegram Referral Bot is running..."));

// =========================
// 4️⃣ /start Command — Referral Handler
// =========================
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || "User";

  // Extract referral ID if available
  const query = match[1]?.trim();
  let referrerId = null;
  if (query) {
    const clean = query.replace(/[\s?=]+/g, "").replace("ref", "");
    if (clean) referrerId = clean;
  }

  const userRef = ref(db, `telegram_users/${chatId}`);
  const snap = await get(userRef);

  if (snap.exists()) {
    // Existing user
    await bot.sendMessage(chatId, `👋 Welcome back, ${username}!`);
  } else {
    // New user
    await set(userRef, {
      username,
      coins: 0,
      referrals: 0,
      referredBy: referrerId || null,
      createdAt: Date.now(),
    });

    if (referrerId) {
      // Increase referrer's referral count and coins
      const refRef = ref(db, `telegram_users/${referrerId}`);
      const refSnap = await get(refRef);

      if (refSnap.exists()) {
        const refData = refSnap.val();
        const newCount = (refData.referrals || 0) + 1;
        const newCoins = (refData.coins || 0) + 500;

        await update(refRef, {
          referrals: newCount,
          coins: newCoins,
        });

        await bot.sendMessage(
          referrerId,
          `🎉 New referral joined using your link!\n+1 referral, +500 coins 💰`
        );
      }
    }

    await bot.sendMessage(
      chatId,
      `👋 Welcome ${username}!\n\nInvite friends and earn rewards 🎁\nHere’s your referral link 👇`
    );
  }

  await bot.sendMessage(
    chatId,
    `🔗 Your referral link:\nhttps://t.me/Bdhshssbshsjj_bot?start=ref${chatId}`
  );
});

// =========================
// 5️⃣ Start Server
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
console.log("🤖 Referral bot active and polling...");