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
  databaseURL: "https://tgfjf-5bbfe-default-rtdb.firebaseio.com",
  projectId: "tgfjf-5bbfe",
  storageBucket: "tgfjf-5bbfe.appspot.com", // ✅ fixed here
  messagingSenderId: "898327972915",
  appId: "1:898327972915:web:8450b0cfdf69134474e746",
};

const appFB = initializeApp(firebaseConfig);
const db = getDatabase(appFB);

// =========================
// 2️⃣ Telegram Bot Setup
// =========================
const BOT_TOKEN = "8231358896:AAFz8gTpIHMsmZ1EDAR8TJL_l7AMnleVV0g";
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// =========================
// 3️⃣ Express App Setup (for Render port binding)
// =========================
const app = express();
app.use(express.json());

// =========================
// 4️⃣ Command: /start (with referral)
// =========================
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || "User";

  const query = match[1]?.trim();
  let referrerId = null;
  if (query && query.startsWith("?ref=")) {
    referrerId = query.replace("?ref=", "");
  }

  console.log("📩 Start command triggered:", { chatId, username, referrerId });

  const userRef = ref(db, `telegram_users/${chatId}`);
  const snap = await get(userRef);

  if (!snap.exists()) {
    console.log("🟢 New user detected, writing to Firebase...");
    await set(userRef, {
      username,
      coins: 0,
      referredBy: referrerId || null,
      referralStatus: referrerId ? "pending" : null,
      createdAt: Date.now(),
    });
    console.log("✅ User written successfully:", chatId);

    if (referrerId) {
      const refRef = ref(db, `telegram_users/${referrerId}`);
      const refSnap = await get(refRef);

      if (refSnap.exists()) {
        const refData = refSnap.val();
        const refName = refData.username || "Someone";

        await bot.sendMessage(
          chatId,
          `👋 Welcome ${username}!\nYou were referred by ${refName}.\nYour reward will unlock once you open the app 🔓`
        );

        await bot.sendMessage(
          referrerId,
          `📩 Your referral link was used by @${username}.\nReward is *pending* until they open the app.`,
          { parse_mode: "Markdown" }
        );
      } else {
        console.warn("⚠️ Referrer not found in database:", referrerId);
      }
    } else {
      await bot.sendMessage(
        chatId,
        `👋 Welcome ${username}!\n\n🎮 Earn rewards, invite friends, and grow your coins!`,
        {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🎮 Play",
                  web_app: { url: "https://telegram-earning-bot.vercel.app" },
                },
              ],
              [
                {
                  text: "💬 Join Community",
                  url: "https://t.me/finisher_techg",
                },
              ],
            ],
          },
        }
      );
    }
  } else {
    console.log("🔁 Existing user rejoined:", chatId);
    await bot.sendMessage(
      chatId,
      `👋 Welcome back, ${username}!\n\n✨ Glad to see you again!\n\n🎮 Continue earning below 👇`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🎮 Play",
                web_app: { url: "https://telegram-earning-bot.vercel.app" },
              },
            ],
            [
              {
                text: "💬 Join Community",
                url: "https://t.me/finisher_techg",
              },
            ],
          ],
        },
      }
    );
  }

  await bot.sendMessage(
    chatId,
    `🔗 Your referral link:\nhttps://t.me/Reffeewlalbot?start=ref=${chatId}`
  );
});

// =========================
// 5️⃣ Referral Confirmation (Webhook/API)
// =========================
app.post("/confirm-referral", async (req, res) => {
  const { userId } = req.body;
  console.log("🧾 Confirm referral request:", userId);

  try {
    const userRef = ref(db, `telegram_users/${userId}`);
    const userSnap = await get(userRef);
    if (!userSnap.exists()) return res.status(404).json({ error: "User not found" });

    const userData = userSnap.val();
    if (userData.referralStatus !== "pending" || !userData.referredBy)
      return res.json({ message: "No pending referral" });

    const referrerId = userData.referredBy;
    const refRef = ref(db, `telegram_users/${referrerId}`);
    const refSnap = await get(refRef);
    if (!refSnap.exists()) return res.status(404).json({ error: "Referrer not found" });

    const refData = refSnap.val();
    const newCoins = (refData.coins || 0) + 500;

    await update(refRef, { coins: newCoins });
    await update(userRef, { referralStatus: "confirmed" });

    await bot.sendMessage(
      referrerId,
      `🎉 Your referral successfully joined the app!\n💰 +500 coins added to your balance.`
    );

    await bot.sendMessage(
      userId,
      `✅ Referral confirmed!\nYou and your referrer are now connected.`
    );

    console.log("✅ Referral confirmed between:", referrerId, "and", userId);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Referral confirm error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =========================
// 6️⃣ Server Listener (for Render)
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Bot server running on port ${PORT}`));

console.log("🤖 Telegram Referral Bot is running...");