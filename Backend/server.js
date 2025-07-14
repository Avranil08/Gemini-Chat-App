import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.post('/api/chat', async (req, res) => {
  const { prompt, history } = req.body;
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: history || [],
    });
    const result = await chat.sendMessage({ message: prompt });
    res.json({ reply: result.text, history: chat.history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () =>
  console.log(`Backend running at http://localhost:${port}`)
);
