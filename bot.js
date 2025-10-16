import TelegramBot from "node-telegram-bot-api";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, update } from "firebase/database";

// =========================
// 1️⃣ Firebase Config
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyC_SO0ZnItNVoWif48MyMeznuLsA-jq52k",
  authDomain: "tgfjf-5bbfe.firebaseapp.com",
  databaseURL: "https://tgfjf-5bbfe-default-rtdb.firebaseio.com",
  projectId: "tgfjf-5bbfe",
  storageBucket: "tgfjf-5bbfe.firebasestorage.app",
  messagingSenderId: "898327972915",
  appId: "1:898327972915:web:8450b0cfdf69134474e746"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// =========================
// 2️⃣ Telegram Bot Setup
// =========================
const bot = new TelegramBot("8437351423:AAEauPmc30yXlTI0TstB3m2cmy-0PGrrpXk", { polling: true });

// =========================
// 3️⃣ Helper: Write / Update Firebase
// =========================
async function writeUser(userId, data) {
  const userRef = ref(db, `telegram_users/${userId}`);
  await update(userRef, data);
}

// =========================
// 4️⃣ Command: /start?ref=xxxx
// =========================
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || "Unknown";

  // Extract referral ID if exists
  const query = match[1]?.trim();
  let referrerId = null;
  if (query && query.startsWith("?ref=")) {
    referrerId = query.replace("?ref=", "");
  }

  // Check user existence
  const userRef = ref(db, `telegram_users/${chatId}`);
  const snap = await get(userRef);

  if (!snap.exists()) {
    // New user entry
    await set(userRef, {
      username,
      coins: 0,
      referredBy: referrerId || null,
      referralStatus: referrerId ? "pending" : null,
      createdAt: Date.now(),
    });

    if (referrerId) {
      // Fetch referrer name
      const refRef = ref(db, `telegram_users/${referrerId}`);
      const refSnap = await get(refRef);

      if (refSnap.exists()) {
        const refData = refSnap.val();
        const refName = refData.username || "Someone";

        // Tell the new user who referred them
        await bot.sendMessage(
          chatId,
          `👤 You were referred by ${refName}! Your reward will unlock once you open the web app 🔓`
        );

        // Tell the referrer
        await bot.sendMessage(
          referrerId,
          `📩 Your referral link was used by @${username}. Reward is pending until they open the app.`
        );
      }
    } else {
      bot.sendMessage(chatId, `👋 Welcome ${username}!`);
    }
  } else {
    bot.sendMessage(chatId, "Welcome back!");
  }

  bot.sendMessage(
    chatId,
    `Your referral link: https://t.me/YOUR_BOT_USERNAME?start=ref=${chatId}`
  );
});

// =========================
// 5️⃣ Confirm Referral (called from Web App)
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

  await update(refRef, { coins: newCoins });
  await update(userRef, { referralStatus: "confirmed" });

  bot.sendMessage(
    referrerId,
    `🎉 Your referral reward of 500 coins has been credited!`
  );

  bot.sendMessage(
    userId,
    `✅ Referral confirmed! You and your referrer are now connected.`
  );
}

console.log("🤖 Telegram Referral Bot is running...");
