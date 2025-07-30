import { logger } from "../../lib/logger.js";

/**
 * NetworkManager - Handles all socket communication and backend integration
 */
export class NetworkManager {
  constructor(scene, gameState, playerManager, ballManager) {
    this.scene = scene;
    this.gameState = gameState;
    this.playerManager = playerManager;
    this.ballManager = ballManager;
    
    // Socket service
    this.socketService = null;
    
    // Connection state
    this.connected = false;
    this.roomJoined = false;
    
    // Message throttling
    this.throttleMap = new Map();
    this.throttleConfig = {
      playerPosition: 33, // 30 FPS max
      ballState: 33,      // 30 FPS max
      playerInput: 16,    // 60 FPS max
    };
    
    // Message batching
    this.messageQueue = [];
    this.batchSize = 10;
    this.processingInterval = null;
    
    // Reconnection handling
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    
    logger.debug("NetworkManager initialized");
  }
  
  async initialize() {
    logger.debug("NetworkManager initializing");
    
    try {
      // Import socket service dynamically to avoid SSR issues
      if (typeof window !== "undefined") {
        const { socketService } = await import("../../../services/socketService");
        this.socketService = socketService;
        
        // Connect if not already connected
        if (!this.socketService.isSocketConnected()) {
          logger.debug("Connecting to socket server");
          await this.socketService.connect();
        }
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Start message processing
        this.startMessageProcessing();
        
        // Join game
        this.socketService.joinGame({});
        
        this.connected = true;
        logger.info("NetworkManager initialized successfully");
        
      } else {
        throw new Error("Socket service not available in SSR environment");
      }
      
    } catch (error) {
      logger.error("Failed to initialize NetworkManager", { error: error.message });
      throw error;
    }
  }
  
  setupEventListeners() {
    if (!this.socketService) return;
    
    logger.debug("Setting up socket event listeners");
    
    // Connection events
    this.socketService.on("welcome", this.handleWelcome.bind(this));
    this.socketService.on("player-created", this.handlePlayerCreated.bind(this));
    
    // Room events
    this.socketService.on("room-joined", this.handleRoomJoined.bind(this));
    this.socketService.on("room-created", this.handleRoomCreated.bind(this));
    
    // Game state events
    this.socketService.on("game-started", this.handleGameStarted.bind(this));
    this.socketService.on("game-ended", this.handleGameEnded.bind(this));
    this.socketService.on("match-ended", this.handleMatchEnded.bind(this));
    this.socketService.on("goal-scored", this.handleGoalScored.bind(this));
    
    // Player events
    this.socketService.on("player-ready", this.handlePlayerReady.bind(this));
    this.socketService.on("all-players-ready", this.handleAllPlayersReady.bind(this));
    this.socketService.on("player-position", this.handlePlayerPosition.bind(this));
    
    // Ball events
    this.socketService.on("ball-state", this.handleBallState.bind(this));
    
    // Game state synchronization
    this.socketService.on("game-state", this.handleGameState.bind(this));
    
    // Timer events
    this.socketService.on("timer-update", this.handleTimerUpdate.bind(this));
    this.socketService.on("game-time", this.handleGameTime.bind(this));
    this.socketService.on("timer-warning", this.handleTimerWarning.bind(this));
    this.socketService.on("time-up", this.handleTimeUp.bind(this));
    
    // Input events
    this.socketService.on("move-left", this.handleMoveLeft.bind(this));
    this.socketService.on("move-right", this.handleMoveRight.bind(this));
    this.socketService.on("jump", this.handleJump.bind(this));
    this.socketService.on("kick", this.handleKick.bind(this));
    this.socketService.on("player-input", this.handlePlayerInput.bind(this));
    
    // Pause/Resume events
    this.socketService.on("game-paused", this.handleGamePaused.bind(this));
    this.socketService.on("game-resumed", this.handleGameResumed.bind(this));
    
    // Rematch events
    this.socketService.on("rematch-requested", this.handleRematchRequested.bind(this));
    this.socketService.on("rematch-confirmed", this.handleRematchConfirmed.bind(this));
    this.socketService.on("rematch-declined", this.handleRematchDeclined.bind(this));
    
    // Connection state events
    this.socketService.on("disconnected", this.handleDisconnected.bind(this));
    this.socketService.on("reconnected", this.handleReconnected.bind(this));
    this.socketService.on("error", this.handleError.bind(this));
    
    logger.debug("Socket event listeners configured");
  }
  
