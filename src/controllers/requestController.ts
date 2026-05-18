import { Request, Response } from 'express';
import prisma from '../prisma';
import { sendNotification } from '../utils/notifications';

export const createRequest = async (req: any, res: Response) => {
  try {
    const { receiverId, price, scheduledAt } = req.body;
    const request = await prisma.meetingRequest.create({
      data: {
        senderId: req.userId,
        receiverId,
        price,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
      include: {
        sender: { select: { name: true } },
        receiver: { select: { fcmToken: true } }
      }
    });

    // Send Notification
    if (request.receiver.fcmToken) {
      await sendNotification(
        request.receiver.fcmToken,
        'New Meeting Request',
        `${request.sender.name} wants to connect with you!`,
        { requestId: request.id }
      );
    }

    res.status(201).json(request);
  } catch (error) {
    res.status(500).json({ message: 'Error creating request', error });
  }
};

export const getMyRequests = async (req: any, res: Response) => {
  try {
    const sent = await prisma.meetingRequest.findMany({
      where: { senderId: req.userId },
      include: { receiver: { select: { name: true, photo: true } } }
    });
    const received = await prisma.meetingRequest.findMany({
      where: { receiverId: req.userId },
      include: { sender: { select: { name: true, photo: true } } }
    });
    res.json({ sent, received });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests', error });
  }
};

export const updateRequestStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // ACCEPTED, DECLINED, COMPLETED
    const request = await prisma.meetingRequest.update({
      where: { id },
      data: { status }
    });
    res.json(request);
  } catch (error) {
    res.status(500).json({ message: 'Error updating request', error });
  }
};
