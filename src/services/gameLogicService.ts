// @ts-nocheck

import { socketService } from "./socketService";

/**
 * MetaHead Arena - Complete Game Logic Service
 * Handles all multiplayer game functionality including player management,
 * room handling, game state synchronization, and input handling
 */

export interface PlayerState {
  id: string;
  username: string;
  position: "player1" | "player2";
  isReady: boolean;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  isOnGround: boolean;
  direction: "idle" | "left" | "right";
}

export interface BallState {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
}

export interface GameState {
  isActive: boolean;
  gameTime: number;
  score: { player1: number; player2: number };
  matchId: string | null;
  roomId: string | null;
  roomCode: string | null;
  players: PlayerState[];
  ball: BallState;
  isBallAuthority: boolean;
  playerPosition: "player1" | "player2" | null;
}

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  kick: boolean;
}

class GameLogicService {
  // Connection State
  private socket: any = null;
  private isConnected: boolean = false;
  private playerId: string | null = null;
  private serverTime: number | null = null;

  // Player State
  private walletAddress: string | null = null;
  private username: string = "Anonymous";
  private isInGame: boolean = false;

  // Room State
  private roomId: string | null = null;
  private roomCode: string | null = null;
  private roomType: string | null = null;
  private gameMode: string = "1v1";
  private isReady: boolean = false;
  private playersInRoom: PlayerState[] = [];
  private playerPosition: "player1" | "player2" | null = null;
  private isBallAuthority: boolean = false;

  // Game State
  private gameActive: boolean = false;
  private score: { player1: number; player2: number } = {
    player1: 0,
    player2: 0,
  };
  private gameTime: number = 60;
  private matchId: string | null = null;

  // Physics State (Frontend-managed)
  private players: {
    player1: PlayerState;
    player2: PlayerState;
  } = {
    player1: {
      id: "",
      username: "Player 1",
      position: "player1",
      isReady: false,
      x: 150,
      y: 320,
      velocityX: 0,
      velocityY: 0,
      isOnGround: true,
      direction: "idle",
    },
    player2: {
      id: "",
      username: "Player 2",
      position: "player2",
      isReady: false,
      x: 650,
      y: 320,
      velocityX: 0,
      velocityY: 0,
      isOnGround: true,
      direction: "idle",
    },
  };

  private ball: BallState = {
    x: 400,
    y: 300,
    velocityX: 0,
    velocityY: 0,
  };

  // Input State
  private input: InputState = {
    left: false,
    right: false,
    jump: false,
    kick: false,
  };
  private keys: { [key: string]: boolean } = {};

  // Physics Constants
  private physics = {
    gravity: 0.5,
    friction: 0.88,
    airResistance: 0.99,
    ballBounce: 0.75,
    playerSpeed: 4,
    jumpPower: 12,
    groundLevel: 320,
  };

  // Game Loop
  private gameLoop: number | null = null;
  private ballBroadcastCounter: number = 0;
  private playerBroadcastCounter: number = 0;

  // Match History
  private matchHistory: any[] = [];

  // Rematch State
  private rematchRequested: boolean = false;
  private rematchState: any = null;

  // Event Listeners
  private eventListeners: Map<string, Function[]> = new Map();

  constructor() {
    // Prevent automatic initialization unless explicitly requested.
    if (
      typeof window !== "undefined" &&
      (window as any).__ENABLE_GAMELOGIC_SERVICE === true
    ) {
      this.init();
    } else {
      // Skip initialization to avoid duplicate socket/physics loops
      console.info("GameLogicService auto-init disabled");
    }
  }

  private init(): void {
    this.connectSocket();
    this.setupEventListeners();
    this.setupKeyboardControls();
    this.startGameLoop();
    this.logEvent("info", "Game Logic Service initialized");
  }

  // ============ SOCKET CONNECTION & EVENT HANDLERS ============

  private connectSocket(): void {
    this.socket = socketService.getSocket();
    if (!this.socket) {
      console.error("Socket not available");
      return;
    }

    this.isConnected = true;
    this.playerId = this.socket.id;

    // Listen for all the events from the socket service
    this.setupSocketEventListeners();
  }

