const dotenv = require('dotenv');
dotenv.config();

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const token = process.env.ADMIN_BOT_TOKEN;
const source = process.env.SOURCE_CHANNEL_ID;
const target = process.env.TARGET_CHANNEL_ID;

if (!token || !source || !target) {
  console.error("❌ Missing environment variables.");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

let nextMessageId = 10; // start from your known ID
let maxFailures = 20;   // stop after too many skips
let failureCount = 0;

console.log("🚀 Admin Bot Running...");

cron.schedule('*/1 * * * *', async () => {
  try {
    await bot.copyMessage(target, source, nextMessageId);

    console.log(`✅ Copied message ID ${nextMessageId}`);
    nextMessageId++;
    failureCount = 0; // reset failures if success

  } catch (err) {

    console.log(`⚠️ Skipping ID ${nextMessageId} → ${err.response?.body?.description || err.message}`);
    
    nextMessageId++;
    failureCount++;

    if (failureCount >= maxFailures) {
      console.log("🛑 Too many missing messages. Stopping scan.");
      process.exit(0);
    }
  }
});