import TelegramBot from "node-telegram-bot-api";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update } from "firebase/database";

// =========================
// 1️⃣ Firebase Config
// =========================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =========================
// 2️⃣ Telegram Bot Setup
// =========================
const bot = new TelegramBot("YOUR_TELEGRAM_BOT_TOKEN", { polling: true });

// =========================
// 🌐 Bot Constants
// =========================
const WEB_APP_URL = "https://telegram-earning-bot.vercel.app";
const COMMUNITY_LINK = "https://t.me/finisher_techg";
const BOT_USERNAME = "Reffeewlalbot";

// =========================
// 3️⃣ Helper: Write / Update Firebase
// =========================
async function writeUser(userId, data) {
  const userRef = ref(db, `telegram_users/${userId}`);
  await update(userRef, data);
}

// =========================
// 4️⃣ /start Command (Referral Logic)
// =========================
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || "Unknown";

  // Extract ?ref=xxxxx if exists
  const query = match[1]?.trim();
  let referrerId = null;
  if (query && query.startsWith("?ref=")) {
    referrerId = query.replace("?ref=", "");
  }

  const userRef = ref(db, `telegram_users/${chatId}`);
  const snap = await get(userRef);

  // =========================
  // 💬 Stylish Welcome Message
  // =========================
  const welcomeMessage = `
👋 *Welcome ${username}!*

🎯 Play, Earn & Refer your friends to win coins 💰  
Start your earning journey now 👇
`;

  const options = {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🎮 Play Now", web_app: { url: WEB_APP_URL } },
          { text: "👥 Join Community", url: COMMUNITY_LINK },
        ],
      ],
    },
  };

  if (!snap.exists()) {
    // 🆕 New user
    await set(userRef, {
      username,
      coins: 0,
      referredBy: referrerId || null,
      referralStatus: referrerId ? "pending" : null,
      createdAt: Date.now(),
    });

    // 🧩 Notify Referrer if exists
    if (referrerId) {
      const refRef = ref(db, `telegram_users/${referrerId}`);
      const refSnap = await get(refRef);

      if (refSnap.exists()) {
        const refName = refSnap.val().username || "Someone";

        // Message to new user
        await bot.sendMessage(
          chatId,
          `🔗 You were invited by *${refName}*!  
Open the web app to confirm your referral 🎮`,
          { parse_mode: "Markdown" }
        );

        // Message to referrer
        await bot.sendMessage(
          referrerId,
          `⏳ @${username} joined using your referral link.  
Referral status: *Pending...*`,
          { parse_mode: "Markdown" }
        );
      }
    }

    // Send main welcome message
    await bot.sendMessage(chatId, welcomeMessage, options);
  } else {
    // 👋 Existing user
    await bot.sendMessage(chatId, welcomeMessage, options);
  }

  // Always show user’s referral link
  bot.sendMessage(
    chatId,
    `🔗 *Your referral link:*  
https://t.me/${BOT_USERNAME}?start=ref=${chatId}`,
    { parse_mode: "Markdown" }
  );
});

// =========================
// 5️⃣ confirmReferral() — called from WebApp
// =========================
export async function confirmReferral(userId) {
  const userRef = ref(db, `telegram_users/${userId}`);
  const userSnap = await get(userRef);

  if (!userSnap.exists()) return;

  const userData = userSnap.val();
  if (userData.referralStatus !== "pending" || !userData.referredBy) return;

  const referrerId = userData.referredBy;
  const refRef = ref(db, `telegram_users/${referrerId}`);
  const refSnap = await get(refRef);

  if (!refSnap.exists()) return;

  const refData = refSnap.val();
  const newCoins = (refData.coins || 0) + 500;

  // Update coins and confirm referral
  await update(refRef, { coins: newCoins });
  await update(userRef, { referralStatus: "confirmed" });

  // Notify referrer
  bot.sendMessage(
    referrerId,
    `🎉 Congratulations!  
Your referral *@${userData.username || "User"}* just opened the web app.  
You earned *500 coins!* 💰`,
    { parse_mode: "Markdown" }
  );

  // Notify referred user
  bot.sendMessage(
    userId,
    `✅ Referral confirmed!  
You and your referrer are now connected.`,
    { parse_mode: "Markdown" }
  );
}

console.log("🤖 Telegram Referral Bot is running...");