  private setupSocketEventListeners(): void {
    if (!this.socket) return;

    // Connection Events
    this.socket.on("connect", () => {
      this.isConnected = true;
      this.playerId = this.socket.id;
      this.logEvent(
        "success",
        `Connected to server with socket ID: ${this.socket.id}`
      );
    });

    this.socket.on("disconnect", (reason: string) => {
      this.isConnected = false;
      this.logEvent("error", `Disconnected from server: ${reason}`);
      this.resetGameState();
    });

    this.socket.on("welcome", (data: any) => {
      this.playerId = data.playerId;
      this.serverTime = data.serverTime;

      if (data.authenticated && data.walletAddress) {
        this.walletAddress = data.walletAddress;
        this.username =
          data.walletAddress.slice(0, 6) + "..." + data.walletAddress.slice(-4);
      }

      this.logEvent("socket", `Welcome message received`, data);
    });

    // Player Events
    this.socket.on("player-created", (data: any) => {
      this.logEvent(
        "success",
        `Player created: ${data.player?.username}`,
        data
      );
      if (data.user) {
        this.username = data.user.walletAddress.slice(0, 6) + "...";
      }
    });

    // Room Events
    this.socket.on("room-created", (data: any) => {
      this.handleRoomJoined(data);
      this.logEvent("success", `Room created: ${data.roomCode}`, data);
    });

    this.socket.on("room-joined", (data: any) => {
      this.handleRoomJoined(data);
      this.logEvent("success", `Joined room: ${data.roomCode}`, data);
    });

    this.socket.on("player-joined-room", (data: any) => {
      this.updatePlayersInRoom();
      this.logEvent(
        "info",
        `Player joined room: ${data.player?.username}`,
        data
      );
    });

    this.socket.on("room-full", (data: any) => {
      this.logEvent("warning", "Room is full - ready up to start!", data);
    });

    this.socket.on("left-room", (data: any) => {
      this.handleRoomLeft();
      this.logEvent("info", `Left room: ${data.roomId}`, data);
    });

    this.socket.on("player-left", (data: any) => {
      this.updatePlayersInRoom();
      this.logEvent("warning", `Player left: ${data.username}`, data);
    });

    // Game Events
    this.socket.on("player-ready", (data: any) => {
      this.handlePlayerReady(data);
      this.logEvent(
        "info",
        `Player ready: ${data.username} (${
          data.isReady ? "ready" : "not ready"
        })`,
        data
      );
    });

    this.socket.on("game-started", (data: any) => {
      this.handleGameStarted(data);
      this.logEvent("success", "Game started!", data);
    });

    this.socket.on("match-ended", (data: any) => {
      this.handleMatchEnded(data);
      this.logEvent("success", `Match ended - Winner: ${data.winner}`, data);
    });

    this.socket.on("goal-scored", (data: any) => {
      this.handleGoalScored(data);
      this.logEvent("success", `Goal scored by ${data.scorer}!`, data);
    });

    // Input Events
    this.socket.on("player-input", (data: any) => {
      this.handleRemotePlayerInput(data);
      this.logEvent(
        "socket",
        `Input from ${data.username}: ${data.action}`,
        data
      );
    });

    // Ball Synchronization Events
    this.socket.on("ball-state", (data: any) => {
      this.handleBallStateUpdate(data);
    });

    // Player Position Synchronization Events
    this.socket.on("player-position", (data: any) => {
      this.handlePlayerPositionUpdate(data);
    });

    // Rematch Events
    this.socket.on("rematch-request", (data: any) => {
      this.handleRematchRequest(data);
      this.logEvent("info", "Rematch requested", data);
    });

    this.socket.on("rematch-confirmed", (data: any) => {
      this.handleRematchConfirmed(data);
      this.logEvent("success", "Rematch confirmed - starting new game!", data);
    });

    this.socket.on("rematch-declined", (data: any) => {
      this.handleRematchDeclined(data);
      this.logEvent("warning", "Rematch declined", data);
    });

    // Error Events
    this.socket.on("error", (data: any) => {
      this.logEvent("error", data.message, data);
    });
  }

  // ============ EVENT HANDLERS ============

