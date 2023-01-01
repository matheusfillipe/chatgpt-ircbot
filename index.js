require('dotenv').config()
const IRC = require("irc-framework")

async function main() {
  console.log("Creating bot...");

  const {ChatGPTAPIBrowser} = await import('chatgpt')
  const api = new ChatGPTAPIBrowser({
    email: process.env.OPENAI_EMAIL,
    password: process.env.OPENAI_PASSWORD,
  })
  await api.initSession()
  console.log("Bot created")

  console.log("Connecting to IRC...")
  var bot = new IRC.Client();
  var channel_names = process.env.IRC_CHANNELS.split(",")
  var buffers = [];
  var conversations = {};

  bot.connect({
    host: process.env.IRC_HOST,
    port: process.env.IRC_PORT,
    nick: process.env.IRC_NICK,
    username: process.env.IRC_NICK,
    password: process.env.IRC_PASSWORD,
  });

  bot.on('message', async function (event) {
    if (event.message.indexOf('hello') === 0) {
      event.reply('Hi!');
    }
    const nick_exp = "\\b" + process.env.IRC_NICK + "\\b[,:]?"
    if (!event.message.match(new RegExp(nick_exp))) {
      return
    }
      const message = event.message.replace(new RegExp(nick_exp), "")
      const key = event.nick + event.target
      try {
        let res = await api.sendMessage(message, {
          timeoutMs: 3 * 60 * 1000,
          ...conversations[key]
        });
        if (res === undefined) {
          res = await api.sendMessage(message, {
            timeoutMs: 3 * 60 * 1000,
            ...conversations[key]
          });
        }
        event.reply(`${event.nick}: ${res.response}`);
        conversations[key] = {conversationId: res.conversationId, parentMessageId: res.messageId};
      } catch (e) {
        event.reply(`${event.nick}: ${e.message}`);
      }
  });


  bot.on('registered', function () {
    // Raw message to set bot flag
    bot.raw(`MODE ${process.env.IRC_NICK} +B`);
    console.log("Connected to IRC")
    console.log("Joining channels...")
    for (const channel_name of channel_names) {
      console.log(`Joining ${channel_name}`)
      var channel = bot.channel(channel_name);
      channel.join();
      channel.say('Hi! Ask me anything.');
      buffers.push(channel);
    }
    console.log("Joined channels")
  });

}

main();
