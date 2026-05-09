import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, photo: true, bio: true, callPrice: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error });
  }
};

export const getProfile = async (req: any, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, photo: true, bio: true, callPrice: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile', error });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  try {
    const { name, bio, callPrice, photo } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { name, bio, callPrice, photo }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile', error });
  }
};

export const uploadMedia = async (req: any, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.json({ url: req.file.path });
  } catch (error) {
    res.status(500).json({ message: 'Error uploading media', error });
  }
};
export const updateFcmToken = async (req: any, res: Response) => {
  const { fcmToken } = req.body;
  const userId = req.userId;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken }
    });
    res.json({ message: 'FCM Token updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error updating FCM Token' });
  }
};
