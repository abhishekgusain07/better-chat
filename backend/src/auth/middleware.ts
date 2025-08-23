import { Request, Response, NextFunction } from 'express'
import { auth, AuthUser, AuthSession } from '@/auth'
// JWT imports removed - using session-based authentication only
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

// JWT authentication middleware removed - using session-based authentication only

// Helper function to get user ID from request
export const getUserId = (req: Request): string | null => {
  return req.user?.id || null
}

// Helper function to check if user is authenticated
export const isAuthenticated = (req: Request): boolean => {
  return !!req.user
}
