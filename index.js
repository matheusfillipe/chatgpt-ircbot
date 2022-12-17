require('dotenv').config()
const IRC = require("irc-framework")

async function main() {
  const { ChatGPTAPIBrowser } = await import('chatgpt')
  console.log("Creating bot...");

  const api = new ChatGPTAPIBrowser({
    email: process.env.OPENAI_EMAIL,
    password: process.env.OPENAI_PASSWORD
  })
  await api.init()

  console.log("Bot created")


  console.log("Connecting to IRC...")
  var bot = new IRC.Client();
  var channel_names = process.env.IRC_CHANNELS.split(",")
  var buffers = [];

  bot.connect({
    host: process.env.IRC_HOST,
    port: process.env.IRC_PORT,
    nick: process.env.IRC_NICK,
  });

  bot.on('message', async function (event) {
    if (event.message.indexOf('hello') === 0) {
      event.reply('Hi!');
    }
    const nick_exp = "\\b" + process.env.IRC_NICK + "\\b[,:]?"
    if (event.message.match(new RegExp(nick_exp))) {
      const message = event.message.replace(new RegExp(nick_exp), "")
      event.reply(await api.sendMessage(message))
    }

  });


  bot.on('registered', function () {
    console.log("Connected to IRC")
    console.log("Joining channels...")
    for (const channel_name of channel_names) {
      var channel = bot.channel(channel_name);
      channel.join();
      channel.say('Hi! Ask me anything.');
      buffers.push(channel);
    }
    console.log("Joined channels")
  });

}

main();
