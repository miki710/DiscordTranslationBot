import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, EndBehaviorType } from '@discordjs/voice';
import { transcribeAudioFile } from './gladia.js';
import dotenv from 'dotenv';
import fs from 'fs';
import { createWriteStream } from 'fs';
import { spawn } from 'child_process';
import * as prism from 'prism-media';
import { pipeline } from 'stream';
import path from 'path';

dotenv.config(); // .envファイルの内容を読み込む

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    
  ],
});

client.login(process.env.YOUR_BOT_TOKEN);

client.once('ready', () => {
  console.log('Bot is ready!');
});

client.on('messageCreate', async (message) => {
  if (!message.guild) return;

  if (message.content === '!join') {
    if (message.member.voice.channel) {
      const connection = joinVoiceChannel({
        channelId: message.member.voice.channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      const receiver = connection.receiver;
      const subscribedUsers = new Set();

      receiver.speaking.on('start', (userId) => {
          if (!subscribedUsers.has(userId)) {
            console.log(`User ${userId} is already subscribed. Removing and re-subscribing.`);
            subscribedUsers.delete(userId);
          }

          console.log(`Starting to subscribe user: ${userId}`);
          const opusStream = receiver.subscribe(userId, {
            end: {
              behavior: EndBehaviorType.AfterSilence,
              duration: 100,
            },
          });
          subscribedUsers.add(userId);

          const pcmStream = new prism.opus.Decoder({
            frameSize: 960,
            channels: 1,
            rate: 48000,
          });

          const filePath = `./audio/${userId}_${Date.now()}.pcm`;

          // ディレクトリの確認と作成
          const audioDir = path.dirname(filePath);
          if (!fs.existsSync(audioDir)) {
              fs.mkdirSync(audioDir, { recursive: true });
          }

          const out = createWriteStream(filePath);

          pipeline(opusStream, pcmStream, out, (err) => {
            if (err) {
              console.warn(`Error recording file ${filePath} - ${err.message}`);
            } else {
              console.log(`File recorded to ${filePath}`);

              const convertedFilePath = path.join(path.dirname(filePath), `converted_${path.basename(filePath, '.pcm')}.wav`);

              const outputDir = path.dirname(convertedFilePath);
              if (!fs.existsSync(outputDir)) {
                  fs.mkdirSync(outputDir, { recursive: true });
              }

              const ffmpeg = spawn('ffmpeg', [
                '-f', 's16le',
                '-ar', '48000', 
                '-ac', '1', 
                '-i', filePath,
                convertedFilePath
              ]);

              ffmpeg.stdout.on('data', (data) => {
                console.log(`stdout: ${data}`);
              });

              ffmpeg.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
              });

              ffmpeg.on('close', (code) => {
                if (code !== 0) {
                  console.error(`Error converting file: ffmpeg exited with code ${code}`);
                } else {
                  console.log('File has been converted to 16kHz WAV');
                  handleAudioFile(convertedFilePath, message);
                }
              });
            }
          });

          opusStream.on('end', async () => {
            console.log('Audio stream ended:', userId);
            subscribedUsers.delete(userId);
          });

          opusStream.on('error', (error) => {
            console.error('Audio stream error:', userId, error);
            subscribedUsers.delete(userId);
          });
      }); 
    } else {
      message.reply('ボイスチャンネルに参加してください');
    }
  }
});

// 新しい非同期関数を定義
async function handleAudioFile(convertedFilePath, message) {
    try {
      const transcription = await transcribeAudioFile(convertedFilePath);
      message.channel.send(`文字起こし結果: ${transcription}`);
      fs.unlinkSync(convertedFilePath); // 一時ファイルを削除
    } catch (error) {
      console.error('Error during live transcription:', error);
    }
}




