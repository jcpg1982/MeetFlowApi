import { Response } from 'express';
import prisma from '../prisma';
import { io } from '../index';
import { sendNotification } from '../utils/notifications';

export const getMessages = async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const { otherUserId } = req.params;

        if (!otherUserId) {
            return res.status(400).json({ message: 'otherUserId is required' });
        }

        // Mark messages from otherUserId to userId as READ
        await prisma.message.updateMany({
            where: {
                senderId: otherUserId,
                receiverId: userId,
                status: { not: 'READ' }
            },
            data: {
                status: 'READ'
            }
        });

        // Notify other user that their messages were read
        io.to(otherUserId).emit('messages_read', { readerId: userId });

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId }
                ]
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages', error });
    }
};

export const sendMessage = async (req: any, res: Response) => {
    try {
        const senderId = req.userId;
        const { receiverId, type, content, mediaUrl, durationSeconds } = req.body;

        if (!receiverId || !type) {
            return res.status(400).json({ message: 'receiverId and type are required' });
        }

        if (senderId === receiverId) {
            return res.status(400).json({ message: 'Cannot message yourself' });
        }

        const message = await prisma.message.create({
            data: {
                senderId,
                receiverId,
                type, // TEXT, PHOTO, VIDEO, AUDIO
                content: content || null,
                mediaUrl: mediaUrl || null,
                durationSeconds: durationSeconds ? parseInt(durationSeconds) : null
            }
        });

        // Emit via Socket.io to sender and receiver rooms
        io.to(senderId).emit('message_received', message);
        io.to(receiverId).emit('message_received', message);

        // Send FCM notification to receiver
        try {
            const sender = await prisma.user.findUnique({ where: { id: senderId }, select: { name: true } });
            const senderName = sender?.name || 'Usuario';
            let notificationBody = '';
            switch (type) {
                case 'TEXT':
                    notificationBody = content || '';
                    break;
                case 'PHOTO':
                    notificationBody = '📷 Foto';
                    break;
                case 'VIDEO':
                    notificationBody = '🎥 Video';
                    break;
                case 'AUDIO':
                    notificationBody = '🎵 Nota de voz';
                    break;
                default:
                    notificationBody = 'Nuevo mensaje';
            }

            await sendNotification(
                receiverId,
                senderName,
                notificationBody,
                {
                    type: 'CHAT_MESSAGE',
                    senderId: senderId,
                    senderName: senderName,
                    messageId: message.id
                }
            );
        } catch (fcmError) {
            console.error('Error sending message FCM notification:', fcmError);
        }

        res.status(201).json(message);
    } catch (error) {
        res.status(500).json({ message: 'Error sending message', error });
    }
};

export const getConversations = async (req: any, res: Response) => {
    try {
        const userId = req.userId;

        // Query all messages sent or received by userId
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId },
                    { receiverId: userId }
                ]
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        const conversationsMap = new Map<string, any>();
        
        // Dynamic import to avoid circular dependencies
        const { userToSocketMap } = require('../utils/signaling');

        for (const msg of messages) {
            const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
            if (partnerId === userId) continue; // Skip self messages

            if (!conversationsMap.has(partnerId)) {
                const partner = await prisma.user.findUnique({
                    where: { id: partnerId },
                    select: {
                        id: true,
                        name: true,
                        alias: true,
                        photo: true,
                        email: true,
                        bio: true,
                        callPrice: true,
                        rating: true,
                        totalCalls: true,
                        totalEarnings: true,
                        followersCount: true,
                        followingCount: true,
                        likesCount: true
                    }
                });

                if (partner) {
                    // Count unread messages (status !== 'READ' and sender is the partner)
                    const unreadCount = await prisma.message.count({
                        where: {
                            senderId: partnerId,
                            receiverId: userId,
                            status: { not: 'READ' }
                        }
                    });

                    // Determine isOnline
                    const isOnline = userToSocketMap.has(partnerId);

                    conversationsMap.set(partnerId, {
                        user: {
                            id: partner.id,
                            name: partner.name,
                            userName: partner.alias,
                            photo: partner.photo,
                            email: partner.email,
                            bio: partner.bio,
                            callPrice: partner.callPrice,
                            rating: partner.rating,
                            totalCalls: partner.totalCalls,
                            totalEarnings: partner.totalEarnings,
                            followersCount: partner.followersCount,
                            followingCount: partner.followingCount,
                            likesCount: partner.likesCount,
                            isOnline
                        },
                        lastMessage: msg,
                        unreadCount
                    });
                }
            }
        }

        res.json(Array.from(conversationsMap.values()));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching conversations', error });
    }
};

export const uploadChatFile = async (req: any, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        res.json({
            url: req.file.path,
            format: req.file.mimetype || req.file.format,
            bytes: req.file.size
        });
    } catch (error) {
        res.status(500).json({ message: 'Error uploading file', error });
    }
};