  private handleRoomJoined(data: any): void {
    this.roomId = data.roomId;
    this.roomCode = data.roomCode;
    this.roomType = data.roomType;
    this.gameMode = data.gameMode;
    this.playersInRoom = data.players || [];

    // Determine player position
    const thisPlayer = this.playersInRoom.find(
      (p: PlayerState) => p.id === this.playerId
    );
    if (thisPlayer) {
      this.playerPosition = thisPlayer.position;
      this.isBallAuthority = this.playerPosition === "player1"; // Player 1 is ball authority
      this.logEvent("info", `You are ${this.playerPosition}`);
      if (this.isBallAuthority) {
        this.logEvent(
          "info",
          "You are the ball authority - managing ball physics"
        );
      }
    }

    this.emit("room-joined", data);
  }

  private handleRoomLeft(): void {
    this.roomId = null;
    this.roomCode = null;
    this.roomType = null;
    this.isReady = false;
    this.playersInRoom = [];
    this.playerPosition = null;
    this.isBallAuthority = false;

    this.emit("room-left");
  }

  private handlePlayerReady(data: any): void {
    if (data.playerId === this.playerId) {
      this.isReady = data.isReady;
    }

    this.emit("player-ready", data);
  }

  private handleGameStarted(data: any): void {
    this.gameActive = true;
    this.gameTime = data.matchDuration || 60;
    this.matchId = data.room?.matchId;

    // Reset broadcast counters for fresh synchronization
    this.ballBroadcastCounter = 0;
    this.playerBroadcastCounter = 0;

    this.emit("game-started", data);
  }

  private handleMatchEnded(data: any): void {
    this.gameActive = false;
    this.score = data.finalScore;
    this.matchId = data.matchId;

    // Add to match history
    this.addToMatchHistory({
      score: data.finalScore,
      duration: data.duration,
      winner: data.winner,
      timestamp: new Date(),
    });

    this.emit("match-ended", data);
  }

  private handleGoalScored(data: any): void {
    this.score = data.newScore || data.score;
    this.resetPositions();
    this.emit("goal-scored", data);
  }

  private handleRematchRequest(data: any): void {
    this.rematchState = data.rematchState;
    this.emit("rematch-request", data);
  }

  private handleRematchConfirmed(data: any): void {
    this.resetGameState();
    this.emit("rematch-confirmed", data);
  }

  private handleRematchDeclined(data: any): void {
    this.emit("rematch-declined", data);
    setTimeout(() => {
      this.handleRoomLeft();
    }, 3000);
  }

  private handleRemotePlayerInput(data: any): void {
    // This method is no longer used for physics - kept for compatibility
    // Position synchronization now happens through handlePlayerPositionUpdate()
    return;
  }

  private handlePlayerPositionUpdate(data: any): void {
    // Only update remote player positions, not our own
    if (
      !data.position ||
      data.position === this.playerPosition ||
      !this.gameActive
    ) {
      return;
    }

    const remotePlayer = this.players[data.position];
    if (!remotePlayer) return;

    // Apply received position with interpolation to smooth network jitter
    const lerpFactor = 0.7;

    remotePlayer.x =
      remotePlayer.x * (1 - lerpFactor) + data.player.x * lerpFactor;
    remotePlayer.y =
      remotePlayer.y * (1 - lerpFactor) + data.player.y * lerpFactor;
    remotePlayer.velocityX =
      remotePlayer.velocityX * (1 - lerpFactor) +
      data.player.velocityX * lerpFactor;
    remotePlayer.velocityY =
      remotePlayer.velocityY * (1 - lerpFactor) +
      data.player.velocityY * lerpFactor;
    remotePlayer.direction = data.player.direction;
    remotePlayer.isOnGround = data.player.isOnGround;

    this.emit("player-position-updated", data);
  }

  private handleBallStateUpdate(data: any): void {
    // Only non-authority players should receive and apply ball state updates
    if (this.isBallAuthority || !this.gameActive) return;

    // Apply received ball state with some interpolation to smooth out network jitter
    const lerpFactor = 0.8;

    this.ball.x = this.ball.x * (1 - lerpFactor) + data.ball.x * lerpFactor;
    this.ball.y = this.ball.y * (1 - lerpFactor) + data.ball.y * lerpFactor;
    this.ball.velocityX =
      this.ball.velocityX * (1 - lerpFactor) + data.ball.velocityX * lerpFactor;
    this.ball.velocityY =
      this.ball.velocityY * (1 - lerpFactor) + data.ball.velocityY * lerpFactor;

    this.emit("ball-state-updated", data);
  }

