import { Request, Response } from 'express';
import prisma from '../prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadCloudinary } from '../utils/cloudinary';
import { io } from '../index';
import { sendNotification } from '../utils/notifications';

export const upload = uploadCloudinary;

export const uploadVideo = async (req: any, res: Response) => {
    try {
        const { title, description } = req.body;
        const userId = req.userId;
        if (!req.file) return res.status(400).json({ message: 'Video file is required' });

        const video = await prisma.video.create({
            data: {
                userId,
                videoUrl: req.file.path, // Cloudinary URL
                title: title || '',
                description: description || '',
                thumbnailUrl: '', // Generated on frontend or via ffmpeg later
            }
        });
        res.status(201).json(video);
    } catch (error) {
        res.status(500).json({ message: 'Error uploading video', error });
    }
};

export const getFeedVideos = async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const videos = await prisma.video.findMany({
            skip,
            take: limit,
            include: {
                user: { select: { id: true, name: true, alias: true, photo: true } },
                likes: { where: { userId: userId || '' } },
                favorites: { where: { userId: userId || '' } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Map isFollowing for each user
        const following = userId ? await prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true }
        }) : [];
        const followingIds = new Set(following.map(f => f.followingId));

        const mappedVideos = videos.map(v => ({
            ...v,
            isLiked: v.likes.length > 0,
            isFavorite: v.favorites.length > 0,
            user: {
                ...v.user,
                isFollowing: followingIds.has(v.user.id)
            }
        }));

        res.json(mappedVideos);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching feed', error });
    }
};

export const getUserVideos = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params;
        const videos = await prisma.video.findMany({
            where: { userId: userId as string },
            include: { user: { select: { id: true, name: true, alias: true, photo: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(videos);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching user videos', error });
    }
};

export const toggleLike = async (req: any, res: Response) => {
    try {
        const { videoId } = req.params;
        const userId = req.userId;
        const existing = await prisma.like.findUnique({
            where: { videoId_userId: { videoId, userId } }
        });

        if (existing) {
            await prisma.like.delete({ where: { id: existing.id } });
            // Also remove favorite
            await prisma.favoriteVideo.deleteMany({ where: { videoId, userId } });
            
            const updated = await prisma.video.update({ where: { id: videoId }, data: { likeCount: { decrement: 1 } } });
            io.emit('video_stats_update', { videoId, likeCount: updated.likeCount });
            return res.json({ liked: false });
        } else {
            await prisma.like.create({ data: { videoId, userId } });
            
            // Also add favorite
            const favExists = await prisma.favoriteVideo.findFirst({ where: { videoId, userId } });
            if (!favExists) {
                await prisma.favoriteVideo.create({ data: { videoId, userId } });
            }

            const updated = await prisma.video.update({ where: { id: videoId }, data: { likeCount: { increment: 1 } } });
            io.emit('video_stats_update', { videoId, likeCount: updated.likeCount });

            // Send video liked notification via topic
            try {
                const [liker, video] = await Promise.all([
                    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
                    prisma.video.findUnique({
                        where: { id: videoId },
                        include: { user: { select: { id: true } } }
                    })
                ]);

                if (video?.user && video.user.id !== userId) {
                    await sendNotification(
                        video.user.id,
                        'Me Gusta',
                        `A ${liker?.name || 'Un usuario'} le gustó tu video`,
                        {
                            type: 'VIDEO_LIKE',
                            likerId: userId,
                            likerName: liker?.name || 'Usuario',
                            videoId: videoId
                        }
                    );
                }
            } catch (likeError) {
                console.error('Error sending video like notification:', likeError);
            }

            return res.json({ liked: true });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error toggling like', error });
    }
};

export const toggleFavorite = async (req: any, res: Response) => {
    try {
        const { videoId } = req.params;
        const userId = req.userId;
        const existing = await prisma.favoriteVideo.findUnique({
            where: { videoId_userId: { videoId, userId } }
        });

        if (existing) {
            await prisma.favoriteVideo.delete({ where: { id: existing.id } });
            return res.json({ favorited: false });
        } else {
            await prisma.favoriteVideo.create({ data: { videoId, userId } });
            return res.json({ favorited: true });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error toggling favorite', error });
    }
};

export const getFavoriteVideos = async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const favorites = await prisma.favoriteVideo.findMany({
            where: { userId },
            include: { video: { include: { user: true } } }
        });
        res.json(favorites.map(f => f.video));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching favorites', error });
    }
};

export const trackInteraction = async (req: any, res: Response) => {
    try {
        const { videoId, watchTime, isCompleted } = req.body;
        const userId = req.userId;

        // 1. Check if this user has already interacted with this video in the last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existingInteraction = await prisma.videoInteraction.findFirst({
            where: {
                userId,
                videoId,
                createdAt: {
                    gte: oneDayAgo
                }
            }
        });

        // 2. Create the interaction record in the database for watch time analytics
        await prisma.videoInteraction.create({
            data: { videoId, userId, watchTime, isCompleted }
        });

        let viewCount = undefined;
        if (!existingInteraction) {
            // Only increment global video view count if this is a unique view in a 24h rolling window
            const updated = await prisma.video.update({
                where: { id: videoId },
                data: { viewCount: { increment: 1 } }
            });
            viewCount = updated.viewCount;

            // Broadcast stats update in real-time
            io.emit('video_stats_update', { videoId, viewCount });
        }

        res.json({ success: true, isUniqueView: !existingInteraction, viewCount });
    } catch (error) {
        res.status(500).json({ message: 'Error tracking interaction', error });
    }
};

export const getFollowersFeed = async (req: any, res: Response) => {
    try {
        const userId = req.userId;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const following = await prisma.follow.findMany({ where: { followerId: userId } });
        const followingIds = following.map(f => f.followingId);
        
        const videos = await prisma.video.findMany({
            where: { userId: { in: followingIds } },
            skip,
            take: limit,
            include: { 
                user: { select: { id: true, name: true, alias: true, photo: true } },
                likes: { where: { userId } },
                favorites: { where: { userId } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const mappedVideos = videos.map(v => ({
            ...v,
            isLiked: v.likes.length > 0,
            isFavorite: v.favorites.length > 0,
            user: {
                ...v.user,
                isFollowing: true // By definition in this feed
            }
        }));

        res.json(mappedVideos);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching followers feed', error });
    }
};
