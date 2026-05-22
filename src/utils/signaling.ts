import { Server } from 'socket.io';
import { busyUsers, activeCalls } from '../controllers/callController';
import prisma from '../prisma';

export const socketToUserMap = new Map<string, string>();
export const userToSocketMap = new Map<string, string>();

export const setupSignaling = (io: Server) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', async (userId: string) => {
      socket.join(userId);
      socketToUserMap.set(socket.id, userId);
      userToSocketMap.set(userId, socket.id);
      console.log(`User ${userId} joined room ${userId}`);
      io.emit('presence_changed', { userId, status: 'online' });

      // Mark all SENT messages addressed to this user as DELIVERED
      // and notify the senders so their UI shows double gray check
      try {
        const sentMessages = await prisma.message.findMany({
          where: { receiverId: userId, status: 'SENT' },
          select: { id: true, senderId: true }
        });

        if (sentMessages.length > 0) {
          await prisma.message.updateMany({
            where: { receiverId: userId, status: 'SENT' },
            data: { status: 'DELIVERED' }
          });

          // Group by sender and notify each sender
          const senderGroups = new Map<string, string[]>();
          for (const msg of sentMessages) {
            const ids = senderGroups.get(msg.senderId) || [];
            ids.push(msg.id);
            senderGroups.set(msg.senderId, ids);
          }
          for (const [senderId, messageIds] of senderGroups) {
            io.to(senderId).emit('messages_delivered', { messageIds, status: 'DELIVERED' });
          }
        }
      } catch (err) {
        console.error('Error marking messages as DELIVERED on join:', err);
      }
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
        socketToUserMap.delete(socket.id);
        
        // Only delete from userToSocketMap if it still points to the disconnected socket.id
        if (userToSocketMap.get(userId) === socket.id) {
          userToSocketMap.delete(userId);
          io.emit('presence_changed', { userId, status: 'offline' });
        }

        // If user was in an active call, notify the other participant after a grace period
        const peerId = activeCalls.get(userId);
        if (peerId) {
          console.log(`Abrupt disconnect of ${userId}. Starting 10s grace period...`);
          setTimeout(() => {
            // Check if the user has reconnected (which updates userToSocketMap)
            const currentSocketId = userToSocketMap.get(userId);
            if (!currentSocketId) {
              console.log(`User ${userId} did not reconnect within grace period. Terminating call...`);
              io.to(peerId).emit('call-hungup', { from: socket.id });
              busyUsers.delete(userId);
              busyUsers.delete(peerId);
              activeCalls.delete(userId);
              activeCalls.delete(peerId);
            } else {
              console.log(`User ${userId} reconnected (new socket: ${currentSocketId}). Keeping call active.`);
            }
          }, 10000); // 10 seconds grace period
        } else {
          // If not in a call, we can clean up busyUsers immediately
          busyUsers.delete(userId);
        }
      }
    });
  });
};
