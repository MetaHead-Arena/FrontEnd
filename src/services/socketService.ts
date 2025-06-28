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
  private eventListeners: Map<string, Function[]> = new Map();

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

      this.socket = io(backendUrl, {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
      });

      this.socket.on("connect", () => {
        console.log("Socket connected:", this.socket?.id);
        this.isConnected = true;
        resolve(this.socket!);
      });

      this.socket.on("disconnect", () => {
        console.log("Socket disconnected");
        this.isConnected = false;
        this.playerCreated = false;
        this.resetMatchmakingState();
      });

      this.socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        reject(error);
      });

      // Listen for player-created event
      this.socket.on("player-created", (data) => {
        console.log("Player created:", data);
        this.playerCreated = true;
        this.emit("player-created", data);
      });

      // Listen for matchmaking events
      this.socket.on("room-joined", (data) => {
        console.log("Room joined:", data);
        this.roomJoined = true;
        this.inMatchmaking = false; // Stop matchmaking when room is joined
        this.currentRoomId = data.roomId || data.id;
        // Backend sends players array, so use players.length
        this.playersInRoom = data.players ? data.players.length : 1;
        this.emit("room-joined", data);
      });

      this.socket.on("player-joined-room", (data) => {
        console.log("Player joined room:", data);
        // Update player count from the data
        this.playersInRoom = data.players
          ? data.players.length
          : data.playersCount || this.playersInRoom + 1;
        this.emit("player-joined-room", data);
      });

      this.socket.on("player-ready", (data) => {
        console.log("Player ready:", data);
        this.emit("player-ready", data);
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

  emitPlayerReady(): void {
    if (this.socket && this.isConnected && this.roomJoined) {
      console.log("Emitting player-ready");
      this.socket.emit("player-ready", { roomId: this.currentRoomId });
    } else {
      console.error(
        "Socket not connected or not in room, cannot emit player-ready"
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
}

// Export singleton instance
export const socketService = new SocketService();
export default socketService;
