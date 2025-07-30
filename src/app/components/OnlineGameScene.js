import { GAME_CONFIG } from "./config.js";
import { logger } from "../lib/logger.js";
import { AnimationManager } from "../lib/animations.js";
import { GameStateManager } from "./online/GameStateManager.js";
import { NetworkManager } from "./online/NetworkManager.js";
import { UIManager } from "./online/UIManager.js";
import { PlayerManager } from "./online/PlayerManager.js";
import { BallManager } from "./online/BallManager.js";
import { EffectsManager } from "./online/EffectsManager.js";
import { PerformanceManager } from "./online/PerformanceManager.js";

/**
 * Refactored OnlineGameScene with modular architecture
 * Handles online multiplayer HeadBall gameplay with improved performance and UX
 */
export class OnlineGameScene extends Phaser.Scene {
  constructor() {
    super({ key: "OnlineGameScene" });
    
    // Core managers
    this.gameState = null;
    this.network = null;
    this.ui = null;
    this.playerManager = null;
    this.ballManager = null;
    this.effects = null;
    this.performance = null;
    this.animations = null;
    
    // Scene state
    this.isInitialized = false;
    this.playerPosition = null;
    this.sceneReady = false;
    
    // Input handling
    this.keys = null;
    this.inputEnabled = false;
    
    // Scene objects
    this.ground = null;
    this.leftWall = null;
    this.rightWall = null;
    this.topWall = null;
    this.leftGoal = null;
    this.rightGoal = null;
    this.background = null;
    
    logger.debug("OnlineGameScene constructor completed");
  }
  
  // Scene lifecycle
  init(data) {
    logger.info("OnlineGameScene init", data);
    
    // Get player position from URL or data
    this.playerPosition = data?.playerPosition || 
                         (typeof window !== "undefined" && window.__HEADBALL_PLAYER_POSITION) || 
                         "player1";
    
    logger.debug("Player position set", { position: this.playerPosition });
  }
  
  preload() {
    logger.debug("OnlineGameScene preload started");
    
    // Show loading screen
    this.showLoadingScreen();
    
    // Set loading event listeners
    this.load.on('progress', this.updateLoadingProgress, this);
    this.load.on('complete', this.onLoadComplete, this);
    
    logger.debug("OnlineGameScene preload completed");
  }
  
  showLoadingScreen() {
    // Simple loading screen
    const centerX = GAME_CONFIG.CANVAS_WIDTH / 2;
    const centerY = GAME_CONFIG.CANVAS_HEIGHT / 2;
    
    this.add.text(centerX, centerY, "Loading Online Game...", {
      fontFamily: '"Press Start 2P"',
      fontSize: "24px",
      fill: "#ffffff",
      align: "center"
    }).setOrigin(0.5);
  }
  
  updateLoadingProgress(progress) {
    logger.debug("Loading progress", { progress: Math.round(progress * 100) + "%" });
  }
  
  onLoadComplete() {
    logger.debug("Asset loading complete");
  }
  
  async create() {
    logger.info("OnlineGameScene create started");
    
    try {
      // Initialize core systems first
      await this.initializeManagers();
      
      // Create game world
      this.createWorld();
      
      // Set up input
      this.setupInput();
      
      // Create UI
      this.ui.createUI();
      
      // Initialize network connection
      await this.initializeNetwork();
      
      // Mark as ready
      this.sceneReady = true;
      this.isInitialized = true;
      
      logger.info("OnlineGameScene create completed successfully");
      
    } catch (error) {
      logger.error("Failed to create OnlineGameScene", { error: error.message });
      this.handleInitializationError(error);
    }
  }
  
  async initializeManagers() {
    logger.debug("Initializing managers");
    
    // Initialize performance manager first for monitoring
    this.performance = new PerformanceManager(this);
    this.performance.initialize();
    
    // Initialize effects and animations
    this.animations = new AnimationManager(this);
    this.effects = new EffectsManager(this, this.animations);
    this.effects.initialize();
    
    // Initialize game state manager
    this.gameState = new GameStateManager(this);
    
    // Initialize managers that depend on others
    this.playerManager = new PlayerManager(this, this.gameState, this.effects);
    this.ballManager = new BallManager(this, this.gameState, this.effects, this.performance);
    this.ui = new UIManager(this, this.gameState, this.effects);
    
    // Initialize network manager last
    this.network = new NetworkManager(this, this.gameState, this.playerManager, this.ballManager);
    
    // Set up manager cross-references
    this.playerManager.setNetwork(this.network);
    this.ballManager.setNetwork(this.network);
    
    logger.debug("All managers initialized");
  }
  
