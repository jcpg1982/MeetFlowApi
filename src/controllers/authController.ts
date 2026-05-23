import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import crypto from 'crypto';
import { io } from '../index';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refreshsecret';

const generateTokens = (userId: string, sessionId: string) => {
  const accessToken = jwt.sign({ userId, sessionId }, JWT_SECRET, { expiresIn: '2h' });
  const refreshToken = jwt.sign({ userId, sessionId }, REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response) => {
  try {
    const { password, name } = req.body;
    const email = req.body.email?.toLowerCase();
    
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const sessionId = crypto.randomUUID();
    
    // Generate a random unique alias
    let alias = `user_${crypto.randomBytes(3).toString('hex')}`;
    let aliasExists = await prisma.user.findUnique({ where: { alias } });
    while (aliasExists) {
      alias = `user_${crypto.randomBytes(3).toString('hex')}`;
      aliasExists = await prisma.user.findUnique({ where: { alias } });
    }

    const user = await prisma.user.create({
      data: {
        email,
        alias,
        password: hashedPassword,
        name,
        sessionId,
      },
    });

    const tokens = generateTokens(user.id, sessionId);
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken }
    });

    res.status(201).json({ 
      token: tokens.accessToken, 
      refreshToken: tokens.refreshToken,
      user: { id: user.id, email: user.email, name: user.name, userName: user.alias } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { password, deviceId, deviceName, forceLogout } = req.body;
    const email = req.body.email?.toLowerCase();
    
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Si ya existe una sesión y no se ha forzado el cierre
    if (user.sessionId && !forceLogout) {
      return res.status(409).json({ 
        message: 'ACTIVE_SESSION_EXISTS',
        deviceName: user.lastDeviceName || 'Otro dispositivo'
      });
    }

    // Notificar al dispositivo anterior si existe una sesión activa y se va a invalidar
    if (user.sessionId) {
      // 1. Vía Socket.io (Tiempo real)
      io.to(user.id).emit('force-logout', { 
        message: 'Sesión iniciada en otro dispositivo',
        deviceName: deviceName || 'Desconocido'
      });

      // 2. Vía FCM (Opcional, si existe token)
      if (user.fcmToken) {
        try {
          const { sendNotification } = require('../utils/notifications');
          await sendNotification(
            user.fcmToken,
            'Nueva sesión iniciada',
            `Se ha iniciado sesión desde un nuevo dispositivo (${deviceName || 'Desconocido'}). La sesión en este dispositivo ha expirado.`,
            { type: 'SESSION_EXPIRED' }
          );
        } catch (error) {
          console.error('Error sending notification:', error);
        }
      }
    }

    const sessionId = crypto.randomUUID();
    const { accessToken, refreshToken } = generateTokens(user.id, sessionId);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken, 
        sessionId,
        lastDeviceId: deviceId || null,
        lastDeviceName: deviceName || null
      }
    });

    res.json({ 
      token: accessToken, 
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, userName: user.alias } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error });
  }
};

export const refresh = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }

    const payload = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as { userId: string, sessionId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });

    if (!user || user.refreshToken !== refreshToken || user.sessionId !== payload.sessionId) {
      return res.status(401).json({ message: 'Invalid refresh token or session expired' });
    }

    const newSessionId = crypto.randomUUID();
    const tokens = generateTokens(user.id, newSessionId);
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken: tokens.refreshToken,
        sessionId: newSessionId
      }
    });

    res.json({ 
      token: tokens.accessToken, 
      refreshToken: tokens.refreshToken 
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid refresh token', error });
  }
};

export const logout = async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    await prisma.user.update({
      where: { id: userId },
      data: { 
        refreshToken: null,
        sessionId: null
      }
    });
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error logging out', error });
  }
};

export const saveSocialUser = async (req: Request, res: Response) => {
  try {
    const { id, email, name, photoUrl, photo, deviceId, deviceName, forceLogout } = req.body;
    
    // El frontend puede enviar email (Firebase normalmente lo tiene para Google/Apple)
    // Si no hay email, usamos un correo ficticio basado en el ID social.
    const safeEmail = (email || `${id}@social.user`).toLowerCase();
    
    let user = await prisma.user.findUnique({ where: { email: safeEmail } });

    if (!user) {
      // REGISTRO DE NUEVO USUARIO SOCIAL
      let alias = `user_${crypto.randomBytes(3).toString('hex')}`;
      let aliasExists = await prisma.user.findUnique({ where: { alias } });
      while (aliasExists) {
        alias = `user_${crypto.randomBytes(3).toString('hex')}`;
        aliasExists = await prisma.user.findUnique({ where: { alias } });
      }

      // No guardamos contraseña porque el acceso es por proveedor social
      user = await prisma.user.create({
        data: {
          email: safeEmail,
          alias,
          password: '', 
          name: name || 'Usuario',
          photo: photo || photoUrl || null,
          sessionId: null, // se actualizará más abajo
        },
      });
    }

    // INICIO DE SESIÓN ÚNICO (Manejo de sesiones activas)
    if (user.sessionId && !forceLogout) {
      return res.status(409).json({ 
        message: 'ACTIVE_SESSION_EXISTS',
        deviceName: user.lastDeviceName || 'Otro dispositivo'
      });
    }

    // Notificar al dispositivo anterior si se va a forzar el cierre
    if (user.sessionId) {
      io.to(user.id).emit('force-logout', { 
        message: 'Sesión iniciada en otro dispositivo por inicio social',
        deviceName: deviceName || 'Desconocido'
      });

      if (user.fcmToken) {
        try {
          const { sendNotification } = require('../utils/notifications');
          await sendNotification(
            user.fcmToken,
            'Nueva sesión iniciada',
            `Se ha iniciado sesión social desde un nuevo dispositivo (${deviceName || 'Desconocido'}).`,
            { type: 'SESSION_EXPIRED' }
          );
        } catch (error) {
          console.error('Error sending social notification:', error);
        }
      }
    }

    // GENERAR TOKENS Y ACTUALIZAR SESIÓN
    const sessionId = crypto.randomUUID();
    const { accessToken, refreshToken } = generateTokens(user.id, sessionId);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { 
        refreshToken, 
        sessionId,
        lastDeviceId: deviceId || null,
        lastDeviceName: deviceName || null,
        // Actualizar foto y nombre si vinieron en la petición y estaban vacíos
        name: user.name === 'Usuario' && name ? name : undefined,
        photo: !user.photo && (photo || photoUrl) ? (photo || photoUrl) : undefined,
      }
    });

    res.json({ 
      token: accessToken, 
      refreshToken,
      user: { id: user.id, email: user.email, name: user.name, userName: user.alias, photo: user.photo } 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error saving social user', error });
  }
};

