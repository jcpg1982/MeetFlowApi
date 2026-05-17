import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { sendNotification } from '../utils/notifications';
import { io } from '../index';

const prisma = new PrismaClient();

export const initiateCall = async (req: any, res: Response) => {
    try {
        const callerId = req.userId;
        const { receiverId, isVideoCall = true } = req.body;

        if (!receiverId) {
            return res.status(400).json({ message: 'Receiver ID is required' });
        }

        const caller = await prisma.user.findUnique({ where: { id: callerId } });
        const receiver = await prisma.user.findUnique({ where: { id: receiverId } });

        if (!caller || !receiver) {
            return res.status(404).json({ message: 'User not found' });
        }

        const roomId = `room_${caller.id}_${receiver.id}_${Date.now()}`;

        // Check if receiver is online via sockets
        const socketsInRoom = io.sockets.adapter.rooms.get(receiverId);
        const isReceiverOnline = socketsInRoom !== undefined && socketsInRoom.size > 0;

        if (receiver.fcmToken || isReceiverOnline || receiver.name === 'Test' || process.env.NODE_ENV !== 'production') {
            // Emit socket event for real-time instantaneous delivery
            io.to(receiverId).emit('incoming-call', {
                callerId: caller.id,
                callerName: caller.name,
                callerPhoto: caller.photo || '',
                isVideoCall: isVideoCall,
                roomId: roomId
            });

            if (receiver.fcmToken) {
                const message = {
                    token: receiver.fcmToken,
                    data: {
                        type: 'INCOMING_CALL',
                        callerId: caller.id,
                        callerName: caller.name,
                        callerPhoto: caller.photo || '',
                        isVideoCall: isVideoCall.toString(),
                        roomId: roomId
                    },
                    android: {
                        priority: 'high' as const
                    },
                    apns: {
                        payload: {
                            aps: {
                                'content-available': 1
                            }
                        }
                    }
                };

                const admin = require('firebase-admin');
                try {
                    await admin.messaging().send(message);
                } catch (err) {
                    console.error('Error sending FCM:', err);
                }
            }

            // SIMULATE AUTOMATIC ACCEPTANCE FOR THE 'Test' MOCK USER AFTER 3 SECONDS
            if (receiver.name === 'Test' && !isReceiverOnline) {
                console.log(`[SIMULATOR] Simulating auto-acceptance for Test user in 3 seconds to caller ${callerId}...`);
                setTimeout(() => {
                    io.to(callerId).emit('call-responded', {
                        responderId: receiver.id,
                        status: 'accepted'
                    });
                    console.log(`[SIMULATOR] Auto-acceptance emitted to caller ${callerId}!`);
                }, 3000);
            }

            res.status(200).json({ message: 'Call initiated', roomId: roomId });
        } else {
            // Receiver is offline on sockets AND doesn't have an FCM token
            res.status(404).json({ message: 'Receiver is offline or cannot receive calls' });
        }
    } catch (error) {
        console.error('Error initiating call:', error);
        res.status(500).json({ message: 'Error initiating call', error });
    }
};

export const respondToCall = async (req: any, res: Response) => {
    try {
        const responderId = req.userId;
        const { callerId, status } = req.body; // status: 'accepted' | 'rejected'

        const caller = await prisma.user.findUnique({ where: { id: callerId } });
        if (!caller) return res.status(404).json({ message: 'Caller not found' });

        // Emit socket event for real-time instantaneous delivery
        io.to(callerId).emit('call-responded', {
            responderId: responderId,
            status: status
        });

        if (caller.fcmToken) {
            const message = {
                token: caller.fcmToken,
                data: {
                    type: 'CALL_RESPONSE',
                    responderId: responderId,
                    status: status
                },
                android: { priority: 'high' as const }
            };
            const admin = require('firebase-admin');
            await admin.messaging().send(message);
        }

        res.status(200).json({ message: `Call ${status}` });
    } catch (error) {
        res.status(500).json({ message: 'Error responding to call', error });
    }
};
