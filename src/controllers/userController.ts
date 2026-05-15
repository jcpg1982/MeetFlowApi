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
    const userId = req.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        photo: true, 
        bio: true, 
        callPrice: true,
        _count: {
          select: {
            followers: true,
            following: true
          }
        }
      }
    });

    const videos = await prisma.video.findMany({
      where: { userId },
      select: { likeCount: true }
    });

    const totalLikes = videos.reduce((sum, v) => sum + (v.likeCount || 0), 0);

    res.json({
      ...user,
      followersCount: user?._count.followers || 0,
      followingCount: user?._count.following || 0,
      likesCount: totalLikes
    });
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
export const followUser = async (req: any, res: Response) => {
  const { followingId } = req.body;
  const followerId = req.userId;

  if (followerId === followingId) {
    return res.status(400).json({ error: 'Cannot follow yourself' });
  }

  try {
    const existingFollow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: { followerId, followingId }
      }
    });

    if (existingFollow) {
      await prisma.follow.delete({
        where: {
          followerId_followingId: { followerId, followingId }
        }
      });
      res.json({ isFollowing: false });
    } else {
      await prisma.follow.create({
        data: { followerId, followingId }
      });
      res.json({ isFollowing: true });
    }
  } catch (error) {
    res.status(500).json({ error: 'Error following user' });
  }
};

export const getFollowers = async (req: any, res: Response) => {
  const userId = req.userId;
  try {
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: { 
        follower: { 
          select: { id: true, name: true, photo: true, bio: true, callPrice: true } 
        } 
      }
    });
    res.json(followers.map(f => f.follower));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching followers' });
  }
};

export const getFollowing = async (req: any, res: Response) => {
  const userId = req.userId;
  try {
    const following = await prisma.follow.findMany({
      where: { followerId: userId },
      include: { 
        following: { 
          select: { id: true, name: true, photo: true, bio: true, callPrice: true } 
        } 
      }
    });
    res.json(following.map(f => f.following));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching following' });
  }
};
