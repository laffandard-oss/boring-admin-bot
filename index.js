// Admin forwarding bot - listens to a storage channel and copies posts to the main channel
// Features:
// - Detects content type (photo, video, document, text, etc.) and copies preserving quality
// - Permission checks against AUTHORIZED_ADMIN_IDS (comma-separated list)
// - De-duplicates processed messages and handles media groups safely
// - Error handling and admin notifications

const dotenv = require('dotenv');
dotenv.config();

const TelegramBot = require('node-telegram-bot-api');

// Required env vars
const token = process.env.ADMIN_BOT_TOKEN;
const STORAGE_CHANNEL_ID = process.env.STORAGE_CHANNEL_ID; // channel where uploads arrive
const MAIN_CHANNEL_ID = process.env.MAIN_CHANNEL_ID; // channel to copy to

// Optional: comma-separated list of allowed uploader user IDs (admin IDs)
// If empty, all uploads from the storage channel are allowed
const AUTHORIZED_ADMIN_IDS = process.env.AUTHORIZED_ADMIN_IDS || '';

// Optional admin notification chat id (your personal Telegram id) to receive error alerts
const ADMIN_NOTIFY_CHAT = process.env.ADMIN_NOTIFY_CHAT || null;

if (!token || !STORAGE_CHANNEL_ID || !MAIN_CHANNEL_ID) {
  console.error('❌ Missing one of ADMIN_BOT_TOKEN, STORAGE_CHANNEL_ID, MAIN_CHANNEL_ID in .env');
  process.exit(1);
}

// Start bot in polling mode so it receives `channel_post` updates
const bot = new TelegramBot(token, { polling: true });

// Parsed sets for quick checks
const authorizedSet = new Set(
  AUTHORIZED_ADMIN_IDS.split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

// Track processed messages to avoid duplicate handling
const processedMessageIds = new Set();

// Optional: track media groups (we copy individual messages in a group)
const processedMediaGroups = new Set();

console.log('🚀 Admin Forwarding Bot started (listening for new posts)');

// Helper: get uploader id (string) from a message object in different scenarios
function getUploaderId(msg) {
  // Normal user posts (in groups) have msg.from
  if (msg.from && msg.from.id) return String(msg.from.id);

  // Forwarded posts may carry forward_from
  if (msg.forward_from && msg.forward_from.id) return String(msg.forward_from.id);

  // If posted by a channel, sender_chat contains the channel id
  if (msg.sender_chat && msg.sender_chat.id) return String(msg.sender_chat.id);

  // Fallback: no uploader id available
  return null;
}

// Permission check: allow if authorizedSet is empty (open) OR uploader is in list
function checkPermissions(msg) {
  if (authorizedSet.size === 0) return true; // permissive by default

  const uploader = getUploaderId(msg);
  if (!uploader) return false;

  return authorizedSet.has(uploader);
}

// Centralized error handler: logs and optionally notifies admin
async function handleError(err, context = '') {
  const msg = `Error${context ? ' (' + context + ')' : ''}: ${err.message || err}`;
  console.error(msg);
  if (ADMIN_NOTIFY_CHAT) {
    try {
      await bot.sendMessage(ADMIN_NOTIFY_CHAT, `Admin Bot error: ${msg}`);
    } catch (notifyErr) {
      console.error('Failed sending admin notification', notifyErr.message || notifyErr);
    }
  }
}

// Primary upload handler: copies messages to the main channel while preserving quality
async function handleUpload(msg) {
  try {
    // Ensure we only process posts coming from the configured storage channel
    if (String(msg.chat.id) !== String(STORAGE_CHANNEL_ID)) return;

    // De-duplicate by message id
    const key = `${msg.chat.id}:${msg.message_id}`;
    if (processedMessageIds.has(key)) return;
    processedMessageIds.add(key);

    // If this is part of a media group, mark group so duplicates aren't reprocessed
    if (msg.media_group_id) {
      if (processedMediaGroups.has(msg.media_group_id)) return;
      // We'll allow copying each message in the group, but mark the group so
      // if the bot re-receives the same group again it won't re-copy them.
      processedMediaGroups.add(msg.media_group_id);
    }

    // Permission check
    if (!checkPermissions(msg)) {
      console.log(`🔒 Unauthorized upload skipped (uploader=${getUploaderId(msg)})`);
      return;
    }

    // Determine content type (we rely on Telegram's message fields)
    let contentType = 'unknown';
    if (msg.photo) contentType = 'photo';
    else if (msg.video) contentType = 'video';
    else if (msg.document) contentType = 'document';
    else if (msg.text) contentType = 'text';
    else if (msg.sticker) contentType = 'sticker';
    else if (msg.animation) contentType = 'animation';
    else if (msg.audio) contentType = 'audio';
    else if (msg.voice) contentType = 'voice';

    console.log(`➡️ Copying ${contentType} (msg=${msg.message_id}) to main channel`);

    // Use copyMessage to preserve original file quality and captions
    await bot.copyMessage(String(MAIN_CHANNEL_ID), String(msg.chat.id), msg.message_id);

    console.log(`✅ Copied message ${msg.message_id} (${contentType})`);

  } catch (err) {
    // For transient errors we log and optionally notify admin
    await handleError(err, `copy msg ${msg.message_id}`);
  }
}

// Listen for new posts in channels where the bot is added as admin
bot.on('channel_post', async (msg) => {
  try {
    // Only handle posts from our storage channel
    if (String(msg.chat.id) !== String(STORAGE_CHANNEL_ID)) return;

    // Process the upload
    await handleUpload(msg);
  } catch (err) {
    await handleError(err, 'channel_post handler');
  }
});

// Also listen for edited posts (optional) and attempt to copy edits as new posts
bot.on('edited_channel_post', async (msg) => {
  try {
    if (String(msg.chat.id) !== String(STORAGE_CHANNEL_ID)) return;
    // Treat edited post similar to a new post: copy it again
    await handleUpload(msg);
  } catch (err) {
    await handleError(err, 'edited_channel_post handler');
  }
});

// Graceful shutdown handling
process.on('uncaughtException', async (err) => {
  await handleError(err, 'uncaughtException');
  process.exit(1);
});

process.on('unhandledRejection', async (reason) => {
  await handleError(reason, 'unhandledRejection');
});
