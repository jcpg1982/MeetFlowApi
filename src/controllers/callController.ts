import { Request, Response } from 'express';
import prisma from '../prisma';
import { sendNotification } from '../utils/notifications';
import { io } from '../index';

// Keep track of busy users in an in-memory set
export const busyUsers = new Set<string>();
// Keep track of active calls (userId -> peerUserId)
export const activeCalls = new Map<string, string>();

export const checkUserStatus = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        if (typeof userId !== 'string') {
            return res.status(400).json({ message: 'Invalid userId' });
        }
        const isBusy = busyUsers.has(userId);
        res.status(200).json({ userId, isBusy });
    } catch (error) {
        res.status(500).json({ message: 'Error checking user status', error });
    }
};

export const initiateCall = async (req: any, res: Response) => {
    try {
        const callerId = req.userId;
        const { receiverId, isVideoCall = true } = req.body;

        if (!receiverId) {
            return res.status(400).json({ message: 'Receiver ID is required' });
        }

        if (callerId === receiverId) {
            return res.status(400).json({ message: 'Cannot call yourself' });
        }

        if (busyUsers.has(receiverId)) {
            return res.status(400).json({ message: 'USER_BUSY' });
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
            
            // Mark both users as busy
            busyUsers.add(callerId);
            busyUsers.add(receiverId);
            activeCalls.set(callerId, receiverId);
            activeCalls.set(receiverId, callerId);

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
                                alert: {
                                    title: "Llamada entrante",
                                    body: `${caller.name} te está llamando`
                                },
                                sound: 'default',
                                'content-available': 1
                            }
                        },
                        headers: {
                            'apns-priority': '10',
                            'apns-push-type': 'alert'
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

        if (status === 'rejected') {
            busyUsers.delete(callerId);
            busyUsers.delete(responderId);
            activeCalls.delete(callerId);
            activeCalls.delete(responderId);
        }

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
            try {
                await admin.messaging().send(message);
            } catch (err) {
                console.error('Error sending FCM CALL_RESPONSE:', err);
            }
        }

        res.status(200).json({ message: `Call ${status}` });
    } catch (error) {
        res.status(500).json({ message: 'Error responding to call', error });
    }
};

export const logCall = async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const { receiverId, status, isIncoming, durationSeconds } = req.body;

        if (!receiverId || !status) {
            return res.status(400).json({ message: 'Receiver ID and status are required' });
        }

        // Properly map callerId and receiverId based on who initiated the call.
        // If isIncoming is true, the user logging this is the receiver, meaning the remote receiverId is the caller.
        // If isIncoming is false, the user logging this is the caller, meaning the remote receiverId is the receiver.
        const dbCallerId = isIncoming === true ? receiverId : userId;
        const dbReceiverId = isIncoming === true ? userId : receiverId;

        const log = await prisma.callLog.create({
            data: {
                callerId: dbCallerId,
                receiverId: dbReceiverId,
                status: status,
                isIncoming: isIncoming === true,
                durationSeconds: durationSeconds ? parseInt(durationSeconds) : 0
            }
        });

        res.status(200).json(log);
    } catch (error) {
        console.error('Error logging call:', error);
        res.status(500).json({ message: 'Error logging call', error });
    }
};

export const getCalls = async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const logs = await prisma.callLog.findMany({
            where: {
                OR: [
                    { callerId: userId, isIncoming: false },
                    { receiverId: userId, isIncoming: true }
                ]
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // Fetch remote user details for each log to display in the call history
        const remoteUserIds = Array.from(new Set(logs.map(log => 
            log.callerId === userId ? log.receiverId : log.callerId
        )));
        
        const remoteUsers = await prisma.user.findMany({
            where: {
                id: { in: remoteUserIds }
            },
            select: {
                id: true,
                name: true,
                photo: true
            }
        });
        
        const remoteUserMap = new Map(remoteUsers.map(u => [u.id, u]));

        // Compute isIncoming dynamically from the user's perspective and attach remote user info
        const mappedLogs = logs.map(log => {
            const remoteId = log.callerId === userId ? log.receiverId : log.callerId;
            const remoteUser = remoteUserMap.get(remoteId);
            return {
                ...log,
                isIncoming: log.receiverId === userId,
                remoteUserName: remoteUser ? remoteUser.name : null,
                remoteUserPhoto: remoteUser ? remoteUser.photo : null
            };
        });

        res.status(200).json(mappedLogs);
    } catch (error) {
        console.error('Error fetching call logs:', error);
        res.status(500).json({ message: 'Error fetching call logs', error });
    }
};
