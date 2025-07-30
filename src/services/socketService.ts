import { io, Socket } from "socket.io-client";
import { tokenManager } from "../app/lib/api";
import { logger } from "../app/lib/logger";

interface SocketEventData {
  [key: string]: any;
}

interface PendingMessage {
  event: string;
  data: any;
  timestamp: number;
  retries: number;
}

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private playerCreated: boolean = false;
  private inMatchmaking: boolean = false;
  private roomJoined: boolean = false;
  private playersInRoom: number = 0;
  private currentRoomId: string | null = null;
  private roomCode: string | null = null;
  private eventListeners: Map<string, Function[]> = new Map();
  private connectionStartTime: number = 0;
  
  // Performance optimization properties
  private messageQueue: PendingMessage[] = [];
  private isProcessingQueue: boolean = false;
  private batchSize: number = 10;
  private throttleMap: Map<string, number> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  // Event throttling configuration
  private throttleConfig: { [key: string]: number } = {
    'player-position': 50, // 50ms throttle for position updates
    'ball-state': 33,      // 33ms throttle for ball updates (30 FPS)
    'player-input': 16,    // 16ms throttle for input updates (60 FPS)
  };

  connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        resolve(this.socket);
        return;
      }

      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

      const token = tokenManager.getToken();

      logger.network("Connecting to socket server", { backendUrl });
      this.socket = io(backendUrl, {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: this.maxReconnectAttempts,
      });

      this.connectionStartTime = Date.now();
      this.setupConnectionHandlers(resolve, reject);
      this.setupGameEventHandlers();
      this.startMessageProcessing();
    });
  }

  private setupConnectionHandlers(resolve: Function, reject: Function): void {
    if (!this.socket) return;

    this.socket.on("connect", () => {
      logger.network("Socket connected successfully", {
        socketId: this.socket?.id,
        connectionTime: Date.now() - this.connectionStartTime,
      });
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit("connected", { socketId: this.socket?.id });
      resolve(this.socket!);
    });

    this.socket.on("disconnect", (reason) => {
      logger.warn("Socket disconnected", { reason });
      this.isConnected = false;
      this.playerCreated = false;
      this.resetMatchmakingState();
      this.emit("disconnected", { reason });
    });

    this.socket.on("connect_error", (error) => {
      logger.error("Socket connection error", { error: error.message });
      this.isConnected = false;
      this.emit("connect_error", { error });
      reject(error);
    });

    this.socket.on("reconnect_attempt", (attemptNumber) => {
      this.reconnectAttempts = attemptNumber;
      logger.info("Socket reconnection attempt", { attemptNumber });
      this.emit("reconnect_attempt", { attemptNumber });
    });

    this.socket.on("reconnect", (attemptNumber) => {
      logger.info("Socket reconnected successfully", { attemptNumber });
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit("reconnected", { attemptNumber });
    });

    this.socket.on("reconnect_error", (error) => {
      logger.error("Socket reconnection error", { error: error.message });
      this.emit("reconnect_error", { error });
    });

    this.socket.on("reconnect_failed", () => {
      logger.error("Socket reconnection failed after maximum attempts");
      this.emit("reconnect_failed", {});
    });
  }

  private setupGameEventHandlers(): void {
    if (!this.socket) return;

    // Welcome and player events
    this.socket.on("welcome", (data) => {
      logger.network("Welcome message received", data);
      this.emit("welcome", data);
    });

    this.socket.on("player-created", (data) => {
      logger.network("Player created", data);
      this.playerCreated = true;
      this.emit("player-created", data);
    });

    this.socket.on("game-status", (data) => {
      logger.game("Game status updated", data);
      this.emit("game-status", data);
    });

    // Room management events
    this.setupRoomEventHandlers();

    // Game state events
    this.setupGameStateEventHandlers();

    // Real-time game events
    this.setupRealtimeEventHandlers();
  }

  private setupRoomEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("room-joined", (data) => {
      logger.network("Room joined", data);
      this.roomJoined = true;
      this.inMatchmaking = false;
      this.currentRoomId = data.roomId || data.id;
      this.roomCode = data.roomCode;
      this.playersInRoom = data.players ? data.players.length : 1;
      this.emit("room-joined", data);
    });

    this.socket.on("room-created", (data) => {
      logger.network("Room created", data);
      this.roomJoined = true;
      this.inMatchmaking = false;
      this.currentRoomId = data.roomId || data.id;
      this.roomCode = data.roomCode;
      this.playersInRoom = data.players ? data.players.length : 1;
      this.emit("room-created", data);
    });

    this.socket.on("player-joined-room", (data) => {
      logger.network("Player joined room", data);
      this.playersInRoom = data.players
        ? data.players.length
        : data.playersCount || this.playersInRoom + 1;
      this.emit("player-joined-room", data);
    });

    this.socket.on("room-full", (data) => {
      logger.warn("Room is full", data);
      this.emit("room-full", data);
    });

    this.socket.on("left-room", (data) => {
      logger.network("Left room", data);
      this.roomJoined = false;
      this.currentRoomId = null;
      this.roomCode = null;
      this.playersInRoom = 0;
      this.emit("left-room", data);
    });

    this.socket.on("player-left", (data) => {
      logger.network("Player left room", data);
      this.playersInRoom = Math.max(0, this.playersInRoom - 1);
      this.emit("player-left", data);
    });

    this.socket.on("player-ready", (data) => {
      logger.game("Player ready", data);
      this.emit("player-ready", data);
    });
  }

  private setupGameStateEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on("game-started", (data) => {
      logger.game("Game started", data);
      this.emit("game-started", data);
    });

    this.socket.on("match-ended", (data) => {
      logger.game("Match ended", data);
      this.emit("match-ended", data);
    });

    this.socket.on("game-ended", (data) => {
      logger.game("Game ended", data);
      this.emit("game-ended", data);
    });

    this.socket.on("goal-scored", (data) => {
      logger.game("Goal scored", data);
      this.emit("goal-scored", data);
    });

    // Timer synchronization
    this.socket.on("timer-update", (data) => {
      this.emit("timer-update", data);
    });

    this.socket.on("game-time", (data) => {
      this.emit("game-time", data);
    });

    this.socket.on("timer-warning", (data) => {
      logger.game("Timer warning", data);
      this.emit("timer-warning", data);
    });
  }

  private setupRealtimeEventHandlers(): void {
    if (!this.socket) return;

    // Real-time game state updates
    this.socket.on("player-position", (data) => {
      this.emit("player-position", data);
    });

    this.socket.on("ball-state", (data) => {
      this.emit("ball-state", data);
    });

    this.socket.on("player-input", (data) => {
      this.emit("player-input", data);
    });

    this.socket.on("move-left", (data) => {
      this.emit("move-left", data);
    });

    this.socket.on("move-right", (data) => {
      this.emit("move-right", data);
    });

    this.socket.on("jump", (data) => {
      this.emit("jump", data);
    });

    this.socket.on("kick", (data) => {
      this.emit("kick", data);
    });

    this.socket.on("all-players-ready", (data) => {
      logger.game("All players ready", data);
      this.emit("all-players-ready", data);
    });

    // Power-up and special events
    this.socket.on("powerup-collected", (data) => {
      logger.game("Powerup collected", data);
      this.emit("powerup-collected", data);
    });

    // Rematch system
    this.socket.on("rematch-requested", (data) => {
      logger.game("Rematch requested", data);
      this.emit("rematch-requested", data);
    });

    this.socket.on("rematch-accepted", (data) => {
      logger.game("Rematch accepted", data);
      this.emit("rematch-accepted", data);
    });

    this.socket.on("rematch-declined", (data) => {
      logger.game("Rematch declined", data);
      this.emit("rematch-declined", data);
    });

    this.socket.on("rematch-timeout", (data) => {
      logger.game("Rematch timeout", data);
      this.emit("rematch-timeout", data);
    });

    // Error handling
    this.socket.on("error", (error) => {
      logger.error("Socket error received", error);
      this.emit("error", error);
    });

    this.socket.on("invalid-action", (data) => {
      logger.warn("Invalid action received", data);
      this.emit("invalid-action", data);
    });
  }

  // Optimized emit with throttling and batching
  emitThrottled(event: string, data: any): void {
    const now = Date.now();
    const throttleTime = this.throttleConfig[event] || 0;
    const lastEmitTime = this.throttleMap.get(event) || 0;

    if (now - lastEmitTime < throttleTime) {
      return; // Skip this emit due to throttling
    }

    this.throttleMap.set(event, now);
    this.emitQueued(event, data);
  }

  // Queue messages for batched processing
  private emitQueued(event: string, data: any): void {
    this.messageQueue.push({
      event,
      data,
      timestamp: Date.now(),
      retries: 0,
    });
  }

  // Process queued messages in batches
  private async startMessageProcessing(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    const processMessages = async () => {
      while (this.messageQueue.length > 0) {
        const batch = this.messageQueue.splice(0, this.batchSize);
        
        for (const message of batch) {
          try {
            if (this.socket && this.isConnected) {
              this.socket.emit(message.event, message.data);
            } else {
              // Re-queue message if not connected
              if (message.retries < 3) {
                message.retries++;
                this.messageQueue.push(message);
              }
            }
          } catch (error) {
            logger.error("Failed to emit message", {
              event: message.event,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 16)); // ~60 FPS
      }

      // Continue processing
      setTimeout(processMessages, 16);
    };

    processMessages();
  }

  // Standard emit (immediate)
  emit(event: string, data?: any): void {
    try {
      if (this.socket && this.isConnected) {
        this.socket.emit(event, data);
      } else {
        logger.warn("Cannot emit - socket not connected", { event });
      }
    } catch (error) {
      logger.error("Failed to emit message", {
        event,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Event listener management
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback?: Function): void {
    if (!this.eventListeners.has(event)) return;

    if (callback) {
      const listeners = this.eventListeners.get(event)!;
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.eventListeners.delete(event);
    }
  }

  // Utility methods
  private resetMatchmakingState(): void {
    this.roomJoined = false;
    this.inMatchmaking = false;
    this.currentRoomId = null;
    this.roomCode = null;
    this.playersInRoom = 0;
    logger.network("Matchmaking state reset");
  }

  // Game actions with optimized emission
  createPlayer(playerData: any): void {
    logger.network("Creating player", playerData);
    this.emit("create-player", playerData);
  }

  joinMatchmaking(): void {
    if (this.inMatchmaking) {
      logger.warn("Already in matchmaking");
      return;
    }
    
    logger.network("Joining matchmaking");
    this.inMatchmaking = true;
    this.emit("find-match");
  }

  createRoom(roomData?: any): void {
    logger.network("Creating room", roomData);
    this.emit("create-room", roomData || {});
  }

  joinRoom(roomCode: string): void {
    logger.network("Joining room", { roomCode });
    this.emit("join-room", { roomCode });
  }

  leaveRoom(): void {
    if (!this.roomJoined) {
      logger.warn("Not in a room to leave");
      return;
    }
    
    logger.network("Leaving room");
    this.emit("leave-room");
  }

  cancelMatchmaking(): void {
    if (!this.inMatchmaking) {
      logger.warn("Not in matchmaking to cancel");
      return;
    }
    
    logger.network("Cancelling matchmaking");
    this.inMatchmaking = false;
    this.emit("cancel-matchmaking");
  }

  setPlayerReady(isReady: boolean = true): void {
    logger.game("Setting player ready", { isReady });
    this.emit("player-ready", { isReady });
  }

  // Optimized real-time game actions
  sendPlayerPosition(positionData: any): void {
    this.emitThrottled("player-position", positionData);
  }

  sendBallState(ballData: any): void {
    this.emitThrottled("ball-state", ballData);
  }

  sendPlayerInput(inputData: any): void {
    this.emitThrottled("player-input", inputData);
  }

  sendGoal(goalData: any): void {
    logger.game("Sending goal", goalData);
    this.emit("goal-scored", goalData);
  }

  // Rematch system
  requestRematch(): void {
    logger.game("Requesting rematch");
    this.emit("request-rematch");
  }

  acceptRematch(): void {
    logger.game("Accepting rematch");
    this.emit("accept-rematch");
  }

  declineRematch(): void {
    logger.game("Declining rematch");
    this.emit("decline-rematch");
  }

  // Getters
  getSocket(): Socket | null {
    return this.socket;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getRoomInfo(): {
    roomId: string | null;
    roomCode: string | null;
    playersInRoom: number;
    isInRoom: boolean;
  } {
    return {
      roomId: this.currentRoomId,
      roomCode: this.roomCode,
      playersInRoom: this.playersInRoom,
      isInRoom: this.roomJoined,
    };
  }

  getMatchmakingStatus(): boolean {
    return this.inMatchmaking;
  }

  // Cleanup
  disconnect(): void {
    logger.network("Disconnecting socket");
    this.isProcessingQueue = false;
    this.messageQueue.length = 0;
    this.eventListeners.clear();
    this.throttleMap.clear();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
    this.resetMatchmakingState();
  }
}

export const socketService = new SocketService();
