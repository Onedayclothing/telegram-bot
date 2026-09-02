const { Telegraf } = require('telegraf');
const express = require('express');
const crypto = require('crypto');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

// Command: /start
bot.start((ctx) => ctx.reply('ជំរាបសួរ! Bot ដំណើរការហើយ។'));

// Command: /genkey
bot.command('genkey', (ctx) => {
  const randomKey = '0D-' + crypto.randomBytes(6).toString('hex').toUpperCase();
  ctx.reply(`🔑 KEY ថ្មី (30d):\n/activate ${randomKey}\n\nផ្ញើ command ខាងលើទៅអ្នកប្រើ ដើម្បីដំណើរការ។`);
});

bot.launch();
console.log('Bot started successfully!');
