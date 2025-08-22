import jwt from 'jsonwebtoken'
import { env } from '@/env'
import { logger } from '@/utils/logger'

export interface JWTPayload {
  userId: string
  email: string
  name: string
  iat?: number
  exp?: number
}

export const generateAccessToken = (
  payload: Omit<JWTPayload, 'iat' | 'exp'>
): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '1h',
    issuer: 'chatapp-backend',
    audience: 'chatapp-frontend',
  })
}

export const generateRefreshToken = (userId: string): string => {
  return jwt.sign({ userId }, env.JWT_SECRET, {
    expiresIn: '7d',
    issuer: 'chatapp-backend',
    audience: 'chatapp-frontend',
  })
}

export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      issuer: 'chatapp-backend',
      audience: 'chatapp-frontend',
    }) as JWTPayload

    return decoded
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logger.debug('JWT token expired')
    } else if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Invalid JWT token')
    } else {
      logger.error('JWT verification error:', error)
    }
    return null
  }
}

export const verifyRefreshToken = (
  token: string
): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string }
    return decoded
  } catch (error) {
    logger.debug('Refresh token verification failed:', error)
    return null
  }
}

export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  return authHeader.substring(7) // Remove 'Bearer ' prefix
}
