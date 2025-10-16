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
  storageBucket: "tgfjf-5bbfe.firebasestorage.app",
  messagingSenderId: "898327972915",
  appId: "1:898327972915:web:8450b0cfdf69134474e746"
};

const appFB = initializeApp(firebaseConfig);
const db = getDatabase(appFB);

// =========================
// 2️⃣ Telegram Bot Setup
// =========================
const BOT_TOKEN = "8360936389:AAEuHJF7vZp_GK1IrOvMvVKQS_DMlDi4VyI"; // Replace with your bot token
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// =========================
// 3️⃣ Express Setup
// =========================
const app = express();
app.use(express.json());

// =========================
// 4️⃣ /start Command
// =========================
bot.onText(/\/start(.*)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const username = msg.from.username || msg.from.first_name || "User";

  const query = match[1]?.trim();
  let referrerId = null;

  if (query) {
    const clean = query.replace(/[\s?=]+/g, "").replace("ref", "");
    if (clean) referrerId = clean;
  }

  const userRef = ref(db, `telegram_users/${chatId}`);
  const userSnap = await get(userRef);

  if (!userSnap.exists()) {
    await set(userRef, {
      username,
      coins: 0,
      referrals: 0,
      referredBy: referrerId || null,
      referralStatus: referrerId ? "pending" : "new",
      createdAt: Date.now(),
    });

    if (referrerId) {
      const refRef = ref(db, `telegram_users/${referrerId}`);
      const refSnap = await get(refRef);

      if (refSnap.exists()) {
        const refData = refSnap.val();
        const refName = refData.username || "Someone";

        await bot.sendMessage(
          chatId,
          `👋 Welcome ${username}!\nYou were referred by ${refName}. Your reward will unlock once you open the app 🔓`
        );

        await bot.sendMessage(
          referrerId,
          `📩 Your referral link was used by @${username}.\nReward is *pending* until they open the app.`,
          { parse_mode: "Markdown" }
        );
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
                  text: "🎮 Open App",
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
    await bot.sendMessage(
      chatId,
      `👋 Welcome back, ${username}!\n✨ Continue earning below 👇`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🎮 Open App",
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

  // Send personal referral link
  await bot.sendMessage(
    chatId,
    `🔗 Your referral link:\nhttps://t.me/Earnwithfun7_bot?start=ref${chatId}`
  );
});

// =========================
// 5️⃣ Referral Confirmation Endpoint
// =========================
app.post("/confirm-referral", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const userRef = ref(db, `telegram_users/${userId}`);
    const userSnap = await get(userRef);

    if (!userSnap.exists())
      return res.status(404).json({ error: "User not found" });

    const userData = userSnap.val();
    if (userData.referralStatus !== "pending" || !userData.referredBy)
      return res.json({ message: "No pending referral" });

    const referrerId = userData.referredBy;
    const refRef = ref(db, `telegram_users/${referrerId}`);
    const refSnap = await get(refRef);

    if (!refSnap.exists())
      return res.status(404).json({ error: "Referrer not found" });

    const refData = refSnap.val();
    const newCoins = (refData.coins || 0) + 500;
    const newRefCount = (refData.referrals || 0) + 1;

    await update(refRef, { coins: newCoins, referrals: newRefCount });
    await update(userRef, { referralStatus: "confirmed" });

    await bot.sendMessage(
      referrerId,
      `🎉 Your referral successfully joined the app!\n💰 +500 coins added to your balance.\n👥 Total referrals: ${newRefCount}`
    );

    await bot.sendMessage(
      userId,
      `✅ Referral confirmed!\nYou're now connected with your referrer.`
    );

    res.json({ success: true, referrerId, newCoins, newRefCount });
  } catch (err) {
    console.error("Referral confirm error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =========================
// 6️⃣ Server Listener
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Bot server running on port ${PORT}`)
);

console.log("🤖 Telegram Referral Bot is live...");