  // Message processing system
  startMessageProcessing() {
    if (this.processingInterval) return;
    
    this.processingInterval = setInterval(() => {
      this.processMessageQueue();
    }, 50); // Process every 50ms
    
    logger.debug("Message processing started");
  }
  
  stopMessageProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.debug("Message processing stopped");
    }
  }
  
  processMessageQueue() {
    if (this.messageQueue.length === 0) return;
    
    const batch = this.messageQueue.splice(0, this.batchSize);
    
    batch.forEach(message => {
      try {
        this.socketService.getSocket().emit(message.event, message.data);
      } catch (error) {
        logger.error("Failed to send queued message", { 
          event: message.event, 
          error: error.message 
        });
      }
    });
    
    if (batch.length > 0) {
      logger.debug("Processed message batch", { count: batch.length });
    }
  }
  
  // Throttled sending
  emitThrottled(event, data) {
    const now = Date.now();
    const throttleTime = this.throttleConfig[event] || 100;
    const lastSent = this.throttleMap.get(event) || 0;
    
    if (now - lastSent >= throttleTime) {
      this.socketService.getSocket().emit(event, data);
      this.throttleMap.set(event, now);
      return true;
    }
    
    return false;
  }
  
  // Queued sending
  emitQueued(event, data) {
    this.messageQueue.push({ event, data, timestamp: Date.now() });
  }
  
  // Direct sending
  emit(event, data) {
    if (!this.isConnected()) {
      logger.warn("Cannot emit - not connected", { event });
      return false;
    }
    
    try {
      this.socketService.getSocket().emit(event, data);
      return true;
    } catch (error) {
      logger.error("Failed to emit message", { event, error: error.message });
      return false;
    }
  }
  
  // Connection status
  isConnected() {
    return this.connected && this.socketService?.isSocketConnected();
  }
  
  isRoomJoined() {
    return this.roomJoined && this.socketService?.isRoomJoined();
  }
  
  // Game actions
  sendPlayerReady() {
    if (!this.isConnected()) {
      throw new Error("Not connected to server");
    }
    
    logger.debug("Sending player ready");
    this.socketService.emitPlayerReady();
  }
  
  sendPlayerPosition(data) {
    if (!this.isConnected() || !this.gameState.canPlay()) return;
    
    this.emitThrottled("player-position", data);
  }
  
  sendBallState(data) {
    if (!this.isConnected() || !this.gameState.canPlay()) return;
    
    this.emitThrottled("ball-state", data);
  }
  
  sendMoveLeft(pressed) {
    this.emitThrottled("move-left", { pressed });
  }
  
  sendMoveRight(pressed) {
    this.emitThrottled("move-right", { pressed });
  }
  
  sendJump(pressed) {
    this.emitThrottled("jump", { pressed });
  }
  
  sendKick(pressed) {
    this.emitThrottled("kick", { pressed });
  }
  
  sendGamePause() {
    this.emit("game-pause", {
      roomId: this.socketService.getCurrentRoomId(),
      pausedBy: this.scene.playerPosition
    });
  }
  
  sendGameResume() {
    this.emit("game-resume", {
      roomId: this.socketService.getCurrentRoomId(),
      resumedBy: this.scene.playerPosition
    });
  }
  
  requestTimerSync(data) {
    this.emit("request-timer-sync", {
      roomId: this.socketService.getCurrentRoomId(),
      ...data
    });
  }
  
  scoreGoal(scorer) {
    this.emit("goal-scored", {
      scorer,
      timestamp: Date.now()
    });
  }
  
  requestRematch() {
    this.emit("rematch-request", {
      roomId: this.socketService.getCurrentRoomId()
    });
  }
  
  declineRematch() {
    this.emit("rematch-decline", {
      roomId: this.socketService.getCurrentRoomId()
    });
  }
  
  leaveRoom() {
    this.emit("leave-room", {
      roomId: this.socketService.getCurrentRoomId()
    });
  }
  
  // Event handlers
  handleWelcome(data) {
    logger.info("Welcome message received", data);
    
    if (data.authenticated) {
      logger.info("Player authenticated successfully");
    } else {
      logger.warn("Player not authenticated");
    }
  }
  
  handlePlayerCreated(data) {
    logger.debug("Player created", data);
  }
  
  handleRoomJoined(data) {
    logger.info("Room joined", data);
    
    this.roomJoined = true;
    
    // Update player position from backend
    if (data.playerPosition) {
      this.scene.playerPosition = data.playerPosition;
      
      if (typeof window !== "undefined") {
        window.__HEADBALL_PLAYER_POSITION = data.playerPosition;
      }
      
      // Rebuild players if position changed
      this.playerManager.updatePlayerPosition(data.playerPosition);
    }
    
    // Notify scene
    this.scene.onRoomJoined?.(data);
  }
  
  handleRoomCreated(data) {
    logger.info("Room created", data);
    this.handleRoomJoined(data);
  }
  
  handleGameStarted(data) {
    logger.info("Game started", data);
    this.scene.onGameStarted(data);
  }
  
  handleGameEnded(data) {
    logger.info("Game ended", data);
    this.scene.onGameEnded(data);
  }
  
  handleMatchEnded(data) {
    logger.info("Match ended", data);
    this.scene.onGameEnded(data);
  }
  
  handleGoalScored(data) {
    logger.info("Goal scored", data);
    this.scene.onGoalScored(data.scorer, data);
  }
  
  handlePlayerReady(data) {
    logger.debug("Player ready", data);
    this.scene.onPlayerReady(data);
  }
  
  handleAllPlayersReady(data) {
    logger.info("All players ready", data);
    this.scene.onAllPlayersReady(data);
  }
  
  handlePlayerPosition(data) {
    // Only process if it's not our own position
    if (data.position !== this.scene.playerPosition) {
      this.scene.onPlayerPositionUpdate(data);
    }
  }
  
  handleBallState(data) {
    this.scene.onBallStateUpdate(data);
  }
  
  handleGameState(data) {
    if (data.gameState) {
      // Update timer
      if (data.gameState.timeRemaining !== undefined) {
        this.gameState.updateTimer(data.gameState.timeRemaining);
      }
      
      // Update scores
      if (data.gameState.score) {
        if (data.gameState.score.player1 !== undefined) {
          this.gameState.player1Score = data.gameState.score.player1;
        }
        if (data.gameState.score.player2 !== undefined) {
          this.gameState.player2Score = data.gameState.score.player2;
        }
      }
      
      // Update ball state
      if (data.gameState.ball && !this.ballManager.isBallAuthority()) {
        this.ballManager.syncBallState(data.gameState.ball);
      }
      
      // Update player positions
      if (data.gameState.players) {
        Object.keys(data.gameState.players).forEach(playerId => {
          const playerData = data.gameState.players[playerId];
          
          // Skip our own player
          if (playerId === this.socketService?.getSocket()?.id) return;
          
          this.playerManager.updateRemotePlayer(playerData);
        });
      }
    }
  }
  
  handleTimerUpdate(data) {
    if (data.timeRemaining !== undefined) {
      this.gameState.updateTimer(data.timeRemaining);
    }
  }
  
  handleGameTime(data) {
    if (data.timeRemaining !== undefined) {
      this.gameState.updateTimer(data.timeRemaining);
    } else if (data.gameTime !== undefined) {
      this.gameState.updateTimer(data.gameTime);
    }
  }
  
  handleTimerWarning(data) {
    if (data.timeRemaining !== undefined) {
      this.gameState.updateTimer(data.timeRemaining);
    }
    
    // Additional warning handling is done in GameStateManager
  }
  
  handleTimeUp(data) {
    this.gameState.handleTimeUp();
  }
  
  // Input event handlers
  handleMoveLeft(data) {
    this.handlePlayerInput({ action: "move-left", ...data });
  }
  
  handleMoveRight(data) {
    this.handlePlayerInput({ action: "move-right", ...data });
  }
  
  handleJump(data) {
    this.handlePlayerInput({ action: "jump", ...data });
  }
  
  handleKick(data) {
    this.handlePlayerInput({ action: "kick", ...data });
  }
  
  handlePlayerInput(data) {
    // Only process remote player input
    if (data.playerId === this.socketService?.getSocket()?.id) return;
    
    this.playerManager.handleRemoteInput(data);
  }
  
  handleGamePaused(data) {
    logger.info("Game paused by server", data);
    this.gameState.pauseGame();
    this.scene.onGamePaused?.(data);
  }
  
  handleGameResumed(data) {
    logger.info("Game resumed by server", data);
    this.gameState.resumeGame();
    this.scene.onGameResumed?.(data);
  }
  
  handleRematchRequested(data) {
    logger.info("Rematch requested", data);
    this.scene.onRematchRequested?.(data);
  }
  
  handleRematchConfirmed(data) {
    logger.info("Rematch confirmed", data);
    this.scene.onRematchConfirmed?.(data);
  }
  
  handleRematchDeclined(data) {
    logger.info("Rematch declined", data);
    this.scene.onRematchDeclined?.(data);
  }
  
  handleDisconnected(data) {
    logger.warn("Socket disconnected", data);
    
    this.connected = false;
    this.roomJoined = false;
    
    // Attempt reconnection
    this.attemptReconnection();
    
    this.scene.onSocketDisconnected();
  }
  
  handleReconnected(data) {
    logger.info("Socket reconnected", data);
    
    this.connected = true;
    this.reconnectAttempts = 0;
    
    this.scene.onSocketReconnected();
  }
  
  handleError(data) {
    logger.error("Socket error", data);
    this.scene.onSocketError(data);
  }
  
  // Reconnection logic
  async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached");
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logger.info("Attempting reconnection", { 
      attempt: this.reconnectAttempts, 
      delay 
    });
    
    setTimeout(async () => {
      try {
        await this.socketService.connect();
        logger.info("Reconnection successful");
      } catch (error) {
        logger.error("Reconnection failed", { error: error.message });
        this.attemptReconnection();
      }
    }, delay);
  }
  
  // Status and debugging
  getStatus() {
    return {
      connected: this.connected,
      roomJoined: this.roomJoined,
      socketConnected: this.socketService?.isSocketConnected(),
      socketRoomJoined: this.socketService?.isRoomJoined(),
      reconnectAttempts: this.reconnectAttempts,
      messageQueueLength: this.messageQueue.length,
      throttleMapSize: this.throttleMap.size,
      roomId: this.socketService?.getCurrentRoomId(),
      playersInRoom: this.socketService?.getPlayersInRoom()
    };
  }
  
  // Cleanup
  cleanup() {
    logger.debug("NetworkManager cleanup");
    
    this.stopMessageProcessing();
    
    // Clear queues and maps
    this.messageQueue = [];
    this.throttleMap.clear();
    
    // Reset state
    this.connected = false;
    this.roomJoined = false;
    this.reconnectAttempts = 0;
    
    // Disconnect if connected
    if (this.socketService?.isSocketConnected()) {
      try {
        this.socketService.disconnect();
      } catch (error) {
        logger.warn("Error during socket disconnect", { error: error.message });
      }
    }
    
    logger.debug("NetworkManager cleanup complete");
  }
}