const express = require('express');
const { Telegraf } = require('telegraf');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => res.send('OK'));
app.get('/healthz', (req, res) => res.send('OK'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("Error: TELEGRAM_BOT_TOKEN is missing!");
  process.exit(1);
}
const bot = new Telegraf(BOT_TOKEN);

const DATA_FILE = path.join(__dirname, 'db.json');

let db = {
  keysDB: {},
  activeChats: {},
  transactions: []
};

if (fs.existsSync(DATA_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    console.error("Error reading db.json:", err);
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function isChatActive(chatId) {
  const expireTime = db.activeChats[chatId];
  if (!expireTime) return false;
  
  if (Date.now() > expireTime) {
    delete db.activeChats[chatId];
    saveData();
    return false;
  }
  return true;
}

function formatDate(dateObj) {
  const d = String(dateObj.getDate()).padStart(2, '0');
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const y = dateObj.getFullYear();
  return `${d}/${m}/${y}`;
}

// --- COMMANDS ---

bot.start((ctx) => ctx.reply('Bot ដំណើរការរួចរាល់! សូមប្រើ /activate <KEY> ដើម្បីបេីកការប្រេីប្រាស់។'));

// បញ្ជា /genkey (គាំទ្រ m/min, h/hr, d/day, mo/month, life)
bot.command('genkey', (ctx) => {
  const args = ctx.message.text.split(' ')[1] || '30d';
  let durationMs;
  let isLifetime = false;

  const input = args.toLowerCase();

  if (input === 'life' || input === 'lifetime') {
    durationMs = 999 * 365 * 24 * 60 * 60 * 1000;
    isLifetime = true;
  } else if (input.endsWith('mo') || input.endsWith('month') || input.endsWith('months')) {
    durationMs = (parseInt(input) || 1) * 30 * 24 * 60 * 60 * 1000;
  } else if (input.endsWith('min') || input.endsWith('m')) {
    durationMs = (parseInt(input) || 30) * 60 * 1000;
  } else if (input.endsWith('h') || input.endsWith('hr') || input.endsWith('hours')) {
    durationMs = (parseInt(input) || 1) * 60 * 60 * 1000;
  } else {
    durationMs = (parseInt(input) || 30) * 24 * 60 * 60 * 1000;
  }

  const newKey = `OD-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  
  db.keysDB[newKey] = { durationMs, isUsed: false, isLifetime };
  saveData();

  ctx.reply(`KEY ថ្មី (${args.toUpperCase()}):\n\`/activate ${newKey}\` \n\nផ្ញើ KEY នេះទៅអតិថិជនសម្រាប់ /activate`, { parse_mode: 'Markdown' });
});

// បញ្ជា /activate <KEY>
bot.command('activate', (ctx) => {
  const args = ctx.message.text.split(' ');
  const inputKey = args[1];

  if (!inputKey) {
    return ctx.reply('សូមប្រើទម្រង់៖ /activate <KEY>');
  }

  const keyData = db.keysDB[inputKey];
  if (!keyData) {
    return ctx.reply('KEY មិនត្រឹមត្រូវ ឬមិនមាននៅក្នុងប្រព័ន្ធទេ!');
  }

  if (keyData.isUsed) {
    return ctx.reply('KEY នេះត្រូវបានប្រើប្រាស់រួចរាល់ហើយ!');
  }

  const expireDate = new Date(Date.now() + keyData.durationMs);
  db.activeChats[ctx.chat.id] = expireDate.getTime();
  keyData.isUsed = true;
  saveData();

  let expireText = keyData.isLifetime 
    ? 'គ្មានថ្ងៃផុតកំណត់ (Lifetime)' 
    : `រហូតដល់៖ ${formatDate(expireDate)}`;

  ctx.reply(`សកម្មជោគជ័យ!\nBot របស់អ្នកអាចប្រើប្រាស់បាន ${expireText}`);
});

// បញ្ជា /reset
bot.command('reset', (ctx) => {
  if (!isChatActive(ctx.chat.id)) {
    return ctx.reply('សូមដំណើរការអាជ្ញាប័ណ្ណជាមុនសិន៖ /activate <KEY>');
  }

  db.transactions = db.transactions.filter(t => t.chatId !== ctx.chat.id);
  saveData();

  ctx.reply('បាន Reset ទិន្នន័យរួចរាល់! តួលេខសរុបត្រូវបានកំណត់មកត្រឹម 0 វិញ។');
});

// បញ្ជា /fakepay
bot.command('fakepay', (ctx) => {
  if (!isChatActive(ctx.chat.id)) {
    return ctx.reply('សូមដំណើរការអាជ្ញាប័ណ្ណជាមុនសិន៖ /activate <KEY>');
  }

  const args = ctx.message.text.split(' ');
  const inputAmount = args[1] || '10';
  
  let currency = 'USD';
  if (inputAmount.toLowerCase().includes('khr') || inputAmount.includes('៛')) {
    currency = 'KHR';
  }

  const rawAmount = parseFloat(inputAmount.replace(/[^\d.]/g, '')) || 10;
  const refNo = 'FAKE' + Math.floor(100000 + Math.random() * 900000);

  db.transactions.push({
    chatId: ctx.chat.id,
    amount: rawAmount,
    currency: currency,
    refNo: refNo,
    dateStr: formatDate(new Date())
  });
  saveData();

  const displayAmount = currency === 'USD' ? `$${rawAmount.toFixed(2)}` : `៛${rawAmount.toLocaleString()}`;
  ctx.reply(`[FAKE PAYMENT] កត់ត្រាជោគជ័យ!\nចំនួន៖ ${displayAmount}\nRef: ${refNo}`);
});

// បញ្ជា /total ឬ /sum
const handleTotal = (ctx) => {
  if (!isChatActive(ctx.chat.id)) {
    return ctx.reply('សូមដំណើរការអាជ្ញាប័ណ្ណជាមុនសិន៖ /activate <KEY>');
  }

  const todayStr = formatDate(new Date());
  let usdTotal = 0, usdCount = 0;
  let khrTotal = 0, khrCount = 0;

  db.transactions.filter(t => t.chatId === ctx.chat.id && t.dateStr === todayStr).forEach(t => {
    if (t.currency === 'USD') { usdTotal += t.amount; usdCount++; }
    if (t.currency === 'KHR') { khrTotal += t.amount; khrCount++; }
  });

  const reportText = `របាយការណ៍ប្រាក់សរុបប្រចាំថ្ងៃ (${todayStr})\n\nដុល្លារ (USD): $${usdTotal.toFixed(2)} (${usdCount} ប្រតិបត្តិការ)\nរៀល (KHR): ៛${khrTotal.toLocaleString()} (${khrCount} ប្រតិបត្តិការ)`;

  ctx.reply(reportText);
};

bot.command('total', handleTotal);
bot.command('sum', handleTotal);

// --- MESSAGE HANDLER (ONEDAY CLOTHING ORDER PARSER & MULTI-BANK) ---
bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  if (!isChatActive(ctx.chat.id)) return;

  const text = ctx.message.text;

  // 1. ពិនិត្យមើលថាតើជាសារបញ្ជាទិញ (Order/Invoice) ពី Website ដែរឬទេ
  if (text.includes("Oneday Clothing") || text.includes("ចង់កុម្មង់ទិញ")) {
    const pattern = /\d+\.\s*(.*?)\s*\(Size:\s*([A-Za-z0-9]+)\)\s*x(\d+)\s*=\s*\$([\d\.]+)/g;
    let matches = [...text.matchAll(pattern)];

    if (matches.length > 0) {
      let invoiceMsg = "🧾 *ONEDAY CLOTHING - INVOICE*\n";
      invoiceMsg += "-----------------------------------\n";
      
      let grandTotal = 0;
      matches.forEach((match, index) => {
        let itemName = match[1].trim();
        let size = match[2].trim();
        let qty = parseInt(match[3]);
        let price = parseFloat(match[4]);
        let itemTotal = price * qty;
        
        grandTotal += itemTotal;

        invoiceMsg += `${index + 1}. *${itemName}*\n`;
        invoiceMsg += `   • Size: \`${size}\` | ចំនួន: \`${qty}\`\n`;
        invoiceMsg += `   • តម្លៃ: \`$${itemTotal.toFixed(2)}\`\n`;
      });

      invoiceMsg += "-----------------------------------\n";
      invoiceMsg += `💰 *ប្រាក់សរុប (Total): \`$${grandTotal.toFixed(2)}\`*\n`;
      invoiceMsg += "-----------------------------------\n";
      invoiceMsg += "🙏 អរគុណសម្រាប់ការគាំទ្រ Oneday Clothing!";

      return ctx.reply(invoiceMsg, { parse_mode: 'Markdown' });
    }
  }

  // 2. ប្រសិនបើមិនមែនជាសារបញ្ជាទិញទេ ប្រព័ន្ធនឹងដំណើរការ Smart Multi-Bank Notification Parser ធម្មតា
  const amountMatch = text.match(/(\$|USD|KHR|៛)?\s*([\d,]+(\.\d{1,2})?)\s*(USD|KHR|ដុល្លារ|រៀល)?/i);
  const refMatch = text.match(/(Trx\.?\s*ID|Ref|APV|Transaction\s*ID)[:\s]*([A-Z0-9]+)/i);

  if (amountMatch) {
    let rawAmount = parseFloat(amountMatch[2].replace(/,/g, ''));
    let currency = (text.includes('KHR') || text.includes('៛') || text.includes('រៀល')) ? 'KHR' : 'USD';
    let refNo = refMatch ? refMatch[2] : null;

    if (refNo) {
      const isDuplicate = db.transactions.some(t => t.chatId === ctx.chat.id && t.refNo === refNo);
      if (isDuplicate) return;
    }

    db.transactions.push({
      chatId: ctx.chat.id,
      amount: rawAmount,
      currency: currency,
      refNo: refNo,
      dateStr: formatDate(new Date())
    });
    saveData();
  }
});

bot.launch().then(() => {
  console.log('Telegram Bot is active!');
  bot.telegram.setMyCommands([
    { command: 'total', description: 'មើលរបាយការណ៍ប្រាក់សរុបប្រចាំថ្ងៃ' },
    { command: 'reset', description: 'លុបទិន្នន័យប្រាក់សរុបដើម្បីចាប់ផ្តើមថ្មី' },
    { command: 'fakepay', description: 'បង្កើតប្រតិបត្តិការសាកល្បង' },
    { command: 'activate', description: 'បើកដំណើរការអាជ្ញាប័ណ្ណ' },
    { command: 'genkey', description: 'បង្កើត Key ថ្មី (សម្រាប់ Admin)' }
  ]);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
