// File Router - integrates with backend file service layer
import { createTRPCRouter, protectedProcedure } from '../init'
import { z } from 'zod'
import { db } from '@/db'
import { fileUploads } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { createServiceContext } from '../../../backend/src/services'
import type { FileUploadData } from '../../../backend/src/services/file/file-service'

// Input validation schemas
const uploadFileSchema = z.object({
  filename: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  content: z.string(), // Base64 encoded content
  mimeType: z.string().min(1).max(100),
  conversationId: z.string().uuid().optional(),
})

const uploadImageSchema = uploadFileSchema.extend({
  maxWidth: z.number().min(1).max(4096).optional(),
  maxHeight: z.number().min(1).max(4096).optional(),
  quality: z.number().min(0.1).max(1.0).optional(),
  format: z.enum(['jpeg', 'png', 'webp']).optional(),
})

const getFileSchema = z.object({
  fileId: z.string().uuid(),
})

const deleteFileSchema = z.object({
  fileId: z.string().uuid(),
})

const listFilesSchema = z.object({
  conversationId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
  mimeTypeFilter: z.string().optional(),
})

export const filesRouter = createTRPCRouter({
  // Upload single file
  uploadFile: protectedProcedure
    .input(uploadFileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { Services } = await import('../../../backend/src/services')
        const fileService = Services.file()

        // Create service context
        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId || 'unknown',
        })

        // Decode base64 content
        const content = Buffer.from(input.content, 'base64')

        // Prepare file data
        const fileData: FileUploadData = {
          filename: input.filename,
          originalName: input.originalName,
          content,
          mimeType: input.mimeType,
          conversationId: input.conversationId,
        }

        // Upload file via service
        const uploadResult = await fileService.uploadFile(
          serviceContext,
          fileData
        )

        // Save file record to database
        const fileRecord = await db
          .insert(fileUploads)
          .values({
            id: uploadResult.fileId,
            userId: ctx.user.id,
            conversationId: input.conversationId,
            filename: uploadResult.filename,
            originalName: uploadResult.originalName,
            mimeType: uploadResult.mimeType,
            fileSize: uploadResult.fileSize,
            storagePath: uploadResult.storagePath,
            contentHash: uploadResult.contentHash,
            metadata: uploadResult.metadata,
          })
          .returning()

        return {
          ...uploadResult,
          id: fileRecord[0].id,
          createdAt: fileRecord[0].createdAt,
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('INVALID_FILE_TYPE')
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid file type',
          })
        }
        if (
          error instanceof Error &&
          error.message.includes('FILE_TOO_LARGE')
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'File too large',
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'File upload failed',
        })
      }
    }),

  // Upload image with processing
  uploadImage: protectedProcedure
    .input(uploadImageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { Services } = await import('../../../backend/src/services')
        const fileService = Services.file()

        // Create service context
        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId || 'unknown',
        })

        // Decode base64 content
        const content = Buffer.from(input.content, 'base64')

        // Prepare image data
        const imageData = {
          filename: input.filename,
          originalName: input.originalName,
          content,
          mimeType: input.mimeType,
          conversationId: input.conversationId,
          maxWidth: input.maxWidth,
          maxHeight: input.maxHeight,
          quality: input.quality,
          format: input.format,
        }

        // Upload image via service
        const uploadResult = await fileService.uploadImage(
          serviceContext,
          imageData
        )

        // Save file record to database
        const fileRecord = await db
          .insert(fileUploads)
          .values({
            id: uploadResult.fileId,
            userId: ctx.user.id,
            conversationId: input.conversationId,
            filename: uploadResult.filename,
            originalName: uploadResult.originalName,
            mimeType: uploadResult.mimeType,
            fileSize: uploadResult.fileSize,
            storagePath: uploadResult.storagePath,
            contentHash: uploadResult.contentHash,
            metadata: uploadResult.metadata,
          })
          .returning()

        return {
          ...uploadResult,
          id: fileRecord[0].id,
          createdAt: fileRecord[0].createdAt,
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('INVALID_IMAGE_TYPE')
        ) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid image type',
          })
        }

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Image upload failed',
        })
      }
    }),

  // Get file metadata
  getFile: protectedProcedure
    .input(getFileSchema)
    .query(async ({ ctx, input }) => {
      const fileRecord = await db
        .select()
        .from(fileUploads)
        .where(
          and(
            eq(fileUploads.id, input.fileId),
            eq(fileUploads.userId, ctx.user.id)
          )
        )
        .then((rows) => rows[0])

      if (!fileRecord) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        })
      }

      return {
        id: fileRecord.id,
        filename: fileRecord.filename,
        originalName: fileRecord.originalName,
        mimeType: fileRecord.mimeType,
        fileSize: fileRecord.fileSize,
        storagePath: fileRecord.storagePath,
        contentHash: fileRecord.contentHash,
        metadata: fileRecord.metadata,
        conversationId: fileRecord.conversationId,
        createdAt: fileRecord.createdAt,
        url: `/api/files/${fileRecord.id}`, // URL for file access
      }
    }),

  // List user files
  listFiles: protectedProcedure
    .input(listFilesSchema)
    .query(async ({ ctx, input }) => {
      let query = db
        .select()
        .from(fileUploads)
        .where(eq(fileUploads.userId, ctx.user.id))

      // Add conversation filter if specified
      if (input.conversationId) {
        query = query.where(
          eq(fileUploads.conversationId, input.conversationId)
        )
      }

      // Add mime type filter if specified
      if (input.mimeTypeFilter) {
        query = query.where(eq(fileUploads.mimeType, input.mimeTypeFilter))
      }

      const files = await query
        .orderBy(desc(fileUploads.createdAt))
        .limit(input.limit)
        .offset(input.offset)

      return files.map((file) => ({
        id: file.id,
        filename: file.filename,
        originalName: file.originalName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        contentHash: file.contentHash,
        metadata: file.metadata,
        conversationId: file.conversationId,
        createdAt: file.createdAt,
        url: `/api/files/${file.id}`,
      }))
    }),

  // Delete file
  deleteFile: protectedProcedure
    .input(deleteFileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify file ownership
        const fileRecord = await db
          .select()
          .from(fileUploads)
          .where(
            and(
              eq(fileUploads.id, input.fileId),
              eq(fileUploads.userId, ctx.user.id)
            )
          )
          .then((rows) => rows[0])

        if (!fileRecord) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'File not found',
          })
        }

        // Delete via service layer
        const { Services } = await import('../../../backend/src/services')
        const fileService = Services.file()

        const serviceContext = createServiceContext({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          sessionId: ctx.sessionId || 'unknown',
        })

        const deleted = await fileService.deleteFile(
          serviceContext,
          input.fileId
        )

        if (deleted) {
          // Remove from database
          await db.delete(fileUploads).where(eq(fileUploads.id, input.fileId))

          return { success: true }
        } else {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete file',
          })
        }
      } catch (error) {
        if (error instanceof TRPCError) throw error

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'File deletion failed',
        })
      }
    }),

  // Get file service health
  getFileServiceHealth: protectedProcedure.query(async () => {
    try {
      const { Services } = await import('../../../backend/src/services')
      const fileService = Services.file()

      const isHealthy = await fileService.healthCheck()

      return {
        healthy: isHealthy,
        service: 'File Service via tRPC',
        timestamp: new Date(),
      }
    } catch {
      return {
        healthy: false,
        service: 'File Service Unavailable',
        timestamp: new Date(),
      }
    }
  }),

  // Get file storage stats
  getStorageStats: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Get user's file statistics
      const stats = await db
        .select()
        .from(fileUploads)
        .where(eq(fileUploads.userId, ctx.user.id))

      const totalFiles = stats.length
      const totalSize = stats.reduce((sum, file) => sum + file.fileSize, 0)

      // Group by mime type
      const fileTypeStats = stats.reduce(
        (acc, file) => {
          const category = file.mimeType.split('/')[0]
          acc[category] = (acc[category] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      )

      return {
        totalFiles,
        totalSize,
        fileTypeStats,
        averageFileSize:
          totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0,
      }
    } catch {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get storage stats',
      })
    }
  }),
})
