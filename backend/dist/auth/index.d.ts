export declare const auth: {
  api: {
    signOut: (options: any) => Promise<never>
  }
}
export interface AuthUser {
  id: string
  email: string
  name: string
  image?: string | null
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}
export interface AuthSession {
  id: string
  userId: string
  expiresAt: Date
  token: string
  createdAt: Date
  updatedAt: Date
}
//# sourceMappingURL=index.d.ts.map
