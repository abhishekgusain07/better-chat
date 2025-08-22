import { Request, Response, NextFunction } from 'express'
import { auth, AuthUser, AuthSession } from '@/auth'
import { verifyAccessToken, extractTokenFromHeader } from '@/auth/jwt'
import { logger } from '@/utils/logger'

// Extend Express Request interface to include user and session
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      session?: AuthSession
    }
  }
}

// Middleware to authenticate requests using better-auth
export const authenticateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await auth.api.getSession({
      headers: req.headers as any,
    })

    if (session?.user) {
      req.user = session.user as AuthUser
      req.session = session.session as AuthSession
      logger.debug(`Session authenticated for user: ${session.user.email}`)
    }

    next()
  } catch (error) {
    logger.debug('Session authentication failed:', error)
    next()
  }
}

// Middleware to require authentication
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user || !req.session) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
      code: 'AUTH_REQUIRED',
    })
    return
  }

  next()
}

// Middleware to authenticate using JWT tokens (for API access)
export const authenticateJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractTokenFromHeader(req.headers.authorization)

    if (!token) {
      req.user = undefined
      return next()
    }

    const payload = verifyAccessToken(token)
    if (!payload) {
      req.user = undefined
      return next()
    }

    // Create user object from JWT payload
    req.user = {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
      emailVerified: true, // Assume verified if JWT is valid
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as AuthUser

    logger.debug(`JWT authenticated for user: ${payload.email}`)
    next()
  } catch (error) {
    logger.debug('JWT authentication failed:', error)
    req.user = undefined
    next()
  }
}

// Middleware to require JWT authentication
export const requireJWT = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const token = extractTokenFromHeader(req.headers.authorization)

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization token required',
      code: 'TOKEN_REQUIRED',
    })
    return
  }

  const payload = verifyAccessToken(token)
  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    })
    return
  }

  // Create user object from JWT payload
  req.user = {
    id: payload.userId,
    email: payload.email,
    name: payload.name,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as AuthUser

  next()
}

// Helper function to get user ID from request
export const getUserId = (req: Request): string | null => {
  return req.user?.id || null
}

// Helper function to check if user is authenticated
export const isAuthenticated = (req: Request): boolean => {
  return !!req.user
}
