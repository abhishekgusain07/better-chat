import { BaseService } from '../base/service'
import { ServiceError, ServiceContext } from '../types'
import { createHash } from 'crypto'
import { readFile, writeFile, mkdir, unlink, stat } from 'fs/promises'
import { join, extname, basename } from 'path'
import { nanoid } from 'nanoid'

/**
 * File Service Interface
 * Manages file uploads, processing, validation and storage
 */
export interface IFileService {
  // Upload operations
  uploadFile(
    context: ServiceContext,
    fileData: FileUploadData
  ): Promise<FileUploadResult>
  uploadImage(
    context: ServiceContext,
    imageData: ImageUploadData
  ): Promise<FileUploadResult>
  uploadMultipleFiles(
    context: ServiceContext,
    files: FileUploadData[]
  ): Promise<FileUploadResult[]>

  // File operations
  getFileMetadata(fileId: string): Promise<FileMetadata | null>
  getFileContent(fileId: string): Promise<Buffer | null>
  deleteFile(context: ServiceContext, fileId: string): Promise<boolean>

  // Validation
  validateFileType(filename: string, allowedTypes: string[]): boolean
  validateFileSize(size: number, maxSizeBytes: number): boolean
  generateContentHash(content: Buffer): string

  // Storage management
  getStoragePath(userId: string, filename: string): string
  ensureUserDirectory(userId: string): Promise<string>
  getFileUrl(fileId: string): string

  // Cleanup operations
  cleanupOrphanedFiles(): Promise<number>
  cleanupExpiredFiles(olderThanDays: number): Promise<number>
}

/**
 * File upload data structure
 */
export interface FileUploadData {
  filename: string
  originalName: string
  content: Buffer
  mimeType: string
  conversationId?: string
}

/**
 * Image upload data structure with processing options
 */
export interface ImageUploadData extends FileUploadData {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

/**
 * File upload result
 */
export interface FileUploadResult {
  fileId: string
  filename: string
  originalName: string
  mimeType: string
  fileSize: number
  storagePath: string
  contentHash: string
  url: string
  metadata: Record<string, unknown>
}

/**
 * File metadata structure
 */
export interface FileMetadata {
  id: string
  userId: string
  conversationId?: string
  filename: string
  originalName: string
  mimeType: string
  fileSize: number
  storagePath: string
  contentHash: string
  metadata: Record<string, unknown>
  createdAt: Date
}

/**
 * File Service Implementation
 * Provides comprehensive file management for the service layer
 */
export class FileService extends BaseService implements IFileService {
  private _uploadsDir: string
  private _maxFileSize: number
  private _allowedImageTypes: string[]
  private _allowedFileTypes: string[]

