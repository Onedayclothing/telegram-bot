const { Telegraf } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

bot.start((ctx) => ctx.reply('ជំរាបសួរ! Bot ដំណើរការហើយ។'));
bot.help((ctx) => ctx.reply('ផ្ញើសារមកកាន់ Bot ដើម្បីសាកល្បង។'));

bot.launch();
console.log('Bot started successfully!');
