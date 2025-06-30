import { io, Socket } from "socket.io-client";
import { tokenManager } from "../app/lib/api";

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

  connect(): Promise<Socket> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        resolve(this.socket);
        return;
      }

      // Get the backend URL from environment or default to localhost
      const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

      // Get auth token for authentication
      const token = tokenManager.getToken();

      console.log("Connecting to socket server...");
      this.socket = io(backendUrl, {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
        timeout: 10000,
      });

      // Track connection start time
      this.connectionStartTime = Date.now();

      // Connection events
      this.socket.on("connect", () => {
        console.log("Socket connected");
        this.isConnected = true;
        this.emit("connected", { socketId: this.socket?.id });
        resolve(this.socket!);
      });

      this.socket.on("disconnect", (reason) => {
        console.log("Socket disconnected, reason:", reason);
        this.isConnected = false;
        this.playerCreated = false;
        this.resetMatchmakingState();
        console.log("Room state reset due to disconnect");
        this.emit("disconnected", { reason });
      });

      // Add error handling for connection errors
      this.socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        this.isConnected = false;
        this.emit("connect_error", { error });
        reject(error);
      });

      // Add error handling for reconnection attempts
      this.socket.on("reconnect_attempt", (attemptNumber) => {
        console.log("Socket reconnection attempt:", attemptNumber);
        this.emit("reconnect_attempt", { attemptNumber });
      });

      this.socket.on("reconnect", (attemptNumber) => {
        console.log("Socket reconnected after", attemptNumber, "attempts");
        this.isConnected = true;
        this.emit("reconnected", { attemptNumber });
      });

      this.socket.on("reconnect_error", (error) => {
        console.error("Socket reconnection error:", error);
        this.emit("reconnect_error", { error });
      });

      this.socket.on("reconnect_failed", () => {
        console.error("Socket reconnection failed");
        this.emit("reconnect_failed", {});
      });

      // Listen for welcome event
      this.socket.on("welcome", (data) => {
        console.log("Welcome message received:", data);
        this.emit("welcome", data);
      });

      // Listen for player-created event
      this.socket.on("player-created", (data) => {
        console.log("Player created:", data);
        this.playerCreated = true;
        this.emit("player-created", data);
      });

      // Listen for game-status event
      this.socket.on("game-status", (data) => {
        console.log("Game status updated:", data);
        this.emit("game-status", data);
      });

      // Listen for matchmaking events
      this.socket.on("room-joined", (data) => {
        console.log("Room joined:", data);
        this.roomJoined = true;
        this.inMatchmaking = false; // Stop matchmaking when room is joined
        this.currentRoomId = data.roomId || data.id;
        this.roomCode = data.roomCode;
        // Backend sends players array, so use players.length
        this.playersInRoom = data.players ? data.players.length : 1;
        this.emit("room-joined", data);
      });

      this.socket.on("room-created", (data) => {
        console.log("Room created:", data);
        this.roomJoined = true;
        this.inMatchmaking = false;
        this.currentRoomId = data.roomId || data.id;
        this.roomCode = data.roomCode;
        this.playersInRoom = data.players ? data.players.length : 1;
        this.emit("room-created", data);
      });

      this.socket.on("player-joined-room", (data) => {
        console.log("Player joined room:", data);
        // Update player count from the data
        this.playersInRoom = data.players
          ? data.players.length
          : data.playersCount || this.playersInRoom + 1;
        this.emit("player-joined-room", data);
      });

      this.socket.on("room-full", (data) => {
        console.log("Room is full:", data);
        this.emit("room-full", data);
      });

      this.socket.on("left-room", (data) => {
        console.log("Left room:", data);
        this.roomJoined = false;
        this.currentRoomId = null;
        this.roomCode = null;
        this.playersInRoom = 0;
        this.emit("left-room", data);
      });

      this.socket.on("player-left", (data) => {
        console.log("Player left room:", data);
        this.playersInRoom = Math.max(0, this.playersInRoom - 1);
        this.emit("player-left", data);
      });

      this.socket.on("player-ready", (data) => {
        console.log("Player ready:", data);
        this.emit("player-ready", data);
      });

      // Game events
      this.socket.on("game-started", (data) => {
        console.log("Game started:", data);
        this.emit("game-started", data);
      });

      this.socket.on("match-ended", (data) => {
        console.log("Match ended:", data);
        this.emit("match-ended", data);
      });

      this.socket.on("goal-scored", (data) => {
        console.log("Goal scored:", data);
        this.emit("goal-scored", data);
      });

      // Input events
      this.socket.on("player-input", (data) => {
        console.log("Player input received:", data);
        this.emit("player-input", data);
      });

      // Individual input events matching backend structure
      this.socket.on("move-left", (data) => {
        console.log("Move-left input received:", data);
        this.emit("move-left", data);
      });

      this.socket.on("move-right", (data) => {
        console.log("Move-right input received:", data);
        this.emit("move-right", data);
      });

      this.socket.on("jump", (data) => {
        console.log("Jump input received:", data);
        this.emit("jump", data);
      });

      this.socket.on("kick", (data) => {
        console.log("Kick input received:", data);
        this.emit("kick", data);
      });

      // Ball synchronization events
      this.socket.on("ball-state", (data) => {
        console.log("Ball state received:", data);
        this.emit("ball-state", data);
      });

      // Player position synchronization events
      this.socket.on("player-position", (data) => {
        console.log("Player position received:", data);
        this.emit("player-position", data);
      });

      // Rematch events
      this.socket.on("rematch-request", (data) => {
        console.log("Rematch requested:", data);
        this.emit("rematch-request", data);
      });

      this.socket.on("rematch-confirmed", (data) => {
        console.log("Rematch confirmed:", data);
        this.emit("rematch-confirmed", data);
      });

      this.socket.on("rematch-declined", (data) => {
        console.log("Rematch declined:", data);
        this.emit("rematch-declined", data);
      });

      // Error events
      this.socket.on("error", (data) => {
        console.error("Socket error received:", data);
        console.error("Error data type:", typeof data);
        console.error(
          "Error data keys:",
          data ? Object.keys(data) : "null/undefined"
        );
        console.error("Error stack trace:", new Error().stack);
        console.error("Current timestamp:", new Date().toISOString());
        console.error("Socket ID:", this.socket?.id);
        console.error("Socket connected:", this.socket?.connected);

        // Handle empty error objects
        if (!data || Object.keys(data).length === 0) {
          console.warn(
            "Received empty error object, this might indicate a server-side issue"
          );
          console.warn("Current socket state:", {
            connected: this.isConnected,
            playerCreated: this.playerCreated,
            roomJoined: this.roomJoined,
            currentRoomId: this.currentRoomId,
            inMatchmaking: this.inMatchmaking,
          });

          // Log recent socket activity to help debug
          console.warn("Recent socket activity context:");
          console.warn(
            "- Last known room operation:",
            this.currentRoomId ? "In room" : "No room"
          );
          console.warn(
            "- Matchmaking status:",
            this.inMatchmaking ? "Active" : "Inactive"
          );
          console.warn("- Player created:", this.playerCreated ? "Yes" : "No");
          console.warn("- Connection duration:", this.getConnectionDuration());

          // Log browser/network context
          console.warn("Browser context:");
          console.warn("- User agent:", navigator.userAgent);
          console.warn("- Online status:", navigator.onLine);
          console.warn(
            "- Connection type:",
            (navigator as any).connection?.type || "unknown"
          );

          // Don't reset state for empty errors as they might be false positives
          // but emit the error for potential UI handling
          this.emit("error", {
            type: "EMPTY_ERROR",
            message:
              "Empty error received from server - this may be a false positive",
            timestamp: Date.now(),
            context: {
              socketId: this.socket?.id,
              connected: this.isConnected,
              roomJoined: this.roomJoined,
              currentRoomId: this.currentRoomId,
              connectionDuration: this.getConnectionDuration(),
              userAgent: navigator.userAgent,
              online: navigator.onLine,
            },
          });
          return;
        }

        // Handle specific error types
        if (
          data.type === "GAME_ERROR" &&
          data.message === "Player already in a room"
        ) {
          console.warn(
            "Detected 'Player already in a room' error, resetting room state"
          );
          this.forceResetRoomState();
        }

        // Handle "Game not active" error - this is expected during game initialization
        if (data.type === "GOAL_ERROR" && data.message === "Game not active") {
          console.warn(
            "Game not active error - this is expected during game initialization"
          );
          // Don't treat this as a critical error, just log it
          this.emit("error", {
            ...data,
            isRecoverable: true,
            message:
              "Game not active yet - this is normal during initialization",
          });
          return;
        }

        // Log additional error details for debugging
        if (data.type) {
          console.error(`Error type: ${data.type}`);
        }
        if (data.message) {
          console.error(`Error message: ${data.message}`);
        }
        if (data.timestamp) {
          console.error(`Error timestamp: ${data.timestamp}`);
        }

        this.emit("error", data);
      });

      // Global event logger for debugging
      this.socket.onAny((event, ...args) => {
        console.log(`[SOCKET EVENT] ${event}:`, ...args);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error("Socket connection timeout"));
        }
      }, 10000);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.playerCreated = false;
      this.resetMatchmakingState();
    }
  }

  private resetMatchmakingState(): void {
    this.inMatchmaking = false;
    this.roomJoined = false;
    this.playersInRoom = 0;
    this.currentRoomId = null;
    this.roomCode = null;
    console.log("Matchmaking state reset");
  }

  // Force reset room state (for error recovery)
  forceResetRoomState(): void {
    console.log("Force resetting room state");
    this.resetMatchmakingState();
    this.playerCreated = false;
  }

  // Check if player is in any room
  isInAnyRoom(): boolean {
    return this.roomJoined || this.currentRoomId !== null;
  }

  // Get current room state
  getCurrentRoomState(): {
    roomJoined: boolean;
    currentRoomId: string | null;
    roomCode: string | null;
    playersInRoom: number;
    inMatchmaking: boolean;
  } {
    return {
      roomJoined: this.roomJoined,
      currentRoomId: this.currentRoomId,
      roomCode: this.roomCode,
      playersInRoom: this.playersInRoom,
      inMatchmaking: this.inMatchmaking,
    };
  }

  // Public method to reset room state (can be called from UI)
  resetRoomState(): void {
    console.log("Manually resetting room state");
    this.forceResetRoomState();
  }

  // Check and fix room state inconsistencies
  checkAndFixRoomState(): boolean {
    const state = this.getCurrentRoomState();
    console.log("Current room state:", state);

    // Check for inconsistencies
    const hasInconsistency =
      (state.roomJoined && !state.currentRoomId) ||
      (!state.roomJoined && state.currentRoomId) ||
      (state.inMatchmaking && state.roomJoined);

    if (hasInconsistency) {
      console.warn("Room state inconsistency detected, fixing...");
      this.forceResetRoomState();
      return true; // State was fixed
    }

    return false; // No inconsistency found
  }

  joinGame(userData: any): void {
    if (this.socket && this.isConnected) {
      console.log("Emitting join-game:", userData);
      this.socket.emit("join-game", userData);
    } else {
      console.error("Socket not connected, cannot emit join-game");
    }
  }

  findMatch(playerData?: any): void {
    if (this.inMatchmaking) {
      console.log("Already in matchmaking, skipping find-match emission");
      return;
    }

    if (this.socket && this.isConnected && this.playerCreated) {
      console.log("Emitting find-match:", playerData);
      this.inMatchmaking = true;
      this.socket.emit("find-match", playerData || {});
    } else {
      console.error(
        "Socket not connected or player not created, cannot emit find-match"
      );
    }
  }

  createRoom(): void {
    if (this.socket && this.isConnected && this.playerCreated) {
      // Check and fix any room state inconsistencies
      this.checkAndFixRoomState();

      // Check if already in a room and reset if needed
      if (this.isInAnyRoom()) {
        console.warn(
          "Player already in a room, resetting state before creating new room"
        );
        this.forceResetRoomState();
      }

      console.log("Emitting create-room");
      this.socket.emit("create-room");
    } else {
      console.error(
        "Socket not connected or player not created, cannot emit create-room"
      );
    }
  }

  joinRoomByCode(roomCode: string): void {
    if (this.socket && this.isConnected && this.playerCreated) {
      // Check and fix any room state inconsistencies
      this.checkAndFixRoomState();

      // Check if already in a room and reset if needed
      if (this.isInAnyRoom()) {
        console.warn(
          "Player already in a room, resetting state before joining new room"
        );
        this.forceResetRoomState();
      }

      console.log("Emitting join-room-by-code:", roomCode);
      this.socket.emit("join-room-by-code", { roomCode });
    } else {
      console.error(
        "Socket not connected or player not created, cannot emit join-room-by-code"
      );
    }
  }

  emitPlayerReady(): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      // Get player position from global state if available
      let playerPosition = null;
      if (
        typeof window !== "undefined" &&
        (window as any).__HEADBALL_PLAYER_POSITION
      ) {
        playerPosition = (window as any).__HEADBALL_PLAYER_POSITION;
      }

      const readyData = {
        roomId: this.currentRoomId,
        playerPosition: playerPosition,
        socketId: this.socket.id,
        timestamp: Date.now(),
      };

      console.log("Emitting player-ready with data:", readyData);
      this.socket.emit("player-ready", readyData);
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit player-ready"
      );
    }
  }

  leaveRoom(): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting leave-room");
      this.socket.emit("leave-room");
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit leave-room"
      );
    }
  }

  // Input methods - Individual actions matching the backend
  sendMoveLeft(pressed: boolean = true): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting move-left:", { pressed });
      this.socket.emit("move-left", { pressed });
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit move-left"
      );
    }
  }

  // BEGIN EDIT: Restore sendMoveRight, sendJump, sendKick with unified emit logic
  sendMoveRight(pressed: boolean = true): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting move-right:", { pressed });
      this.socket.emit("move-right", { pressed });
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit move-right"
      );
    }
  }

  sendJump(pressed: boolean = true): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting jump:", { pressed });
      this.socket.emit("jump", { pressed });
    } else {
      console.error("Socket not connected or not in room, cannot emit jump");
    }
  }

  sendKick(pressed: boolean = true): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting kick:", { pressed });
      this.socket.emit("kick", { pressed });
    } else {
      console.error("Socket not connected or not in room, cannot emit kick");
    }
  }
  // END EDIT

  // Simplified input method for direct socket emissions
  sendInput(action: string, data: any = {}): void {
    if (!this.socket || !this.isConnected || !this.roomJoined) {
      console.error(
        `Socket not connected or not in room, cannot emit ${action}`
      );
      return;
    }

    console.log(`Emitting ${action}:`, data);
    this.socket.emit(action, data);
  }

  // Enhanced player position synchronization matching demo
  sendPlayerPosition(positionDataOrPosition: any, maybePlayerData?: any): void {
    // BEGIN EDIT: Support both new and legacy signatures
    let payload;
    if (typeof positionDataOrPosition === "string" && maybePlayerData) {
      // Legacy call: (position, playerData)
      payload = {
        position: positionDataOrPosition,
        player: maybePlayerData,
      };
    } else {
      // New call: ({ position, player, ... })
      payload = positionDataOrPosition;
    }

    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting player-position:", payload);
      this.socket.emit("player-position", {
        ...payload,
        timestamp: Date.now(),
      });
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit player-position"
      );
    }
  }
  // END EDIT

  // Enhanced ball state synchronization matching demo
  sendBallState(ballData: {
    ball: {
      x: number;
      y: number;
      velocityX: number;
      velocityY: number;
    };
  }): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting ball-state:", ballData);
      this.socket.emit("ball-state", {
        ...ballData,
        timestamp: Date.now(),
      });
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit ball-state"
      );
    }
  }

  // Goal scoring method matching demo
  scoreGoal(scorer: string): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting goal-scored:", { scorer });
      this.socket.emit("goal-scored", { scorer });
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit goal-scored"
      );
    }
  }

  // Game end method matching demo
  endGame(gameData: {
    finalScore: { player1: number; player2: number };
    duration: number;
    winner: string;
  }): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting game-end:", gameData);
      this.socket.emit("game-end", gameData);
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit game-end"
      );
    }
  }

  // Rematch methods matching demo
  requestRematch(): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting request-rematch");
      this.socket.emit("request-rematch");
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit request-rematch"
      );
    }
  }

  declineRematch(): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting decline-rematch");
      this.socket.emit("decline-rematch");
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit decline-rematch"
      );
    }
  }

  isPlayerCreated(): boolean {
    return this.playerCreated;
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  isInMatchmaking(): boolean {
    return this.inMatchmaking;
  }

  isRoomJoined(): boolean {
    return this.roomJoined;
  }

  getPlayersInRoom(): number {
    return this.playersInRoom;
  }

  getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  getRoomCode(): string | null {
    return this.roomCode;
  }

  getRoomInfo(): {
    roomId: string | null;
    roomCode: string | null;
    playersInRoom: number;
  } {
    return {
      roomId: this.currentRoomId,
      roomCode: this.roomCode,
      playersInRoom: this.playersInRoom,
    };
  }

  cancelMatchmaking(): void {
    if (this.socket && this.isConnected && this.inMatchmaking) {
      console.log("Cancelling matchmaking");
      this.socket.emit("cancel-matchmaking");
      this.inMatchmaking = false;
    }
  }

  // Event listener management
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  // Get socket instance for direct access if needed
  getSocket(): Socket | null {
    return this.socket;
  }

  // Debug method to monitor all socket events
  enableEventMonitoring(): void {
    if (!this.socket) {
      console.warn("Cannot enable event monitoring: socket not connected");
      return;
    }

    console.log("Enabling socket event monitoring...");

    // Monitor all events
    const originalEmit = this.socket.emit.bind(this.socket);
    this.socket.emit = (event: string, ...args: any[]) => {
      console.log(`[SOCKET EMIT] ${event}:`, args);
      return originalEmit(event, ...args);
    };

    // Monitor all incoming events
    const originalOn = this.socket.on.bind(this.socket);
    this.socket.on = (event: string, callback: (...args: any[]) => void) => {
      console.log(`[SOCKET LISTEN] ${event}`);
      return originalOn(event, callback);
    };
  }

  // Disable event monitoring
  disableEventMonitoring(): void {
    if (!this.socket) return;

    console.log("Disabling socket event monitoring...");
    // Note: This is a simplified version. In a real implementation,
    // you'd want to properly restore the original methods
  }

  // Manual reset method for troubleshooting
  forceReconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("Force reconnecting socket...");

      // Disconnect current socket
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      // Reset all state
      this.isConnected = false;
      this.playerCreated = false;
      this.resetMatchmakingState();
      this.connectionStartTime = 0;

      // Reconnect after a short delay
      setTimeout(async () => {
        try {
          await this.connect();
          console.log("Force reconnect successful");
          resolve();
        } catch (error) {
          console.error("Force reconnect failed:", error);
          reject(error);
        }
      }, 1000);
    });
  }

  // Public method to get connection status and health
  getConnectionHealth(): {
    connected: boolean;
    playerCreated: boolean;
    roomJoined: boolean;
    inMatchmaking: boolean;
    connectionDuration: number;
    socketId: string | null;
  } {
    return {
      connected: this.isConnected,
      playerCreated: this.playerCreated,
      roomJoined: this.roomJoined,
      inMatchmaking: this.inMatchmaking,
      connectionDuration: this.getConnectionDuration(),
      socketId: this.socket?.id || null,
    };
  }

  private getConnectionDuration(): number {
    if (!this.socket) return 0;
    const connectTime = this.connectionStartTime;
    const currentTime = Date.now();
    return (currentTime - connectTime) / 1000;
  }
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