  constructor() {
    super('file-service')
    this._uploadsDir = process.env.UPLOADS_DIR || './uploads'
    this._maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '50000000') // 50MB default
    this._allowedImageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ]
    this._allowedFileTypes = [
      ...this._allowedImageTypes,
      'text/plain',
      'text/csv',
      'application/json',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]
  }

  async initialize(): Promise<void> {
    this._logger.info('Initializing File Service...')

    try {
      // Ensure uploads directory exists
      await mkdir(this._uploadsDir, { recursive: true })

      this._logger.info('✅ File Service initialized')
      this._logger.info(`📁 Uploads directory: ${this._uploadsDir}`)
      this._logger.info(`📏 Max file size: ${this._maxFileSize / 1000000}MB`)
    } catch (error) {
      this._logger.error('❌ Failed to initialize File Service:', error)
      throw error
    }
  }

  /**
   * Upload a file with validation and processing
   */
  async uploadFile(
    context: ServiceContext,
    fileData: FileUploadData
  ): Promise<FileUploadResult> {
    this.logServiceOperation('uploadFile', {
      userId: context.userId,
      filename: fileData.filename,
      size: fileData.content.length,
      conversationId: fileData.conversationId,
    })

    try {
      // Validation
      if (!this.validateFileType(fileData.filename, this._allowedFileTypes)) {
        throw new ServiceError(
          `File type not allowed: ${extname(fileData.filename)}`,
          'INVALID_FILE_TYPE',
          this.name
        )
      }

      if (!this.validateFileSize(fileData.content.length, this._maxFileSize)) {
        throw new ServiceError(
          `File size exceeds limit: ${fileData.content.length} bytes`,
          'FILE_TOO_LARGE',
          this.name
        )
      }

      // Generate file ID and paths
      const fileId = nanoid()
      const contentHash = this.generateContentHash(fileData.content)
      const userDir = await this.ensureUserDirectory(context.userId)
      const filename = `${fileId}_${fileData.filename}`
      const storagePath = join(userDir, filename)

      // Save file to storage
      await writeFile(storagePath, fileData.content)

      // Create result
      const result: FileUploadResult = {
        fileId,
        filename,
        originalName: fileData.originalName,
        mimeType: fileData.mimeType,
        fileSize: fileData.content.length,
        storagePath: storagePath.replace(this._uploadsDir, ''), // Relative path
        contentHash,
        url: this.getFileUrl(fileId),
        metadata: {
          uploadedAt: new Date().toISOString(),
          userId: context.userId,
          conversationId: fileData.conversationId,
        },
      }

      this._logger.info(`File uploaded successfully: ${fileId}`)
      return result
    } catch (error) {
      this.logServiceError('uploadFile', error as Error)
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            'File upload failed',
            'UPLOAD_FAILED',
            this.name,
            error as Error
          )
    }
  }

  /**
   * Upload image with optional processing
   */
  async uploadImage(
    context: ServiceContext,
    imageData: ImageUploadData
  ): Promise<FileUploadResult> {
    this.logServiceOperation('uploadImage', {
      userId: context.userId,
      filename: imageData.filename,
      size: imageData.content.length,
      maxWidth: imageData.maxWidth,
      maxHeight: imageData.maxHeight,
    })

    try {
      // Validate image type
      if (!this.validateFileType(imageData.filename, this._allowedImageTypes)) {
        throw new ServiceError(
          `Image type not allowed: ${extname(imageData.filename)}`,
          'INVALID_IMAGE_TYPE',
          this.name
        )
      }

      // TODO: Add image processing (resize, compression, format conversion)
      // For now, treat as regular file upload
      const result = await this.uploadFile(context, imageData)

      // Add image-specific metadata
      result.metadata = {
        ...result.metadata,
        isImage: true,
        processedWith:
          imageData.maxWidth || imageData.maxHeight ? 'resized' : 'original',
      }

      return result
    } catch (error) {
      this.logServiceError('uploadImage', error as Error)
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            'Image upload failed',
            'IMAGE_UPLOAD_FAILED',
            this.name,
            error as Error
          )
    }
  }

  /**
   * Upload multiple files
   */
  async uploadMultipleFiles(
    context: ServiceContext,
    files: FileUploadData[]
  ): Promise<FileUploadResult[]> {
    this.logServiceOperation('uploadMultipleFiles', {
      userId: context.userId,
      fileCount: files.length,
    })

    try {
      const results: FileUploadResult[] = []

      for (const fileData of files) {
        const result = await this.uploadFile(context, fileData)
        results.push(result)
      }

      return results
    } catch (error) {
      this.logServiceError('uploadMultipleFiles', error as Error)
      throw error instanceof ServiceError
        ? error
        : new ServiceError(
            'Multiple file upload failed',
            'MULTIPLE_UPLOAD_FAILED',
            this.name,
            error as Error
          )
    }
  }

  /**
   * Get file metadata by ID
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    // TODO: Implement database lookup
    // For now, return null as this would integrate with tRPC database operations
    this.logServiceOperation('getFileMetadata', { fileId })
    return null
  }

  /**
   * Get file content by ID
   */
  async getFileContent(fileId: string): Promise<Buffer | null> {
    this.logServiceOperation('getFileContent', { fileId })

    try {
      // TODO: Implement file lookup by ID
      // This would require database integration to find the storage path
      return null
    } catch (error) {
      this.logServiceError('getFileContent', error as Error)
      return null
    }
  }

  /**
   * Delete file
   */
  async deleteFile(context: ServiceContext, fileId: string): Promise<boolean> {
    this.logServiceOperation('deleteFile', {
      userId: context.userId,
      fileId,
    })

    try {
      // TODO: Implement file deletion
      // Would require database lookup and physical file removal
      return true
    } catch (error) {
      this.logServiceError('deleteFile', error as Error)
      return false
    }
  }

  /**
   * Validate file type against allowed types
   */
  validateFileType(filename: string, allowedTypes: string[]): boolean {
    const ext = extname(filename).toLowerCase()
    const mimeTypeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.json': 'application/json',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx':
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }

    const mimeType = mimeTypeMap[ext]
    return mimeType ? allowedTypes.includes(mimeType) : false
  }

  /**
   * Validate file size
   */
  validateFileSize(size: number, maxSizeBytes: number): boolean {
    return size > 0 && size <= maxSizeBytes
  }

  /**
   * Generate content hash for deduplication
   */
  generateContentHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Generate storage path for user file
   */
  getStoragePath(userId: string, filename: string): string {
    return join(this._uploadsDir, userId, filename)
  }

  /**
   * Ensure user directory exists
   */
  async ensureUserDirectory(userId: string): Promise<string> {
    const userDir = join(this._uploadsDir, userId)
    await mkdir(userDir, { recursive: true })
    return userDir
  }

  /**
   * Generate file URL
   */
  getFileUrl(fileId: string): string {
    const baseUrl = process.env.FILE_BASE_URL || '/api/files'
    return `${baseUrl}/${fileId}`
  }

  /**
   * Cleanup orphaned files (not referenced in database)
   */
  async cleanupOrphanedFiles(): Promise<number> {
    this.logServiceOperation('cleanupOrphanedFiles', {})

    // TODO: Implement cleanup logic
    // Would scan file system and compare with database records
    return 0
  }

  /**
   * Cleanup expired files
   */
  async cleanupExpiredFiles(olderThanDays: number): Promise<number> {
    this.logServiceOperation('cleanupExpiredFiles', { olderThanDays })

    // TODO: Implement cleanup logic based on file age
    return 0
  }

  async cleanup(): Promise<void> {
    this.logServiceOperation('cleanup', {})
    await super.cleanup()
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Check if uploads directory is accessible
      await stat(this._uploadsDir)
      return true
    } catch {
      return false
    }
  }
}
