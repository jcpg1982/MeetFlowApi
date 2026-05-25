import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export const authMiddleware = async (req: any, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string, sessionId: string };
    
    // Validar sesión única contra la base de datos
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { sessionId: true }
    });

    if (!user || user.sessionId !== decoded.sessionId) {
      return res.status(401).json({ message: 'Session expired or logged in from another device' });
    }

    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};
