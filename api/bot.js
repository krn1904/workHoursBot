const TelegramBot = require('node-telegram-bot-api');
const setupWorkLoggerBot = require('../bot');
const token = process.env.TELEGRAM_BOT_TOKEN;

// Only create and set up the bot once (on cold start)
let bot;
let isSetup = false;

if (!bot) {
  bot = new TelegramBot(token);
  if (!isSetup) {
    setupWorkLoggerBot(bot);
    isSetup = true;
  }
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    await bot.processUpdate(req.body);
    res.status(200).end();
  } else {
    res.status(405).end();
  }
}; 