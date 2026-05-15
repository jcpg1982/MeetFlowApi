import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// For You Feed Algorithm
export const getFeedVideos = async (req: Request, res: Response) => {
  const userId = (req as any).userId;

  try {
    const videos = await prisma.video.findMany({
      include: {
        user: { 
          select: { 
            id: true,
            name: true, 
            photo: true,
            callPrice: true,
            followers: userId ? { where: { followerId: userId } } : false
          } 
        },
        likes: userId ? { where: { userId } } : false,
        favorites: userId ? { where: { userId } } : false
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
        favoritesCount: 0, // Could count v.favorites if I included it differently
        sharesCount: 0,
        averageWatchTime: 0,
        completionRate: 0.0,
        uniqueViewers: 0
      },
      isLiked: (v.likes as any)?.length > 0,
      isFavorite: (v.favorites as any)?.length > 0,
      isContact: (v.user as any)?.followers?.length > 0,
      user: {
        name: v.user.name,
        photo: v.user.photo,
        callPrice: v.user.callPrice
      }
    }));

    res.json(formattedVideos);
  } catch (error) {
    console.error('Error fetching feed:', error);
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
  const userId = req.params.userId || (req as any).userId;
  try {
    const videos = await prisma.video.findMany({
        where: { userId },
        include: { user: { select: { name: true, photo: true, callPrice: true } } },
        orderBy: { createdAt: 'desc' }
    });
    res.json(videos.map(v => ({
      id: v.id,
      userId: v.userId,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      title: v.title,
      description: v.description,
      createdAt: v.createdAt.getTime(),
      stats: { viewsCount: v.viewCount, likesCount: v.likeCount },
      user: v.user
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching user videos' });
  }
};

export const getFavoriteVideos = async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const favorites = await prisma.favoriteVideo.findMany({
      where: { userId },
      include: {
        video: {
          include: { user: { select: { name: true, photo: true, callPrice: true } } }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(favorites.map(f => ({
      id: f.video.id,
      userId: f.video.userId,
      videoUrl: f.video.videoUrl,
      thumbnailUrl: f.video.thumbnailUrl,
      title: f.video.title,
      description: f.video.description,
      createdAt: f.video.createdAt.getTime(),
      stats: { viewsCount: f.video.viewCount, likesCount: f.video.likeCount },
      user: f.video.user
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching favorite videos' });
  }
};

export const uploadVideo = async (req: Request, res: Response) => {
  res.json({ success: true });
};

export const toggleLike = async (req: Request, res: Response) => {
  const videoId = req.params.videoId as string;
  const userId = (req as any).userId as string;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existingLike = await prisma.like.findUnique({
      where: { videoId_userId: { videoId, userId } }
    });

    if (existingLike) {
      await prisma.like.delete({
        where: { id: existingLike.id }
      });
      await prisma.video.update({
        where: { id: videoId },
        data: { likeCount: { decrement: 1 } }
      });
      res.json({ isLiked: false });
    } else {
      await prisma.like.create({
        data: { videoId, userId }
      });
      await prisma.video.update({
        where: { id: videoId },
        data: { likeCount: { increment: 1 } }
      });
      res.json({ isLiked: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error toggling like' });
  }
};

export const toggleFavorite = async (req: Request, res: Response) => {
  const videoId = req.params.videoId as string;
  const userId = (req as any).userId as string;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const existingFavorite = await prisma.favoriteVideo.findUnique({
      where: { videoId_userId: { videoId, userId } }
    });

    if (existingFavorite) {
      await prisma.favoriteVideo.delete({
        where: { id: existingFavorite.id }
      });
      res.json({ isFavorite: false });
    } else {
      await prisma.favoriteVideo.create({
        data: { videoId, userId }
      });
      res.json({ isFavorite: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error toggling favorite' });
  }
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