  // ============ FRONTEND PHYSICS ENGINE ============

  private startGameLoop(): void {
    this.gameLoop = window.setInterval(() => {
      if (this.gameActive) {
        this.updatePhysics();

        // Only ball authority handles collisions to avoid conflicts
        if (this.isBallAuthority) {
          this.checkCollisions();
        }

        this.updateTimer();
      }
      this.renderGame();
    }, 16); // 60 FPS
  }

  private updatePhysics(): void {
    // Each player only updates their own physics
    if (this.playerPosition) {
      this.updatePlayerPhysics(this.playerPosition);
      this.broadcastPlayerPosition();
    }

    // Only the ball authority updates ball physics
    if (this.isBallAuthority) {
      this.updateBallPhysics();
      this.broadcastBallState();
    }
  }

  private updatePlayerPhysics(playerKey: "player1" | "player2"): void {
    const player = this.players[playerKey];

    // Apply gravity
    if (!player.isOnGround) {
      player.velocityY += this.physics.gravity;
    }

    // Apply movement input
    if (this.input.left) {
      player.velocityX = -this.physics.playerSpeed;
      player.direction = "left";
    } else if (this.input.right) {
      player.velocityX = this.physics.playerSpeed;
      player.direction = "right";
    } else {
      player.velocityX *= this.physics.friction;
      player.direction = "idle";
    }

    // Apply air resistance
    player.velocityX *= this.physics.airResistance;
    player.velocityY *= this.physics.airResistance;

    // Update position
    player.x += player.velocityX;
    player.y += player.velocityY;

    // Ground collision
    if (player.y >= this.physics.groundLevel) {
      player.y = this.physics.groundLevel;
      player.velocityY = 0;
      player.isOnGround = true;
    } else {
      player.isOnGround = false;
    }

    // Wall boundaries
    if (player.x < 25) player.x = 25;
    if (player.x > 775) player.x = 775;
  }

  private updateBallPhysics(): void {
    // Apply gravity
    this.ball.velocityY += this.physics.gravity;

    // Apply air resistance
    this.ball.velocityX *= this.physics.airResistance;
    this.ball.velocityY *= this.physics.airResistance;

    // Update position
    this.ball.x += this.ball.velocityX;
    this.ball.y += this.ball.velocityY;

    // Ground collision
    if (this.ball.y >= this.physics.groundLevel + 15) {
      this.ball.y = this.physics.groundLevel + 15;
      this.ball.velocityY *= -this.physics.ballBounce;
      this.ball.velocityX *= this.physics.friction;
    }

    // Wall collisions
    if (this.ball.x <= 15) {
      this.ball.x = 15;
      this.ball.velocityX *= -0.8;
    }
    if (this.ball.x >= 785) {
      this.ball.x = 785;
      this.ball.velocityX *= -0.8;
    }

    // Ceiling collision
    if (this.ball.y <= 15) {
      this.ball.y = 15;
      this.ball.velocityY *= -this.physics.ballBounce;
    }
  }

  private checkCollisions(): void {
    // Player-ball collisions
    ["player1", "player2"].forEach((playerKey) => {
      const player = this.players[playerKey as "player1" | "player2"];
      const dx = player.x - this.ball.x;
      const dy = player.y - this.ball.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 35) {
        const kickPower = 8;
        const normalizedX = dx / distance;
        const normalizedY = dy / distance;

        this.ball.velocityX = -normalizedX * kickPower;
        this.ball.velocityY = -normalizedY * kickPower * 0.7;

        this.ball.x -= normalizedX * 30;
        this.ball.y -= normalizedY * 30;
      }
    });

