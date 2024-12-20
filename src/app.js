import 'dotenv/config';
import express from 'express';
import { InteractionType, verifyKeyMiddleware } from 'discord-interactions';
import './voiceHandler.js';


const app = express();

// 本番環境は8080, ngrokは3000
const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});


app.get('/', (req, res) => {
  res.send('Welcome to the server!');
});



app.post('/interactions', verifyKeyMiddleware(process.env.YOUR_PUBLIC_KEY), (req, res) => {
  const { type } = req.body;

  if (type === InteractionType.PING) {
    return res.status(200).json({ type: InteractionType.PONG });
  }

  return res.status(400).json({ error: 'unknown interaction type' });
});



