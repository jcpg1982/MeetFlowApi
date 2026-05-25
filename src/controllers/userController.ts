import { Request, Response } from 'express';
import prisma from '../prisma';
import { sendNotification } from '../utils/notifications';
import { userToSocketMap } from '../utils/signaling';

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
    const requesterId = req.userId;
    const targetId = req.params.id || requesterId;

    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        alias: true,
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

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const videos = await prisma.video.findMany({
      where: { userId: targetId },
      select: { likeCount: true }
    });

    const totalLikes = videos.reduce((sum, v) => sum + (v.likeCount || 0), 0);

    let isFollowing = false;
    if (requesterId !== targetId) {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId: requesterId, followingId: targetId }
        }
      });
      isFollowing = !!follow;
    }

    const isOnline = userToSocketMap.has(targetId);

    // Send profile visit notification via topic
    if (requesterId && targetId !== requesterId) {
      try {
        const visitor = await prisma.user.findUnique({
          where: { id: requesterId },
          select: { name: true }
        });
        if (visitor) {
          await sendNotification(
            targetId,
            'Visita de Perfil',
            `${visitor.name} ha visitado tu perfil`,
            {
              type: 'PROFILE_VISIT',
              visitorId: requesterId,
              visitorName: visitor.name
            }
          );
        }
      } catch (visitError) {
        console.error('Error sending profile visit notification:', visitError);
      }
    }

    const { alias, ...userResponseData } = user;

    res.json({
      ...userResponseData,
      uuid: user.id, // Ensure uuid mapping for KMP
      userName: alias || "",
      followersCount: user?._count.followers || 0,
      followingCount: user?._count.following || 0,
      likesCount: totalLikes,
      isFollowing: isFollowing,
      isOnline: isOnline
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

      // Send contact added notification via topic
      try {
        const follower = await prisma.user.findUnique({ where: { id: followerId }, select: { name: true } });

        await sendNotification(
          followingId,
          'Nuevo Contacto',
          `${follower?.name || 'Un usuario'} te ha agregado como contacto`,
          {
            type: 'CONTACT_ADDED',
            followerId: followerId,
            followerName: follower?.name || 'Usuario'
          }
        );
      } catch (followError) {
        console.error('Error sending contact notification:', followError);
      }

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
          select: { id: true, name: true, photo: true, bio: true, callPrice: true, email: true, alias: true } 
        } 
      }
    });
    res.json(followers.map(f => ({
      ...f.follower,
      userName: f.follower.alias || ""
    })));
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
          select: { id: true, name: true, photo: true, bio: true, callPrice: true, email: true, alias: true } 
        } 
      }
    });
    res.json(following.map(f => ({
      ...f.following,
      userName: f.following.alias || ""
    })));
  } catch (error) {
    res.status(500).json({ error: 'Error fetching following' });
  }
};

export const logout = async (req: any, res: Response) => {
  const userId = req.userId;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { fcmToken: null }
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error logging out' });
  }
};
