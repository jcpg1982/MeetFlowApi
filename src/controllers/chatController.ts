import { Response } from 'express';
import prisma from '../prisma';
import { io } from '../index';
import { sendNotification } from '../utils/notifications';

import { userToSocketMap } from '../utils/signaling';

export const getMessages = async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const { otherUserId } = req.params;

        if (!otherUserId) {
            return res.status(400).json({ message: 'otherUserId is required' });
        }

        // Only mark as READ if there are actually unread messages (avoids false 'read' signal)
        const unreadCount = await prisma.message.count({
            where: {
                senderId: otherUserId,
                receiverId: userId,
                status: { not: 'READ' }
            }
        });

        if (unreadCount > 0) {
            await prisma.message.updateMany({
                where: {
                    senderId: otherUserId,
                    receiverId: userId,
                    status: { not: 'READ' }
                },
                data: { status: 'READ' }
            });

            // Notify the sender that their messages were read
            io.to(otherUserId).emit('messages_read', { readerId: userId });
        }

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { senderId: userId, receiverId: otherUserId },
                    { senderId: otherUserId, receiverId: userId }
                ]
            },
            orderBy: { createdAt: 'asc' }
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

        // Determine initial status: DELIVERED if receiver is online, otherwise SENT
        const isReceiverOnline = userToSocketMap.has(receiverId);
        const initialStatus = isReceiverOnline ? 'DELIVERED' : 'SENT';

        const message = await prisma.message.create({
            data: {
                senderId,
                receiverId,
                type, // TEXT, PHOTO, VIDEO, AUDIO
                content: content || null,
                mediaUrl: mediaUrl || null,
                durationSeconds: durationSeconds ? parseInt(durationSeconds) : null,
                status: initialStatus
            }
        });

        // Always notify the receiver with the new message
        io.to(receiverId).emit('message_received', message);

        if (isReceiverOnline) {
            // Notify sender that message was delivered (double gray check)
            io.to(senderId).emit('message_delivered', { messageId: message.id, status: 'DELIVERED' });
        } else {
            // Emit to sender room so sender sees the message in their own chat view
            io.to(senderId).emit('message_received', message);
        }

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

        // Get unique partner IDs from all messages
        const sentMessages = await prisma.message.findMany({
            where: { senderId: userId },
            select: { receiverId: true },
            distinct: ['receiverId']
        });
        const receivedMessages = await prisma.message.findMany({
            where: { receiverId: userId },
            select: { senderId: true },
            distinct: ['senderId']
        });

        const partnerIds = new Set<string>([
            ...sentMessages.map(m => m.receiverId),
            ...receivedMessages.map(m => m.senderId)
        ]);
        partnerIds.delete(userId); // remove self

        const { userToSocketMap } = require('../utils/signaling');

        const conversations = await Promise.all(
            Array.from(partnerIds).map(async (partnerId) => {
                const [partner, lastMessageArr, unreadCount] = await Promise.all([
                    prisma.user.findUnique({
                        where: { id: partnerId },
                        select: { id: true, name: true, alias: true, photo: true, email: true, bio: true, callPrice: true }
                    }),
                    prisma.message.findMany({
                        where: {
                            OR: [
                                { senderId: userId, receiverId: partnerId },
                                { senderId: partnerId, receiverId: userId }
                            ]
                        },
                        orderBy: { createdAt: 'desc' },
                        take: 1
                    }),
                    prisma.message.count({
                        where: {
                            senderId: partnerId,
                            receiverId: userId,
                            status: { not: 'READ' }
                        }
                    })
                ]);

                if (!partner) return null;

                const lastMessage = lastMessageArr[0] || null;
                const isOnline = userToSocketMap.has(partnerId);

                return {
                    user: {
                        id: partner.id,
                        name: partner.name,
                        userName: partner.alias,
                        photo: partner.photo,
                        email: partner.email,
                        bio: partner.bio,
                        callPrice: partner.callPrice,
                        rating: 0,
                        totalCalls: 0,
                        totalEarnings: 0,
                        followersCount: 0,
                        followingCount: 0,
                        likesCount: 0,
                        isOnline
                    },
                    lastMessage,
                    unreadCount
                };
            })
        );

        // Sort by lastMessage createdAt desc, filter nulls
        const sorted = conversations
            .filter(c => c !== null)
            .sort((a, b) => {
                const aTime = a!.lastMessage?.createdAt ? new Date(a!.lastMessage.createdAt).getTime() : 0;
                const bTime = b!.lastMessage?.createdAt ? new Date(b!.lastMessage.createdAt).getTime() : 0;
                return bTime - aTime;
            });

        res.json(sorted);
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
