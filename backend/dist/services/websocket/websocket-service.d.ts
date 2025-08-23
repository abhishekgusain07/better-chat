import { Server as SocketIOServer } from 'socket.io'
import { BaseService } from '../base/service'
import { WebSocketBroadcast } from '../types'
export interface IWebSocketService {
  attachSocketServer(io: SocketIOServer): void
  getSocketServer(): SocketIOServer | null
  broadcastToConversation(broadcast: WebSocketBroadcast): Promise<void>
  broadcastToUser(userId: string, event: string, data: any): Promise<void>
  broadcastToAll(event: string, data: any): Promise<void>
  getConnectedUsers(): string[]
  getUserSocketCount(userId: string): number
  isUserConnected(userId: string): boolean
  joinRoom(socketId: string, room: string): Promise<void>
  leaveRoom(socketId: string, room: string): Promise<void>
  getRoomMembers(room: string): string[]
}
export declare class WebSocketService
  extends BaseService
  implements IWebSocketService
{
  private _io
  private _userSocketMap
  private _socketUserMap
  constructor()
  initialize(): Promise<void>
  attachSocketServer(io: SocketIOServer): void
  getSocketServer(): SocketIOServer | null
  broadcastToConversation(broadcast: WebSocketBroadcast): Promise<void>
  broadcastToUser(userId: string, event: string, data: any): Promise<void>
  broadcastToAll(event: string, data: any): Promise<void>
  getConnectedUsers(): string[]
  getUserSocketCount(userId: string): number
  isUserConnected(userId: string): boolean
  joinRoom(socketId: string, room: string): Promise<void>
  leaveRoom(socketId: string, room: string): Promise<void>
  getRoomMembers(room: string): string[]
  private _setupEventHandlers
  private _addUserSocket
  private _removeUserSocket
  cleanup(): Promise<void>
  healthCheck(): Promise<boolean>
}
//# sourceMappingURL=websocket-service.d.ts.map
