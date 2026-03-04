// const dotenv = require('dotenv');
// dotenv.config();

// const token = process.env.ADMIN_BOT_TOKEN;
// const source = process.env.SOURCE_CHANNEL_ID;
// const target = process.env.TARGET_CHANNEL_ID;

// if (!token || !source || !target) {
//   console.error('Missing ADMIN_BOT_TOKEN, SOURCE_CHANNEL_ID or TARGET_CHANNEL_ID in .env');
//   process.exit(1);
// }

// const TelegramBot = require('node-telegram-bot-api');
// const cron = require('node-cron');

// const bot = new TelegramBot(token, { polling: false });

// let nextMessageId = 1;

// // 🔥 TEMP TEST MODE (every 1 minute)
// cron.schedule('*/1 * * * *', async () => {
//   try {
//    await bot.copyMessage(target, source, nextMessageId);
//     console.log('Forwarded message ID', nextMessageId);
//     nextMessageId += 10;
//   } catch (err) {
//     console.error('Forward error:', err.message);
//   }
// });

// console.log('Admin Bot Running...');

const dotenv = require('dotenv');
dotenv.config();

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

const bot = new TelegramBot(process.env.ADMIN_BOT_TOKEN, { polling: false });

const source = process.env.SOURCE_CHANNEL_ID;
const target = process.env.TARGET_CHANNEL_ID;

let nextMessageId = 10;

cron.schedule('*/1 * * * *', async () => {
  try {
    await bot.copyMessage(target, source, nextMessageId);
    console.log('✅ Copied message ID', nextMessageId);
    nextMessageId++; // move to next message
  } catch (err) {
    console.log('❌ No more messages to copy.');
  }
});