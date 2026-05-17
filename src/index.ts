import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import videoRoutes from './routes/videoRoutes';
import requestRoutes from './routes/requestRoutes';
import callRoutes from './routes/callRoutes';
import { setupSignaling } from './utils/signaling';

dotenv.config();

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/calls', callRoutes);

app.get('/', (req, res) => {
  res.send('MeetFlow API with Signaling is running...');
});

// Setup Signaling
setupSignaling(io);

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
