import 'dotenv/config';
import dns from 'node:dns';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from './models/User.js';

// Some internet connections block the Atlas "mongodb+srv" lookup, so use public DNS.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const SECRET = process.env.JWT_SECRET || 'dev_secret';
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true }));
app.use(express.json());

const safe = (u) => ({ id: u._id, name: u.name, email: u.email, progress: u.progress });
const sign = (u) => jwt.sign({ id: String(u._id) }, SECRET, { expiresIn: '7d' });

// Reads the Bearer token and loads the user from MongoDB.
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { id } = jwt.verify(token, SECRET);
    const user = await User.findById(id);
    if (!user) throw new Error('no user');
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Please log in again' });
  }
};

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password || password.length < 6)
      return res.status(400).json({ error: 'Name, email and a 6+ character password are required' });
    const key = String(email).toLowerCase().trim();
    if (await User.findOne({ email: key }))
      return res.status(409).json({ error: 'This email is already registered' });
    const user = await User.create({ name, email: key, hash: await bcrypt.hash(password, 10) });
    res.status(201).json({ token: sign(user), user: safe(user) });
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: 'This email is already registered' });
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: String(email || '').toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password || '', user.hash)))
      return res.status(401).json({ error: 'Incorrect email or password' });
    res.json({ token: sign(user), user: safe(user) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

app.get('/api/me', auth, (req, res) => res.json({ user: safe(req.user) }));

// The app sends its whole progress object after every lesson/game.
app.post('/api/progress', auth, async (req, res) => {
  try {
    const { xp, streak, done, last } = req.body || {};
    req.user.progress = {
      xp: Math.max(0, +xp || 0),
      streak: Math.max(1, +streak || 1),
      done: Array.isArray(done) ? done.map(String) : [],
      last: typeof last === 'string' ? last : new Date().toDateString(),
    };
    await req.user.save();
    res.json({ progress: req.user.progress });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

const port = process.env.PORT || 5000;
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set in server/.env');
await mongoose.connect(process.env.MONGO_URI);
console.log('MongoDB connected:', mongoose.connection.name);
app.listen(port, () => console.log(`API running on http://localhost:${port}`));
