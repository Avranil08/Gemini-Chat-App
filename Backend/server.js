import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};
connectDB();

// Gemini AI setup
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Mongoose Models
// User schema now uses 'email' instead of 'username'
const User = mongoose.model(
  'User',
  new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
  })
);

const Chat = mongoose.model(
  'Chat',
  new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    history: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now },
  })
);

// --- Middleware to Protect Routes ---
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  if (!token) {
    return res.status(401).json({ msg: 'No token, authorization denied' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (e) {
    res.status(401).json({ msg: 'Token is not valid' });
  }
};

// --- API Routes ---

// @route   POST /api/register
// @desc    Register a new user
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ msg: 'User with this email already exists' });
    }
    user = new User({ email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();
    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({ token, email: user.email });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/login
// @desc    Authenticate user & get token
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid Credentials' });
    }
    const payload = { user: { id: user.id } };
    jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: 360000 },
      (err, token) => {
        if (err) throw err;
        res.json({ token, email: user.email });
      }
    );
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/chats
// @desc    Get all chat sessions for the authenticated user
app.get('/api/chats', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user.id }).sort({
      createdAt: 1,
    });
    res.json(chats);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/chat
// @desc    Send a prompt to Gemini and save the new history
app.post('/api/chat', auth, async (req, res) => {
  const { prompt, chatId } = req.body;
  try {
    let currentChat;
    if (chatId) {
      currentChat = await Chat.findOne({ _id: chatId, userId: req.user.id });
    } else {
      currentChat = new Chat({ userId: req.user.id });
      await currentChat.save();
    }

    // The final fix: Force a deep clone to a plain JS object
    const clonedHistory = JSON.parse(JSON.stringify(currentChat.history));

    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      history: clonedHistory,
    });

    const result = await chat.sendMessage({ message: prompt });

    // Save the new, clean history
    const simpleHistory = chat.history.map((msg) => ({
      role: msg.role,
      parts: msg.parts.map((part) => ({ text: part.text })),
    }));

    currentChat.history = simpleHistory;
    await currentChat.save();

    const responseData = {
      reply: result.text,
      history: currentChat.history,
      chatId: currentChat._id,
    };

    res.json(responseData);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () =>
  console.log(`Backend running at http://localhost:${port}`)
);
