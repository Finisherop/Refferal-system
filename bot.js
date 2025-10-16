import express from "express";
import TelegramBot from "node-telegram-bot-api";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, set, update } from "firebase/database";

const app = express();
app.use(express.json());

// ==============================
// 🔥 1. Firebase Configuration
// ==============================
const firebaseConfig = {
  apiKey: "AIzaSyC_SO0ZnItNVoWif48MyMeznuLsA-jq52k",
  authDomain: "tgfjf-9f690.firebaseapp.com",
  databaseURL: "https://tgfjf-5bbfe-default-rtdb.firebaseio.com",
  projectId: "tgfjf-9f690",
  storageBucket: "tgfjf-9f690.appspot.com",
  messagingSenderId: "431271375984",
  appId: "1:431271375984:web:c206d5a8a3fd7e3286d07a",
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// ==============================
// 🤖 2. Telegram Bot Setup
// ==============================
const TOKEN = "8360936389:AAEuHJF7vZp_GK1IrOvMvVKQS_DMlDi4VyI"; // ⚠️ replace this
const WEB_APP_URL = "https://finisherop.github.io/Bot-tg/"; // ⚠️ your frontend URL

const bot = new TelegramBot(TOKEN, { polling: true });

// ==============================
// 🚀 3. /start Command
// ==============================
bot.onText(/\/start(?:\s+(\d+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const referrerId = match[1]; // If started with referral link
  const userId = msg.from.id.toString();
  const username = msg.from.username || msg.from.first_name || "User";

  const userRef = ref(db, `telegram_users/${userId}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    await set(userRef, {
      username,
      coins: 0,
      referrals: 0,
      referralStatus: referrerId ? "pending" : "none",
      referredBy: referrerId || "none",
      createdAt: Date.now(),
    });

    if (referrerId) {
      await bot.sendMessage(
        chatId,
        `🎉 Welcome, ${username}!\nYou joined via referral.\nPlease open the app below 👇`
      );
    } else {
      await bot.sendMessage(chatId, `👋 Welcome, ${username}!`);
    }
  }

  const webAppUrl = `${WEB_APP_URL}?userId=${userId}`;
  await bot.sendMessage(chatId, "👇 Open your dashboard:", {
    reply_markup: {
      inline_keyboard: [[{ text: "Open Dashboard", web_app: { url: webAppUrl } }]],
    },
  });
});

// ==============================
// ⚙️ 4. Confirm Referral API
// ==============================
app.post("/confirm-referral", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const userRef = ref(db, `telegram_users/${userId}`);
  const userSnap = await get(userRef);

  if (!userSnap.exists()) return res.status(404).json({ error: "User not found" });

  const userData = userSnap.val();
  if (userData.referralStatus === "confirmed" || userData.referredBy === "none")
    return res.json({ message: "Referral already confirmed or none" });

  const referrerRef = ref(db, `telegram_users/${userData.referredBy}`);
  const referrerSnap = await get(referrerRef);

  if (!referrerSnap.exists())
    return res.status(404).json({ error: "Referrer not found" });

  const referrerData = referrerSnap.val();

  await update(referrerRef, {
    coins: (referrerData.coins || 0) + 500,
    referrals: (referrerData.referrals || 0) + 1,
  });
  await update(userRef, { referralStatus: "confirmed" });

  res.json({ message: "Referral confirmed successfully" });
});

// ==============================
// 🚦 5. Server Start
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));