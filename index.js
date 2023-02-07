require('dotenv').config()
const IRC = require("irc-framework")
const lineBreak = require("irc-framework/src/linebreak").lineBreak;

function generate_prompt() {
  return `You are ChatGPT, a large language model trained by OpenAI. Respond conversationally. Do not answer as the user. Current date: {new Date().toISOString().split('T')[0]}\n\nUser: Hello\nChatGPT: Hello! How can I help you today? <|im_end|>\n\n\n`
}

async function main() {
  console.log("Creating bot...");

  const {ChatGPTAPI} = await import('chatgpt')
  const api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY
  })
  console.log("Bot created")

  console.log("Connecting to IRC...")
  var bot = new IRC.Client();
  var channel_names = process.env.IRC_CHANNELS.split(",")
  var buffers = [];
  var conversations = {};
  var newcomers = new Set();

  bot.connect({
    host: process.env.IRC_HOST,
    port: process.env.IRC_PORT,
    nick: process.env.IRC_NICK,
    username: process.env.IRC_NICK,
    password: process.env.IRC_PASSWORD,
  });

  bot.on("join", function (event) {
    newcomers.add(event.nick)
    const key = event.nick + event.target
    conversations[key] = {};
  })

  bot.on("part", function (event) {
    const key = event.nick + event.target
    conversations[key] = {};
  })

  bot.on('message', async function (event) {
    // If is first greeting of a user
    if (newcomers.has(event.nick) && event.message.match(new RegExp("\\b(hi|hello|yo|howdy|hey guys|namaste)\\b", "i"))) {
      bot.say(event.target, "Hi " + event.nick + "! Welcome to the chat.")
    }
    newcomers.delete(event.nick)


    const nick_exp = "\\b" + process.env.IRC_NICK + "\\b[,:]?"
    if (!event.message.match(new RegExp(nick_exp))) {
      return
    }
    const message = event.message.replace(new RegExp(nick_exp), "").trim()
    const key = event.nick + event.target
    if (message == "reset") {
      conversations[key] = {};
      bot.say(event.target, `${event.nick}: Conversation reset.`)
      return
    }
    if (message == "help") {
      bot.say(event.target, `${event.nick}: You can say 'reset' to reset the conversation or just normally talk to me and ask questions`)
      return
    }
    if (message.length == 0) {
      return
    }

    try {
      const splitResponse = (response) => {
        let lines = response
          .split(/\r\n|\n|\r/)
          .filter(i => i);
        lines.map(line =>
          [...lineBreak(line, {
            bytes: 250,
            allowBreakingWords: false,
            allowBreakingGraphemes: true,
          })]
        )
        return Array.from(lines.reduce((acc, val) => acc.concat(val), []))
      }

      var linesSent = 0
      const reply = async (res, final = false) => {
        if (!res.text) {
          return
        }
        let lines = splitResponse(res.text)
        if (lines.length > linesSent + 1 || final) {
          let end = final ? lines.length : lines.length - 1
          for (let i = linesSent; i < end; i++) {
            event.reply(`${event.nick}: ${lines[i]}`)
          }
          linesSent = end
        }
      }
      let res = await api.sendMessage(message, {
        timeoutMs: 3 * 60 * 1000,
        onProgress: reply,
        promptPrefix: generate_prompt(),
        ...conversations[key]
      });
      if (res === undefined) {
        res = await api.sendMessage(message, {
          timeoutMs: 3 * 60 * 1000,
          onProgress: reply,
          promptPrefix: generate_prompt(),
          ...conversations[key]
        });
      }
      reply(res, true)
      conversations[key] = {
        conversationId: res.conversationId,
        parentMessageId: res.id,
      }
    } catch (e) {
      event.reply(`${event.nick}: ${e.message}`);
      conversations[key] = {};
      return;
    }
    event.reply("-----------------------------")
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
