const express = require('express');
const { Telegraf } = require('telegraf');

const app = express();
const PORT = process.env.PORT || 8080;

// ១. បើក Express Web Server សម្រាប់ UptimeRobot
app.get('/', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.send('OK'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// ២. ទាញយក Telegram Bot Token
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("Error: TELEGRAM_BOT_TOKEN is missing!");
  process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);

// Database បណ្តោះអាសន្ន
const keysDB = {};         
const activeChats = {};    
const transactions = [];   

// Helper Functions
function isChatActive(chatId) {
  const expireTime = activeChats[chatId];
  if (!expireTime) return false;
  return Date.now() < expireTime;
}

function formatDate(dateObj) {
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
}

// --- COMMANDS ---

// បញ្ជា /genkey (គាំទ្រ m = នាទី, h = ម៉ោង, d = ថ្ងៃ, life = Lifetime)
bot.command('genkey', (ctx) => {
  const args = ctx.message.text.split(' ')[1] || '30d';
  let durationMs;
  let isLifetime = false;

  const input = args.toLowerCase();

  if (input === 'life' || input === 'lifetime') {
    durationMs = 999 * 365 * 24 * 60 * 60 * 1000; // ៩៩៩ ឆ្នាំ
    isLifetime = true;
  } else if (input.endsWith('m')) {
    durationMs = (parseInt(input) || 30) * 60 * 1000;
  } else if (input.endsWith('h')) {
    durationMs = (parseInt(input) || 1) * 60 * 60 * 1000;
  } else {
    durationMs = (parseInt(input) || 30) * 24 * 60 * 60 * 1000;
  }

  const newKey = `OD-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  keysDB[newKey] = { durationMs, isUsed: false, isLifetime };

  // ផ្ញើសារក្នុងទម្រង់ Tappable Code Block ងាយស្រួល Tap-to-Copy
  ctx.reply(`🔑 **KEY ថ្មី (${args.toUpperCase()})៖**\n\`/activate ${newKey}\` \n\nផ្ញើ KEY នេះទៅអតិថិជនសម្រាប់ /activate`, { parse_mode: 'Markdown' });
});

// បញ្ជា /activate <KEY>
bot.command('activate', (ctx) => {
  const args = ctx.message.text.split(' ');
  const inputKey = args[1];

  if (!inputKey) {
    return ctx.reply('⚠️ សូមប្រើទម្រង់៖ `/activate <KEY>`', { parse_mode: 'Markdown' });
  }

  const keyData = keysDB[inputKey];
  if (!keyData) {
    return ctx.reply('❌ KEY មិនត្រឹមត្រូវ ឬមិនមាននៅក្នុងប្រព័ន្ធទេ!');
  }

  if (keyData.isUsed) {
    return ctx.reply('⚠️ KEY នេះត្រូវបានប្រើប្រាស់រួចរាល់ហើយ!');
  }

  // Activate គណនី
  const expireDate = new Date(Date.now() + keyData.durationMs);
  activeChats[ctx.chat.id] = expireDate.getTime();
  keyData.isUsed = true;

  let expireText = keyData.isLifetime 
    ? '**គ្មានថ្ងៃផុតកំណត់ (Lifetime)** ♾️' 
    : `រហូតដល់៖ **${formatDate(expireDate)}**`;

  ctx.reply(`✅ **សកម្មជោគជ័យ!**\nប៊ូតរបស់អ្នកអាចប្រើប្រាស់បាន ${expireText}`, { parse_mode: 'Markdown' });
});

// បញ្ជា /total
bot.command('total', (ctx) => {
  if (!isChatActive(ctx.chat.id)) {
    return ctx.reply('🔒 **សូមដំណើរការអាជ្ញាប័ណ្ណជាមុនសិន៖** `/activate <KEY>`', { parse_mode: 'Markdown' });
  }

  const todayStr = formatDate(new Date());
  let usdTotal = 0, usdCount = 0;
  let khrTotal = 0, khrCount = 0;

  transactions.filter(t => t.chatId === ctx.chat.id && t.dateStr === todayStr).forEach(t => {
    if (t.currency === 'USD') { usdTotal += t.amount; usdCount++; }
    if (t.currency === 'KHR') { khrTotal += t.amount; khrCount++; }
  });

  ctx.reply(`📊 **របាយការណ៍ប្រាក់សរុបប្រចាំថ្ងៃ (${todayStr})**\n\n💵 **ដុល្លារ (USD):** $${usdTotal.toFixed(2)} (${usdCount} ប្រតិបត្តិការ)\n៛ **រៀល (KHR):** ៛${khrTotal.toLocaleString()} (${khrCount} ប្រតិបត្តិការ)`);
});

// --- SMART MULTI-BANK NOTIFICATION PARSER ---
bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  if (!isChatActive(ctx.chat.id)) return;

  const text = ctx.message.text;
  const amountMatch = text.match(/(\$|USD|KHR|៛)?\s*([\d,]+(\.\d{1,2})?)\s*(USD|KHR|ដុល្លារ|រៀល)?/i);
  const refMatch = text.match(/(Trx\.?\s*ID|Ref|APV|Transaction\s*ID)[:\s]*([A-Z0-0]+)/i);

  if (amountMatch) {
    let rawAmount = parseFloat(amountMatch[2].replace(/,/g, ''));
    let currency = (text.includes('KHR') || text.includes('៛') || text.includes('រៀល')) ? 'KHR' : 'USD';
    let refNo = refMatch ? refMatch[2] : null;

    if (refNo) {
      const isDuplicate = transactions.some(t => t.chatId === ctx.chat.id && t.refNo === refNo);
      if (isDuplicate) {
        return ctx.reply(`⚠️ **ព្រមាន៖ ប្រតិបត្តិការស្ទួន!**\nលេខ Ref: \`${refNo}\` ត្រូវបានកត់ត្រារួចរាល់ហើយ។`, { parse_mode: 'Markdown' });
      }
    }

    transactions.push({
      chatId: ctx.chat.id,
      amount: rawAmount,
      currency: currency,
      refNo: refNo,
      dateStr: formatDate(new Date())
    });

    ctx.reply(`✅ **កត់ត្រាជោគជ័យ!**\n💰 ចំនួន៖ **${currency === 'USD' ? '$' + rawAmount : '៛' + rawAmount.toLocaleString()}** ${refNo ? '\n🧾 Ref: ' + refNo : ''}`);
  }
});

bot.launch().then(() => console.log('Telegram Bot is active!'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
