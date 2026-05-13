import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getFeedVideos = async (req: Request, res: Response) => {
  try {
    const now = Date.now();
    const videos = [
      {
        id: 'v1',
        userId: 'u1',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnailUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        title: 'Welcome to MeetFlow',
        description: 'Learn how to use the app',
        createdAt: now - 1000000,
        stats: {
          viewsCount: 1200,
          likesCount: 450,
          favoritesCount: 100,
          sharesCount: 50,
          averageWatchTime: 15000,
          completionRate: 0.85,
          uniqueViewers: 1000
        },
        isLiked: false,
        isFavorite: false,
        user: { name: 'Admin', photo: null }
      },
      {
        id: 'v2',
        userId: 'u2',
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnailUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
        title: 'Expert Session',
        description: 'Talking about tech',
        createdAt: now - 2000000,
        stats: {
          viewsCount: 800,
          likesCount: 200,
          favoritesCount: 50,
          sharesCount: 20,
          averageWatchTime: 10000,
          completionRate: 0.65,
          uniqueViewers: 700
        },
        isLiked: false,
        isFavorite: false,
        user: { name: 'Juan Perez', photo: null }
      }
    ];
    res.json(videos);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching feed' });
  }
};

export const getUserVideos = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    res.json([]);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user videos' });
  }
};

export const uploadVideo = async (req: Request, res: Response) => {
  res.json({ success: true });
};

export const toggleLike = async (req: Request, res: Response) => {
  res.json({ success: true });
};

export const toggleFavorite = async (req: Request, res: Response) => {
  res.json({ success: true });
};
