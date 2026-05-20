import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import videoRoutes from './routes/videoRoutes';
import requestRoutes from './routes/requestRoutes';
import callRoutes from './routes/callRoutes';
import { setupSignaling } from './utils/signaling';

const app = express();
const server = http.createServer(app);
export const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/calls', callRoutes);

// Web Pages (SPA Routing)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Setup Signaling
setupSignaling(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  
  // Keep-alive self-pinging to prevent Render free tier from sleeping
  const SELF_URL = process.env.SELF_URL || 'https://meetflowapi.onrender.com';
  setInterval(() => {
    const url = `${SELF_URL}/api/auth/health`;
    console.log(`[Keep-Alive] Pinging self at ${url}...`);
    const httpModule = url.startsWith('https') ? require('https') : require('http');
    httpModule.get(url, (res: any) => {
      console.log(`[Keep-Alive] Ping response status: ${res.statusCode}`);
    }).on('error', (err: any) => {
      console.error(`[Keep-Alive] Ping failed:`, err.message);
    });
  }, 10 * 60 * 1000); // every 10 minutes
});
