import { Server } from 'socket.io';
import { busyUsers, activeCalls } from '../controllers/callController';

const socketToUserMap = new Map<string, string>();
const userToSocketMap = new Map<string, string>();

export const setupSignaling = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId: string) => {
      socket.join(userId);
      socketToUserMap.set(socket.id, userId);
      userToSocketMap.set(userId, socket.id);
      console.log(`User ${userId} joined room ${userId}`);
    });

    socket.on('offer', ({ to, offer }) => {
      socket.to(to).emit('offer', { from: socket.id, offer });
    });

    socket.on('answer', ({ to, answer }) => {
      socket.to(to).emit('answer', { from: socket.id, answer });
    });

    socket.on('ice-candidate', ({ to, candidate }) => {
      socket.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    socket.on('hangup', (data) => {
      try {
        const payload = typeof data === 'string' ? JSON.parse(data) : data;
        const to = payload.to;
        console.log(`Hangup event from socket ${socket.id} to ${to}`);
        
        // Emit call-hungup to the target
        socket.to(to).emit('call-hungup', { from: socket.id });
        
        // Remove both from busyUsers and activeCalls
        const callerId = socketToUserMap.get(socket.id);
        if (callerId) {
          busyUsers.delete(callerId);
          activeCalls.delete(callerId);
        }
        if (to) {
          busyUsers.delete(to);
          activeCalls.delete(to);
        }
      } catch (err) {
        console.error('Error handling hangup event:', err);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('User disconnected:', socket.id, 'Reason:', reason);
      const userId = socketToUserMap.get(socket.id);
      if (userId) {
        busyUsers.delete(userId);
        userToSocketMap.delete(userId);
        socketToUserMap.delete(socket.id);

        // If user was in an active call, notify the other participant
        const peerId = activeCalls.get(userId);
        if (peerId) {
          console.log(`Abrupt disconnect of ${userId}, sending call-hungup to peer ${peerId}`);
          io.to(peerId).emit('call-hungup', { from: socket.id });
          busyUsers.delete(peerId);
          activeCalls.delete(userId);
          activeCalls.delete(peerId);
        }
      }
    });
  });
};