  createWorld() {
    logger.debug("Creating game world");
    
    // Create background
    this.createBackground();
    
    // Create field boundaries
    this.createBoundaries();
    
    // Create goals
    this.createGoals();
    
    logger.debug("Game world created");
  }
  
  createBackground() {
    // Sky gradient background
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x87ceeb, 0x87ceeb, 0x98fb98, 0x98fb98, 1);
    graphics.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
    graphics.setDepth(-1000);
    
    this.background = graphics;
  }
  
  createBoundaries() {
    // Ground
    this.ground = this.physics.add.staticGroup();
    this.ground.create(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.FIELD.GROUND_Y + 25,
      null
    ).setSize(GAME_CONFIG.CANVAS_WIDTH, 50).setVisible(false);
    
    // Draw visible ground
    const groundGraphics = this.add.graphics();
    groundGraphics.fillStyle(0x8b7355);
    groundGraphics.fillRect(
      0,
      GAME_CONFIG.FIELD.GROUND_Y,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT - GAME_CONFIG.FIELD.GROUND_Y
    );
    groundGraphics.setDepth(-500);
    
    // Walls
    this.leftWall = this.physics.add.staticGroup();
    this.leftWall.create(-25, GAME_CONFIG.CANVAS_HEIGHT / 2, null)
      .setSize(50, GAME_CONFIG.CANVAS_HEIGHT).setVisible(false);
    
    this.rightWall = this.physics.add.staticGroup();
    this.rightWall.create(GAME_CONFIG.CANVAS_WIDTH + 25, GAME_CONFIG.CANVAS_HEIGHT / 2, null)
      .setSize(50, GAME_CONFIG.CANVAS_HEIGHT).setVisible(false);
    
    this.topWall = this.physics.add.staticGroup();
    this.topWall.create(GAME_CONFIG.CANVAS_WIDTH / 2, -25, null)
      .setSize(GAME_CONFIG.CANVAS_WIDTH, 50).setVisible(false);
  }
  
  createGoals() {
    const goalHeight = 150;
    const goalY = GAME_CONFIG.FIELD.GROUND_Y - goalHeight / 2;
    
    // Left goal
    this.leftGoal = this.physics.add.staticGroup();
    this.leftGoal.create(25, goalY, null)
      .setSize(50, goalHeight).setVisible(false);
    
    // Right goal  
    this.rightGoal = this.physics.add.staticGroup();
    this.rightGoal.create(GAME_CONFIG.CANVAS_WIDTH - 25, goalY, null)
      .setSize(50, goalHeight).setVisible(false);
    
    // Draw visible goals
    this.drawGoalPosts();
  }
  
  drawGoalPosts() {
    const goalHeight = 150;
    const goalY = GAME_CONFIG.FIELD.GROUND_Y - goalHeight;
    
    const graphics = this.add.graphics();
    graphics.lineStyle(8, 0xffffff);
    
    // Left goal posts
    graphics.moveTo(50, GAME_CONFIG.FIELD.GROUND_Y);
    graphics.lineTo(50, goalY);
    graphics.lineTo(0, goalY);
    
    // Right goal posts
    graphics.moveTo(GAME_CONFIG.CANVAS_WIDTH - 50, GAME_CONFIG.FIELD.GROUND_Y);
    graphics.lineTo(GAME_CONFIG.CANVAS_WIDTH - 50, goalY);
    graphics.lineTo(GAME_CONFIG.CANVAS_WIDTH, goalY);
    
    graphics.strokePath();
    graphics.setDepth(100);
  }
  
  setupInput() {
    logger.debug("Setting up input handling");
    
    // Create keyboard input
    this.keys = {
      w: this.input.keyboard.addKey('W'),
      a: this.input.keyboard.addKey('A'),
      s: this.input.keyboard.addKey('S'),
      d: this.input.keyboard.addKey('D'),
      up: this.input.keyboard.addKey('UP'),
      left: this.input.keyboard.addKey('LEFT'),
      down: this.input.keyboard.addKey('DOWN'),
      right: this.input.keyboard.addKey('RIGHT'),
      space: this.input.keyboard.addKey('SPACE'),
      enter: this.input.keyboard.addKey('ENTER'),
      shift: this.input.keyboard.addKey('SHIFT'),
      escape: this.input.keyboard.addKey('ESC')
    };
    
    // Set up input events
    this.input.keyboard.on('keydown', this.handleKeyDown, this);
    this.input.keyboard.on('keyup', this.handleKeyUp, this);
    
    this.inputEnabled = true;
    
    logger.debug("Input handling setup complete");
  }
  
  async initializeNetwork() {
    logger.debug("Initializing network connection");
    
    this.ui.showLoadingScreen();
    
    try {
      await this.network.initialize();
      
      // Wait for room join
      await this.waitForRoomJoin();
      
      // Create players after network is ready
      this.createGameObjects();
      
      logger.info("Network initialization complete");
      
    } catch (error) {
      logger.error("Network initialization failed", { error: error.message });
      this.handleNetworkError(error);
    }
  }
  
  async waitForRoomJoin() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Room join timeout"));
      }, 10000);
      
      const checkRoomJoin = () => {
        if (this.network.isRoomJoined()) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkRoomJoin, 100);
        }
      };
      
      checkRoomJoin();
    });
  }
  
  createGameObjects() {
    logger.debug("Creating game objects");
    
    try {
      // Create players
      this.playerManager.createPlayers(this.playerPosition);
      
      // Create ball
      this.ballManager.createBall();
      
      // Set up collisions
      this.setupCollisions();
      
      // Update UI with player position
      this.ui.updatePosition(this.playerPosition);
      
      // Show ready button
      this.ui.showReadyButton();
      
      logger.debug("Game objects created successfully");
      
    } catch (error) {
      logger.error("Failed to create game objects", { error: error.message });
      throw error;
    }
  }
  
  setupCollisions() {
    logger.debug("Setting up physics collisions");
    
    const localPlayer = this.playerManager.getLocalPlayer();
    const remotePlayer = this.playerManager.getRemotePlayer();
    const ball = this.ballManager.ball;
    
    if (!localPlayer || !remotePlayer || !ball) {
      logger.warn("Cannot setup collisions - missing game objects");
      return;
    }
    
    // Player-boundary collisions
    this.physics.add.collider(localPlayer.sprite, this.ground);
    this.physics.add.collider(localPlayer.sprite, this.leftWall);
    this.physics.add.collider(localPlayer.sprite, this.rightWall);
    this.physics.add.collider(localPlayer.sprite, this.topWall);
    
    this.physics.add.collider(remotePlayer.sprite, this.ground);
    this.physics.add.collider(remotePlayer.sprite, this.leftWall);
    this.physics.add.collider(remotePlayer.sprite, this.rightWall);
    this.physics.add.collider(remotePlayer.sprite, this.topWall);
    
    // Ball-boundary collisions
    this.physics.add.collider(ball, this.ground);
    this.physics.add.collider(ball, this.leftWall);
    this.physics.add.collider(ball, this.rightWall);
    this.physics.add.collider(ball, this.topWall);
    
    // Ball-player collisions (handled by BallManager)
    this.ballManager.setupPlayerCollisions(localPlayer, remotePlayer);
    
    // Goal detection
    this.physics.add.overlap(ball, this.leftGoal, () => {
      this.ballManager.handleGoal("player2", "left");
    });
    
    this.physics.add.overlap(ball, this.rightGoal, () => {
      this.ballManager.handleGoal("player1", "right");
    });
    
    logger.debug("Physics collisions setup complete");
  }
  
  // Input handling
  handleKeyDown(event) {
    if (!this.inputEnabled || !this.gameState.canPlay()) return;
    
    const input = this.getCurrentInput();
    this.playerManager.handleInput(input);
  }
  
  handleKeyUp(event) {
    if (!this.inputEnabled || !this.gameState.canPlay()) return;
    
    const input = this.getCurrentInput();
    this.playerManager.handleInput(input);
  }
  
  getCurrentInput() {
    return {
      left: this.keys.a.isDown || this.keys.left.isDown,
      right: this.keys.d.isDown || this.keys.right.isDown,
      up: this.keys.w.isDown || this.keys.up.isDown,
      kick: this.keys.space.isDown || this.keys.enter.isDown || this.keys.shift.isDown
    };
  }
  
  // Game event handlers
  handleReady() {
    logger.debug("Player ready button clicked");
    
    try {
      this.gameState.setPlayerReady(true);
      this.network.sendPlayerReady();
      this.ui.showWaitingScreen();
      
    } catch (error) {
      logger.error("Failed to send ready state", { error: error.message });
      this.ui.showErrorMessage("Failed to connect to game. Please try again.", () => {
        this.scene.restart();
      });
    }
  }
  
  onRoomJoined(data) {
    logger.debug("Room joined callback", data);
    this.ui.showMessage("Connected to game room!", 2000, "#00ff00");
  }
  
  onPlayerReady(data) {
    logger.debug("Player ready callback", data);
    this.gameState.handlePlayerReady(data);
    this.ui.updateReadyScreen(this.gameState.getReadyStatus());
  }
  
  onAllPlayersReady(data) {
    logger.info("All players ready - starting game", data);
    
    this.ui.showCountdown(() => {
      this.gameState.startGame();
      this.effects.startGameEffects();
      this.ui.showMessage("Game Started!", 2000, "#00ff00");
    });
  }
  
  onGameStarted(data) {
    logger.info("Game started", data);
    this.gameState.handleGameStarted(data);
  }
  
  onGameEnded(data) {
    logger.info("Game ended", data);
    this.gameState.handleGameEnded(data);
    this.ui.showGameEndScreen(data);
  }
  
  onGoalScored(scorer, data) {
    logger.info("Goal scored", { scorer, data });
    
    this.gameState.addGoal(scorer);
    this.ui.showGoalPause(scorer);
    
    // Hide goal screen after delay
    this.time.delayedCall(3000, () => {
      this.ui.hideGoalPause();
      this.ballManager.resetBall();
      this.playerManager.resetPositions();
    });
  }
  
  onPlayerPositionUpdate(data) {
    this.playerManager.handleRemotePositionUpdate(data);
  }
  
  onBallStateUpdate(data) {
    this.ballManager.handleRemoteBallState(data);
  }
  
  // Connection event handlers
  onSocketDisconnected() {
    logger.warn("Socket disconnected");
    this.inputEnabled = false;
    this.ui.showConnectionLost();
  }
  
  onSocketReconnected() {
    logger.info("Socket reconnected");
    this.inputEnabled = true;
    this.ui.hideConnectionLost();
    this.ui.showMessage("Reconnected to game!", 2000, "#00ff00");
  }
  
  onSocketError(data) {
    logger.error("Socket error", data);
    this.ui.showErrorMessage("Connection error occurred. Please refresh the page.", () => {
      window.location.reload();
    });
  }
  
  // Game control
  pauseGame() {
    if (!this.gameState.canPause()) return;
    
    this.gameState.pauseGame();
    this.network.sendGamePause();
    this.ui.showPauseScreen();
  }
  
  resumeGame() {
    if (!this.gameState.isPaused) return;
    
    this.gameState.resumeGame();
    this.network.sendGameResume();
    this.ui.hidePauseScreen();
  }
  
  restartGame() {
    logger.info("Restarting game");
    
    // Leave current game
    if (this.network) {
      this.network.leaveRoom();
    }
    
    // Restart scene
    this.scene.restart();
  }
  
  // Error handling
  handleInitializationError(error) {
    logger.error("Game initialization error", { error: error.message });
    
    this.ui?.showErrorMessage(
      "Failed to initialize game. Please refresh the page and try again.",
      () => window.location.reload()
    );
  }
  
  handleNetworkError(error) {
    logger.error("Network error", { error: error.message });
    
    this.ui?.showErrorMessage(
      "Failed to connect to game server. Please check your connection and try again.",
      () => this.scene.restart()
    );
  }
  
  // Update loop
  update(time, deltaTime) {
    if (!this.isInitialized) return;
    
    try {
      // Update all managers
      this.performance?.update();
      this.gameState?.update();
      this.playerManager?.update();
      this.ballManager?.update();
      this.effects?.update();
      this.ui?.update();
      
    } catch (error) {
      logger.error("Error in update loop", { error: error.message });
    }
  }
  
  // Cleanup
  destroy() {
    logger.info("OnlineGameScene cleanup started");
    
    try {
      // Cleanup all managers
      this.network?.cleanup();
      this.playerManager?.cleanup();
      this.ballManager?.cleanup();
      this.effects?.cleanup();
      this.ui?.cleanup();
      this.gameState?.cleanup();
      this.performance?.cleanup();
      
      // Clear references
      this.gameState = null;
      this.network = null;
      this.ui = null;
      this.playerManager = null;
      this.ballManager = null;
      this.effects = null;
      this.performance = null;
      this.animations = null;
      
      // Reset flags
      this.isInitialized = false;
      this.sceneReady = false;
      this.inputEnabled = false;
      
      logger.info("OnlineGameScene cleanup completed");
      
    } catch (error) {
      logger.error("Error during scene cleanup", { error: error.message });
    }
    
    super.destroy();
  }
}
