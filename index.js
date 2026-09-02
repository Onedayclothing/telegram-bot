const { Telegraf } = require('telegraf');
const express = require('express');
const crypto = require('crypto');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

// ផ្ទុកទិន្នន័យទូទាត់បណ្តោះអាសន្ន
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

// Command: /pay <ចំនួនទឹកប្រាក់> (ឧទាហរណ៍៖ /pay 10)
bot.command('pay', (ctx) => {
  const args = ctx.message.text.split(' ');
  const amount = parseFloat(args[1]);

  if (isNaN(amount)) {
    return ctx.reply('⚠️ សូមបញ្ចូលចំនួនទឹកប្រាក់ជាលេខ! (ឧទាហរណ៍៖ /pay 10)');
  }

  payments.push(amount);
  ctx.reply(`💵 កត់ត្រាការទូទាត់បានចំនួន: $${amount.toFixed(2)}`);
});

// Command: /total ឬ /sum សម្រាប់បូកសរុបទឹកប្រាក់ទាំងអស់
const handleTotal = (ctx) => {
  const total = payments.reduce((sum, current) => sum + current, 0);
  ctx.reply(`📊 ចំនួនទូទាត់សរុប (Total Payments):\n👉 $${total.toFixed(2)} (${payments.length} ប្រតិបត្តិការ)`);
};

bot.command('total', handleTotal);
bot.command('sum', handleTotal);

bot.launch();
console.log('Bot started successfully!');