    this.checkGoals();
  }

  private checkGoals(): void {
    // Left goal (player2 scores)
    if (this.ball.x <= 0 && this.ball.y >= 250 && this.ball.y <= 390) {
      this.handleLocalGoal("player2");
    }
    // Right goal (player1 scores)
    if (this.ball.x >= 800 && this.ball.y >= 250 && this.ball.y <= 390) {
      this.handleLocalGoal("player1");
    }
  }

  private handleLocalGoal(scorer: "player1" | "player2"): void {
    this.logEvent("success", `Local goal detected: ${scorer} scored!`);
    if (this.socket && this.isConnected) {
      this.socket.emit("goal-scored", { scorer: scorer });
    }
    this.resetPositions();
  }

  private resetPositions(): void {
    this.players.player1 = {
      ...this.players.player1,
      x: 150,
      y: 320,
      velocityX: 0,
      velocityY: 0,
      isOnGround: true,
      direction: "idle",
    };
    this.players.player2 = {
      ...this.players.player2,
      x: 650,
      y: 320,
      velocityX: 0,
      velocityY: 0,
      isOnGround: true,
      direction: "idle",
    };
    this.ball = { x: 400, y: 250, velocityX: 0, velocityY: 0 };
  }

  private updateTimer(): void {
    this.gameTime -= 0.016;
    if (this.gameTime <= 0) {
      this.gameTime = 0;
      this.endGame();
    }
  }

  private endGame(): void {
    if (!this.gameActive) return;

    this.gameActive = false;
    let winner = "draw";
    if (this.score.player1 > this.score.player2) winner = "player1";
    if (this.score.player2 > this.score.player1) winner = "player2";

    if (this.socket && this.isConnected) {
      this.socket.emit("game-end", {
        finalScore: this.score,
        duration: 60 - this.gameTime,
        winner: winner,
      });
    }

    this.logEvent("success", `Time's up! Winner: ${winner}`);
  }

  private renderGame(): void {
    // Update game state for external consumers
    const gameState: GameState = {
      isActive: this.gameActive,
      gameTime: this.gameTime,
      score: this.score,
      matchId: this.matchId,
      roomId: this.roomId,
      roomCode: this.roomCode,
      players: [this.players.player1, this.players.player2],
      ball: this.ball,
      isBallAuthority: this.isBallAuthority,
      playerPosition: this.playerPosition,
    };

    this.emit("game-state-updated", gameState);
  }

  // ============ INPUT HANDLING ============

  private setupKeyboardControls(): void {
    document.addEventListener("keydown", (e) => {
      if (!this.gameActive || !this.playerPosition) return;

      const key = e.key.toLowerCase();
      if (this.keys[key]) return;
      this.keys[key] = true;

      let inputSent = false;

      switch (key) {
        case "a":
        case "arrowleft":
          this.input.left = true;
          this.sendInput("move-left", { pressed: true });
          inputSent = true;
          break;
        case "d":
        case "arrowright":
          this.input.right = true;
          this.sendInput("move-right", { pressed: true });
          inputSent = true;
          break;
        case "w":
        case "arrowup":
        case " ":
          if (this.players[this.playerPosition].isOnGround) {
            this.players[this.playerPosition].velocityY =
              -this.physics.jumpPower;
            this.players[this.playerPosition].isOnGround = false;
            this.sendInput("jump", { pressed: true });
            inputSent = true;
          }
          break;
        case "s":
        case "arrowdown":
          this.sendInput("kick", { pressed: true });
          inputSent = true;
          break;
      }

      if (inputSent) e.preventDefault();
    });

    document.addEventListener("keyup", (e) => {
      if (!this.gameActive || !this.playerPosition) return;

      const key = e.key.toLowerCase();
      this.keys[key] = false;

      switch (key) {
        case "a":
        case "arrowleft":
          this.input.left = false;
          this.sendInput("move-left", { pressed: false });
          break;
        case "d":
        case "arrowright":
          this.input.right = false;
          this.sendInput("move-right", { pressed: false });
          break;
      }
    });
  }

  private sendInput(action: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(action, data);
    }
  }

  private broadcastBallState(): void {
    // Only broadcast if we're the ball authority and connected
    if (
      !this.isBallAuthority ||
      !this.socket ||
      !this.isConnected ||
      !this.gameActive
    ) {
      return;
    }

    // Throttle ball state broadcasts to avoid spam (every 2nd frame)
    this.ballBroadcastCounter++;
    if (this.ballBroadcastCounter % 2 !== 0) return;

    this.socket.emit("ball-state", {
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        velocityX: this.ball.velocityX,
        velocityY: this.ball.velocityY,
      },
      timestamp: Date.now(),
    });
  }

  private broadcastPlayerPosition(): void {
    // Only broadcast if we have a position and are connected
    if (
      !this.playerPosition ||
      !this.socket ||
      !this.isConnected ||
      !this.gameActive
    ) {
      return;
    }

    // Throttle player position broadcasts to avoid spam (every 3rd frame)
    this.playerBroadcastCounter++;
    if (this.playerBroadcastCounter % 3 !== 0) return;

    const player = this.players[this.playerPosition];

    this.socket.emit("player-position", {
      position: this.playerPosition,
      player: {
        x: player.x,
        y: player.y,
        velocityX: player.velocityX,
        velocityY: player.velocityY,
        direction: player.direction,
        isOnGround: player.isOnGround,
      },
      timestamp: Date.now(),
    });
  }

  // ============ PUBLIC API ============

  // Game Actions
  public findMatch(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("find-match");
      this.logEvent("socket", "Finding match...");
    }
  }

  public createRoom(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("create-room");
      this.logEvent("socket", "Creating room...");
    }
  }

  public joinRoomByCode(roomCode: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("join-room-by-code", { roomCode });
      this.logEvent("socket", `Attempting to join room: ${roomCode}`);
    }
  }

  public toggleReady(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("player-ready");
      this.logEvent("socket", "Toggling ready status...");
    }
  }

  public leaveRoom(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("leave-room");
      this.logEvent("socket", "Leaving room...");
    }
  }

  public requestRematch(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("request-rematch");
      this.rematchRequested = true;
      this.logEvent("socket", "Requesting rematch...");
    }
  }

  public declineRematch(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("decline-rematch");
      this.logEvent("socket", "Declining rematch...");
    }
  }

  // State Getters
  public getGameState(): GameState {
    return {
      isActive: this.gameActive,
      gameTime: this.gameTime,
      score: this.score,
      matchId: this.matchId,
      roomId: this.roomId,
      roomCode: this.roomCode,
      players: [this.players.player1, this.players.player2],
      ball: this.ball,
      isBallAuthority: this.isBallAuthority,
      playerPosition: this.playerPosition,
    };
  }

  public getPlayerPosition(): "player1" | "player2" | null {
    return this.playerPosition;
  }

  public isGameActive(): boolean {
    return this.gameActive;
  }

  public isBallAuthority(): boolean {
    return this.isBallAuthority;
  }

  public getRoomInfo(): {
    roomId: string | null;
    roomCode: string | null;
    playersInRoom: number;
  } {
    return {
      roomId: this.roomId,
      roomCode: this.roomCode,
      playersInRoom: this.playersInRoom.length,
    };
  }

  // Event Management
  public on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  public off(event: string, callback: Function): void {
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

  // Utility Methods
  private updatePlayersInRoom(): void {
    // This would be called when players join/leave
    this.emit("players-updated", this.playersInRoom);
  }

  private addToMatchHistory(match: any): void {
    this.matchHistory.unshift(match);
    this.emit("match-history-updated", this.matchHistory);
  }

  private resetGameState(): void {
    this.gameActive = false;
    this.isReady = false;
    this.score = { player1: 0, player2: 0 };
    this.gameTime = 60;
    this.matchId = null;
    this.isBallAuthority = false;

    // Reset broadcast counters
    this.ballBroadcastCounter = 0;
    this.playerBroadcastCounter = 0;

    this.resetPositions();
    this.emit("game-state-reset");
  }

  private logEvent(type: string, message: string, data?: any): void {
    console.log(`[${type.toUpperCase()}] ${message}`, data || "");
    this.emit("log", { type, message, data });
  }

  // Cleanup
  public destroy(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }

    // Remove keyboard listeners
    document.removeEventListener("keydown", this.setupKeyboardControls);
    document.removeEventListener("keyup", this.setupKeyboardControls);

    this.eventListeners.clear();
  }

  // Placeholder methods to satisfy the interface
  private setupEventListeners(): void {
    // This will be called from init but doesn't need to do anything specific
  }
}

// Preserve default export for potential manual use
export default GameLogicService;
