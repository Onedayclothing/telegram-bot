const { Telegraf } = require('telegraf');
const crypto = require('crypto');

// បញ្ចូល Token តាមរយៈ Environment Variable
const bot = new Telegraf(process.env.BOT_TOKEN);

let payments = [];

// Command: /start
bot.start((ctx) => ctx.reply('ជំរាបសួរ! Bot ដំណើរការហើយ។'));

// Command: /genkey
bot.command('genkey', (ctx) => {
  const randomKey = '0D-' + crypto.randomBytes(6).toString('hex').toUpperCase();
  ctx.reply(`🔑 KEY ថ្មី (30d):\n/activate ${randomKey}\n\nផ្ញើ command ខាងលើទៅអ្នកប្រើ ដើម្បីដំណើរការ។`);
});

// Command: /activate
bot.command('activate', (ctx) => {
  const input = ctx.message.text.split(' ');
  const key = input[1];

  if (!key) {
    return ctx.reply('⚠️ សូមបញ្ចូល Key ផង! (ឧទាហរណ៍៖ /activate 0D-XXXXXX)');
  }

  ctx.reply(`✅ ដំណើរការជោគជ័យ!\nKey: ${key}\nអាជ្ញាប័ណ្ណរបស់អ្នកត្រូវបានបើកឱ្យប្រើប្រាស់រយៈពេល 30 ថ្ងៃ។`);
});

// Command: /fakepay <ចំនួនទឹកប្រាក់>
bot.command('fakepay', (ctx) => {
  const args = ctx.message.text.split(' ');
  const amount = parseFloat(args[1]) || 10;
  const txnId = 'TXN' + Math.floor(100000 + Math.random() * 900000);
  const date = new Date().toLocaleString('en-US', { timeZone: 'Asia/Phnom_Penh' });

  payments.push(amount);

  const receipt = `
🧾 **PAYMENT RECEIPT (SUCCESS)**
----------------------------------
🔹 **Status:** Paid ✅
🔹 **Transaction ID:** \`${txnId}\`
🔹 **Amount:** **$${amount.toFixed(2)}**
🔹 **Date:** ${date}
🔹 **Payment Method:** ABA / KHQR Mock
----------------------------------
កត់ត្រាចូលប្រព័ន្ធរួចរាល់!
`;

  ctx.replyWithMarkdown(receipt);
});

// Command: /total ឬ /sum
const handleTotal = (ctx) => {
  const total = payments.reduce((sum, current) => sum + current, 0);
  ctx.reply(`📊 ចំនួនទូទាត់សរុប (Total Payments):\n👉 $${total.toFixed(2)} (${payments.length} ប្រតិបត្តិការ)`);
};

bot.command('total', handleTotal);
bot.command('sum', handleTotal);

// Launch Bot
bot.launch();
console.log('Bot is running...');
