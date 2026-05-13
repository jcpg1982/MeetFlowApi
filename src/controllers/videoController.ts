import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// For You Feed Algorithm
export const getFeedVideos = async (req: Request, res: Response) => {
  try {
    // Basic Algorithm: Popularity (views + likes) + Recent
    const videos = await prisma.video.findMany({
      include: {
        user: { select: { name: true, photo: true } }
      },
      orderBy: [
        { viewCount: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 20
    });

    if (videos.length === 0) {
       return res.json(getMockVideos());
    }

    const formattedVideos = videos.map(v => ({
      id: v.id,
      userId: v.userId,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      title: v.title,
      description: v.description,
      createdAt: v.createdAt.getTime(),
      stats: {
        viewsCount: v.viewCount,
        likesCount: v.likeCount,
        favoritesCount: 0,
        sharesCount: 0,
        averageWatchTime: 0,
        completionRate: 0.0,
        uniqueViewers: 0
      },
      isLiked: false,
      isFavorite: false,
      user: v.user
    }));

    res.json(formattedVideos);
  } catch (error) {
    res.json(getMockVideos());
  }
};

// Followers Feed
export const getFollowersFeed = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      select: { followingId: true }
    });

    const followingIds = following.map(f => f.followingId);

    const videos = await prisma.video.findMany({
      where: { userId: { in: followingIds } },
      include: { user: { select: { name: true, photo: true } } },
      orderBy: { createdAt: 'desc' }
    });

    res.json(videos.map(v => ({
        ...v,
        createdAt: v.createdAt.getTime(),
        stats: { viewsCount: v.viewCount, likesCount: v.likeCount }
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching followers feed' });
  }
};

// Tracking Interaction
export const trackInteraction = async (req: Request, res: Response) => {
  const { videoId, watchTime, isCompleted } = req.body;
  const userId = (req as any).userId;

  try {
    // Check if video exists in DB (mock videos v1, v2 might not exist)
    const video = await prisma.video.findUnique({ where: { id: videoId } });
    
    if (video) {
        await prisma.videoInteraction.create({
          data: {
            videoId,
            userId: userId || null,
            watchTime: watchTime || 0,
            isCompleted: isCompleted || false
          }
        });

        await prisma.video.update({
          where: { id: videoId },
          data: { viewCount: { increment: 1 } }
        });
    } else {
        console.log(`Video ${videoId} not found in DB, skipping tracking.`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking interaction:', error);
    res.status(500).json({ error: 'Error tracking interaction' });
  }
};

export const getUserVideos = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const videos = await prisma.video.findMany({
        where: { userId: userId as string },
        include: { user: { select: { name: true, photo: true } } }
    });
    res.json(videos);
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

function getMockVideos() {
    const now = Date.now();
    return [
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
}
