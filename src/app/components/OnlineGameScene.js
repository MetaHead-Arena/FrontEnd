import { GAME_CONFIG, PIXEL_SPRITE } from "./config.js";
import { Player } from "./Player.js";
import { RemotePlayer } from "./RemotePlayer.js";

export class OnlineGameScene extends Phaser.Scene {
  constructor() {
    super({ key: "OnlineGameScene" });

    // Game state
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.goalCooldown = 0;
    this.pausedForGoal = false;
    this.overlayGroup = null;
    this.isPaused = false;

    // Timer system
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.timerEvent = null;
    this.gameStarted = false; // Always false until both players ready

    // Power-up system
    this.powerups = [];
    this.powerupSpawnTimer = null;
    this.lastPlayerToTouchBall = null;

    // Visual effects
    this.ballTrail = [];
    this.isShaking = false;

    // Online multiplayer specific
    this.playerPosition = null; // "player1" or "player2"
    this.isBallAuthority = false; // Whether this player is responsible for ball physics
    this.socketService = null;

    // Ball state sending
    this.lastBallStateSend = null;

    // Waiting screen references
    this.waitingStatusText = null;
    this.readyStatusText = null;

    // Initialize physics constants
    this.playerSpeed = GAME_CONFIG.PLAYER.SPEED;
    this.jumpPower = GAME_CONFIG.PLAYER.JUMP_POWER;

    // Initialize input tracking
    this.leftPressed = false;
    this.rightPressed = false;
    this.jumpPressed = false;
    this.kickPressed = false;

    // Initialize last sent position for optimization
    this.lastSentPosition = { x: 0, y: 0 };
    this.positionSendThreshold = 5; // Only send if moved more than 5 pixels

    // Initialize ready state tracking
    this.isPlayerReady = false;
    this.isOpponentReady = false;
  }

  init(data) {
    // Set global player position for online games
    if (typeof window !== "undefined") {
      this.playerPosition = window.__HEADBALL_PLAYER_POSITION || null;

      // Debug: Check if position was properly assigned
      console.log("=== ONLINE POSITION ASSIGNMENT DEBUG ===");
      console.log("Window player position:", window.__HEADBALL_PLAYER_POSITION);
      console.log("Room data:", window.__HEADBALL_ROOM_DATA);

      // If position is still null or invalid, force assignment
      if (
        !this.playerPosition ||
        (this.playerPosition !== "player1" && this.playerPosition !== "player2")
      ) {
        console.warn("Invalid player position detected, forcing assignment...");

        // Use socket ID to determine position consistently
        const socketId = window.__HEADBALL_SOCKET_ID || null;
        if (socketId) {
          // Simple hash-based assignment for consistency
          const hash = socketId.split("").reduce((a, b) => {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
          }, 0);
          this.playerPosition =
            Math.abs(hash) % 2 === 0 ? "player1" : "player2";
          console.log(
            `Forced position assignment based on socket hash: ${this.playerPosition}`
          );
          window.__HEADBALL_PLAYER_POSITION = this.playerPosition;
        } else {
          // Ultimate fallback
          this.playerPosition = "player1";
          console.log("Ultimate fallback: assigned player1");
          window.__HEADBALL_PLAYER_POSITION = this.playerPosition;
        }
      }

      this.isBallAuthority = this.playerPosition === "player1"; // Player 1 is ball authority
      console.log("Final player position assigned:", this.playerPosition);
      console.log("Ball authority:", this.isBallAuthority);
      console.log("=== END ONLINE POSITION DEBUG ===");
    }
  }

  preload() {
    this.load.image("court", "/court.png");
    this.load.image("pixel", PIXEL_SPRITE);
    this.load.image("player1", "/head-1.png");
    this.load.image("player2", "/head-2.png");
    this.load.image("ball", "/ball.png");
    this.load.image("left-net", "/left-net.png");
    this.load.image("right-net", "/right-net.png");
  }

  create() {
    console.log("OnlineGameScene create() called");

    // First reset the state
    this.resetGameState();

    // Set up physics world
    this.physics.world.setBounds(
      0,
      0,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT
    );
    this.physics.world.gravity.y = GAME_CONFIG.GRAVITY;

    // Create background
    this.add.image(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      "court"
    );

    // Create physics world boundaries
    this.createFieldBoundaries();

    // Create goal posts
    this.createGoalPosts();

    // Create ball
    this.createBall();

    // Create players
    this.createPlayers();

    // Set up ball collisions
    this.setupBallCollisions();

    // Set up player-to-player collision
    this.physics.add.collider(this.player1.sprite, this.player2.sprite);

    // Create UI elements
    this.createUI();

    // Create player stats display
    this.createPlayerStatsDisplay();

    // Update position indicator
    this.updatePositionIndicator();

    // Initialize online multiplayer AFTER everything is created
    this.initializeOnlineMultiplayer();

    // Expose debug methods for troubleshooting
    this.exposeDebugMethods();

    // Notify that game is loaded
    this.notifyGameLoaded();

    console.log("OnlineGameScene created successfully");
  }

  resetGameState() {
    console.log("Resetting OnlineGameScene game state");

    // Reset ready states
    this.isPlayerReady = false;
    this.isOpponentReady = false;

    // Reset game state
    this.gameStarted = false; // Prevent premature game start
    this.gameOver = false;
    this.isPaused = false;
    this.pausedForGoal = false;
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.goalCooldown = 0;
    this.powerups = [];
    this.powerupSpawnTimer = null;
    this.lastPlayerToTouchBall = null;

    // Clear any existing timers
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }

    // Clear overlays
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }
    this.waitingStatusText = null;
    this.readyStatusText = null;

    console.log("OnlineGameScene state reset complete");
  }

  initializeOnlineMultiplayer() {
    // Import the services dynamically to avoid SSR issues
    if (typeof window !== "undefined") {
      import("../../services/socketService")
        .then(({ socketService }) => {
          this.socketService = socketService;

          // Ensure socket is connected before setting up listeners
          if (!this.socketService.isSocketConnected()) {
            console.log("Socket not connected, attempting to connect...");
            this.socketService
              .connect()
              .then(() => {
                console.log("Socket connected successfully");
                this.setupOnlineEventListeners();

                // Join game with authenticated session
                this.socketService.joinGame({});
                console.log("Joined game with authenticated session");
              })
              .catch((error) => {
                console.error("Failed to connect socket:", error);
              });
          } else {
            console.log("Socket already connected");
            this.setupOnlineEventListeners();
          }

          console.log("Online multiplayer initialized");
          console.log("Player position:", this.playerPosition);
          console.log("Ball authority:", this.isBallAuthority);
        })
        .catch((error) => {
          console.error("Failed to initialize online multiplayer:", error);
        });
    }
  }

  setupOnlineEventListeners() {
    if (!this.socketService) return;

    console.log("Setting up online event listeners...");

    // Connection events
    this.socketService.on("welcome", (data) => {
      console.log("Welcome message received:", data);
      if (data.authenticated) {
        console.log("Player authenticated successfully");
      } else {
        console.warn("Player not authenticated");
      }
    });

    this.socketService.on("player-created", (data) => {
      console.log("Player created:", data);
    });

    // Game state events - CRITICAL: Handle game-started at ANY time
    this.socketService.on("game-started", (data) => {
      console.log("Game started via socket:", data);
      // Always handle game start regardless of current UI state
      // This fixes the race condition where one player is still on ready screen
      this.handleGameStarted(data);
    });

    this.socketService.on("match-ended", (data) => {
      console.log("Match ended via socket:", data);
      this.handleMatchEnded(data);
    });

    this.socketService.on("game-ended", (data) => {
      console.log("Game ended via socket:", data);
      this.handleGameEnded(data);
    });

    this.socketService.on("goal-scored", (data) => {
      console.log("Goal scored via socket:", data);
      this.handleGoalScored(data);
    });

    // Ball state synchronization
    this.socketService.on("ball-state", (data) => {
      console.log("Received ball-state event:", data);
      this.handleRemoteBallState(data);
    });

    // Game state synchronization from backend
    this.socketService.on("game-state", (data) => {
      // Handle comprehensive game state updates from backend
      this.handleGameStateUpdate(data);
    });

    // Player position synchronization
    this.socketService.on("player-position", (data) => {
      console.log("Received player-position event:", data);
      this.handleRemotePlayerPosition(data);
    });

    // Individual input events matching backend structure
    this.socketService.on("move-left", (data) => {
      console.log("Received move-left event:", data);
      this.handleRemotePlayerInput({ action: "move-left", ...data });
    });

    this.socketService.on("move-right", (data) => {
      console.log("Received move-right event:", data);
      this.handleRemotePlayerInput({ action: "move-right", ...data });
    });

    this.socketService.on("jump", (data) => {
      console.log("Received jump event:", data);
      this.handleRemotePlayerInput({ action: "jump", ...data });
    });

    this.socketService.on("kick", (data) => {
      console.log("Received kick event:", data);
      this.handleRemotePlayerInput({ action: "kick", ...data });
    });

    // Generic player-input event as fallback
    this.socketService.on("player-input", (data) => {
      console.log("Received player-input event:", data);
      this.handleRemotePlayerInput(data);
    });

    // Player ready events
    this.socketService.on("player-ready", (data) => {
      console.log("Received player-ready event:", data);
      this.handlePlayerReady(data);
    });

    // Both players ready event
    this.socketService.on("all-players-ready", (data) => {
      console.log("All players ready, starting game:", data);
      this.handleAllPlayersReady(data);
    });

    // Rematch events
    this.socketService.on("rematch-request", (data) => {
      console.log("Rematch requested:", data);
      this.handleRematchRequest(data);
    });

    this.socketService.on("rematch-confirmed", (data) => {
      console.log("Rematch confirmed:", data);
      this.handleRematchConfirmed(data);
    });

    this.socketService.on("rematch-declined", (data) => {
      console.log("Rematch declined:", data);
      this.handleRematchDeclined(data);
    });

    // Error handling
    this.socketService.on("error", (data) => {
      console.error("Socket error received:", data);
      this.handleSocketError(data);
    });

    // Connection state events
    this.socketService.on("disconnected", (data) => {
      console.warn("Socket disconnected:", data);
      this.handleSocketDisconnected(data);
    });

    this.socketService.on("reconnected", (data) => {
      console.log("Socket reconnected:", data);
      this.handleSocketReconnected(data);
    });

    console.log("Online event listeners set up successfully");
  }

  handleGameStarted(data) {
    console.log("Game started via socket:", data);
    console.log("Current state when game started:", {
      gameStarted: this.gameStarted,
      isPlayerReady: this.isPlayerReady,
      hasOverlay: !!this.overlayGroup,
    });

    // CRITICAL: Clear any overlay immediately regardless of current state
    // This handles the case where player is still on loading/ready screen
    if (this.overlayGroup) {
      console.log("Clearing overlay screens for game start");
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }

    // Clear waiting screen references
    this.waitingStatusText = null;
    this.readyStatusText = null;

    // Reset ready states for next match
    this.isPlayerReady = false;
    this.isOpponentReady = false;

    // Reset game state for new match
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.goalCooldown = 0;
    this.pausedForGoal = false;
    this.gameTime = data.matchDuration || GAME_CONFIG.GAME_DURATION;
    this.gameStarted = true; // NOW the game can start!
    this.powerups = [];
    this.powerupSpawnTimer = null;
    this.lastPlayerToTouchBall = null;

    console.log("Game state reset, starting timer and powerups...");

    // Start the game systems
    this.startGameTimer();
    this.startPowerupSystem();

    // Reset player positions
    this.resetPlayerPositions();

    // Reset ball position
    if (this.ball) {
      this.ball.x = GAME_CONFIG.BALL.STARTING_POSITION.x;
      this.ball.y = GAME_CONFIG.BALL.STARTING_POSITION.y;
      this.ball.body.setVelocity(0, 0);
      console.log("Ball reset to center position");
    }

    // Update UI
    this.updateScoreDisplay();
    this.updateTimerDisplay();
    this.updatePositionIndicator();

    console.log("Online game is now active!");

    // Force a small delay to ensure all UI updates are processed
    this.time.delayedCall(100, () => {
      console.log("Game start transition complete");
    });
  }

  resetPlayerPositions() {
    if (this.player1) {
      if (this.playerPosition === "player1") {
        // This player is player1 (right side)
        this.player1.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x;
        this.player1.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;
        console.log("Player1 (local) positioned on right side");
      } else {
        // This player is player2 (left side)
        this.player1.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x;
        this.player1.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y;
        console.log("Player1 (local) positioned on left side");
      }
      this.player1.sprite.body.setVelocity(0, 0);
    }

    if (this.player2) {
      if (this.playerPosition === "player1") {
        // Remote player is on left
        this.player2.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x;
        this.player2.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y;
        console.log("Player2 (remote) positioned on left side");
      } else {
        // Remote player is on right
        this.player2.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x;
        this.player2.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;
        console.log("Player2 (remote) positioned on right side");
      }
      this.player2.sprite.body.setVelocity(0, 0);
    }
  }

  createPlayers() {
    console.log(
      "OnlineGameScene creating players with position:",
      this.playerPosition
    );

    if (this.playerPosition === "player1") {
      // This player is Player 1: right side, use "player2" image
      // Note: All players can use both WASD and Arrow keys
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "PLAYER1",
        "universal", // Both control schemes supported
        "player2"
      );
      // Remote player is Player 2: left side, use "player1" image
      this.player2 = new RemotePlayer(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER2",
        "player1"
      );
    } else {
      // This player is Player 2: left side, use "player1" image
      // Note: All players can use both WASD and Arrow keys
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER1",
        "universal", // Both control schemes supported
        "player1"
      );
      // Remote player is Player 1: right side, use "player2" image
      this.player2 = new RemotePlayer(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "PLAYER2",
        "player2"
      );
    }

    console.log("Online players created successfully");
  }

  notifyGameLoaded() {
    // Small delay to ensure everything is properly initialized
    this.time.delayedCall(100, () => {
      console.log("Online game engine fully loaded and ready");
      console.log("Current ready states:", this.getReadyStatus());

      // Check if game has already started while we were loading
      if (this.gameStarted) {
        console.log(
          "Game already started while loading, skipping ready screen"
        );
        return;
      }

      // Show loading screen first
      this.showLoadingScreen();

      // Call the global callback if available
      if (typeof window !== "undefined" && window.__HEADBALL_GAME_LOADED) {
        window.__HEADBALL_GAME_LOADED();
      }

      // Expose handleReady function globally for React UI
      if (typeof window !== "undefined") {
        window.__HEADBALL_HANDLE_READY = () => {
          this.handleReady();
        };
        window.__HEADBALL_CANCEL_READY = () => {
          this.cancelReady();
        };
      }

      // After everything is loaded, show ready button (unless game already started)
      this.time.delayedCall(1500, () => {
        // Double check game hasn't started while we were in loading delay
        if (this.gameStarted) {
          console.log(
            "Game started during loading delay, skipping ready button"
          );
          return;
        }

        console.log("Showing ready button, socket status:", {
          connected: this.socketService?.isSocketConnected(),
          roomJoined: this.socketService?.isRoomJoined(),
        });
        this.showReadyButton();
      });
    });
  }

  handleReady() {
    console.log("=== PLAYER CLICKED READY ===");
    console.log("Current local player position:", this.playerPosition);
    console.log("Current ready states before click:", {
      localReady: this.isPlayerReady,
      opponentReady: this.isOpponentReady,
    });

    if (this.gameStarted) {
      console.log("Game already started, cannot ready up");
      return;
    }

    if (this.isPlayerReady) {
      console.log("Player already ready, ignoring duplicate ready click");
      return;
    }

    if (!this.socketService) {
      console.error("Socket service not available");
      return;
    }

    if (!this.socketService.isSocketConnected()) {
      console.error("Socket not connected, cannot ready up");
      return;
    }

    if (!this.socketService.isRoomJoined()) {
      console.error("Not in a room, cannot ready up");
      return;
    }

    console.log("✅ Player ready validation passed, proceeding...");
    console.log(
      "Current room state:",
      this.socketService.getCurrentRoomState()
    );

    // Mark this player as ready locally first
    this.isPlayerReady = true;
    console.log("✅ Local ready state set to true");

    // Emit ready event to server using the correct method
    try {
      console.log("📡 Emitting player-ready to server...");
      this.socketService.emitPlayerReady();
      console.log("✅ Ready event emitted successfully");
      console.log("Current ready states after emitting:", {
        localPlayer: this.isPlayerReady,
        opponent: this.isOpponentReady,
        bothReady: this.isPlayerReady && this.isOpponentReady,
      });
    } catch (error) {
      console.error("❌ Failed to emit ready event:", error);
      // Reset ready state on failure
      this.isPlayerReady = false;
      console.log("Ready state reset due to emit failure");
      return;
    }

    console.log("🔄 Showing waiting screen...");
    // Show waiting screen immediately (this will be updated by handlePlayerReady events)
    this.showWaitingForPlayersScreen();
    console.log("=== END PLAYER CLICKED READY ===");
  }

  startGameTimer() {
    // Don't start timer unless game has actually started
    if (!this.gameStarted) {
      console.log("Timer not started - online game not yet started");
      return;
    }

    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.updateTimerDisplay();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true,
    });

    console.log("Online game timer started");
  }

  startPowerupSystem() {
    // Don't start powerups unless game has actually started
    if (!this.gameStarted) {
      console.log("Powerup system not started - online game not yet started");
      return;
    }

    this.schedulePowerupSpawn();
    console.log("Online powerup system started");
  }

  update() {
    // SAFETY CHECK: If game has started but we still have overlay screens, clear them
    // This handles edge cases where ready screens persist after game start
    if (
      this.gameStarted &&
      this.overlayGroup &&
      this.overlayGroup.children.length > 0
    ) {
      console.warn("Game started but overlay still present - clearing it");
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
      this.waitingStatusText = null;
      this.readyStatusText = null;
    }

    if (this.isPaused || this.gameOver || this.pausedForGoal) return;
    if (!this.player1 || !this.ball) return;

    // Don't update game logic until game has started
    if (!this.gameStarted) return;

    // Handle input for the local player (player1)
    this.handleInput();

    // Update player physics
    if (this.player1 && this.player1.sprite && this.player1.sprite.body) {
      // Check if player is on ground
      this.player1.isOnGround = this.player1.sprite.body.touching.down;
    }

    // Send ball state if this player is the ball authority
    if (this.isBallAuthority && this.ball) {
      this.sendBallPosition();
    }

    if (this.goalCooldown > 0) this.goalCooldown--;

    this.checkBallBounds();
    this.updatePlayerStatsDisplay();
  }

  // Add placeholder methods that will be implemented
  showLoadingScreen() {
    if (this.overlayGroup && this.overlayGroup.children) {
      this.overlayGroup.clear(true, true);
    }
    this.overlayGroup = null;
    this.overlayGroup = this.add.group();

    // Semi-transparent background
    const overlay = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        GAME_CONFIG.CANVAS_WIDTH,
        GAME_CONFIG.CANVAS_HEIGHT,
        0x000000,
        0.8
      )
      .setDepth(9999);
    this.overlayGroup.add(overlay);

    // Loading text in bottom left
    const loadingText = this.add
      .text(50, GAME_CONFIG.CANVAS_HEIGHT - 80, "Game Loading", {
        fontFamily: '"Press Start 2P"',
        fontSize: "24px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5)
      .setDepth(10000);
    this.overlayGroup.add(loadingText);

    // Animated ball in bottom left
    const loadingBall = this.add
      .image(250, GAME_CONFIG.CANVAS_HEIGHT - 80, "ball")
      .setScale(0.3)
      .setDepth(10000);
    this.overlayGroup.add(loadingBall);

    // Animate the ball (spinning and bouncing)
    this.tweens.add({
      targets: loadingBall,
      rotation: Math.PI * 2,
      duration: 1000,
      repeat: -1,
      ease: "Linear",
    });

    this.tweens.add({
      targets: loadingBall,
      y: GAME_CONFIG.CANVAS_HEIGHT - 100,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Animate loading text dots
    const dots = this.add
      .text(320, GAME_CONFIG.CANVAS_HEIGHT - 80, "...", {
        fontFamily: '"Press Start 2P"',
        fontSize: "24px",
        fill: "#fde047",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0, 0.5)
      .setDepth(10000);
    this.overlayGroup.add(dots);

    this.tweens.add({
      targets: dots,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Power2",
    });
  }

  showReadyButton() {
    // Check if game already started before showing ready button
    if (this.gameStarted) {
      console.log("Game already started, skipping ready button");
      return;
    }

    // Clear loading screen
    if (this.overlayGroup && this.overlayGroup.children) {
      this.overlayGroup.clear(true, true);
    }
    this.overlayGroup = null;
    this.overlayGroup = this.add.group();

    // Semi-transparent background
    const overlay = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        GAME_CONFIG.CANVAS_WIDTH,
        GAME_CONFIG.CANVAS_HEIGHT,
        0x000000,
        0.7
      )
      .setDepth(9999);
    this.overlayGroup.add(overlay);

    // Main title
    const titleText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 120,
        "GAME READY!",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "48px",
          fill: "#00ff00",
          stroke: "#000000",
          strokeThickness: 6,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(titleText);

    // Player info
    const playerInfoText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 40,
        `You are: ${this.playerPosition?.toUpperCase() || "UNKNOWN"}`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "20px",
          fill: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(playerInfoText);

    // Controls info - Updated to show both control schemes work
    const side = this.playerPosition === "player1" ? "Right Side" : "Left Side";
    const controlsText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 30,
        `Controls: WASD or Arrow Keys\nKick: Space / Enter / Shift | Position: ${side}`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "14px",
          fill: "#fde047",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(controlsText);

    // Ready button
    const readyButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 60,
        300,
        80,
        0x22c55e,
        1
      )
      .setStrokeStyle(4, 0x16a34a)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(readyButton);

    const readyText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 60,
        "READY UP!",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "24px",
          fill: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10002);
    this.overlayGroup.add(readyText);

    // Button hover effects
    readyButton.on("pointerover", () => {
      readyButton.setFillStyle(0x15803d);
      this.tweens.add({
        targets: [readyButton, readyText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: "Power2",
      });
    });

    readyButton.on("pointerout", () => {
      readyButton.setFillStyle(0x22c55e);
      this.tweens.add({
        targets: [readyButton, readyText],
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
        ease: "Power2",
      });
    });

    // Ready button functionality
    readyButton.on("pointerdown", () => {
      this.handleReady();
    });

    readyText.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.handleReady();
    });

    // Add pulsing effect to title
    this.tweens.add({
      targets: titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Power2",
    });

    // Add glow effect to ready button
    this.tweens.add({
      targets: readyButton,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Power2",
    });
  }

  showWaitingForPlayersScreen() {
    // Check if game already started
    if (this.gameStarted) {
      console.log("Game already started, skipping waiting screen");
      return;
    }

    // Clear any existing overlay
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
    }
    this.overlayGroup = this.add.group();

    // Semi-transparent background
    const overlay = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        GAME_CONFIG.CANVAS_WIDTH,
        GAME_CONFIG.CANVAS_HEIGHT,
        0x000000,
        0.85
      )
      .setDepth(9999);
    this.overlayGroup.add(overlay);

    // Determine status message based on ready states
    let statusMessage = "Waiting for players...";
    if (this.isPlayerReady && this.isOpponentReady) {
      statusMessage = "Both players ready! Starting game...";
    } else if (this.isPlayerReady && !this.isOpponentReady) {
      statusMessage = "Waiting for opponent to ready up...";
    } else if (!this.isPlayerReady && this.isOpponentReady) {
      statusMessage = "Opponent ready! You need to ready up!";
    } else {
      statusMessage = "Waiting for both players to ready up...";
    }

    // Main status text
    this.waitingStatusText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 50,
        statusMessage,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "20px",
          fill: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10001);
    this.overlayGroup.add(this.waitingStatusText);

    // Ready status display with current states
    const localPosition = this.playerPosition || "player1";
    const remotePosition = localPosition === "player1" ? "player2" : "player1";
    const localStatus = this.isPlayerReady ? "✓" : "⏳";
    const remoteStatus = this.isOpponentReady ? "✓" : "⏳";

    this.readyStatusText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 30,
        `${localStatus} ${localPosition.toUpperCase()} READY\n${remoteStatus} ${remotePosition.toUpperCase()} READY`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "16px",
          fill: "#ffff00",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10001);
    this.overlayGroup.add(this.readyStatusText);

    // Add cancel button if this player hasn't readied yet
    if (!this.isPlayerReady) {
      const cancelButton = this.add
        .text(
          GAME_CONFIG.CANVAS_WIDTH / 2,
          GAME_CONFIG.CANVAS_HEIGHT / 2 + 120,
          "CANCEL",
          {
            fontFamily: '"Press Start 2P"',
            fontSize: "16px",
            fill: "#ff4444",
            backgroundColor: "#222222",
            padding: { x: 20, y: 10 },
            stroke: "#000000",
            strokeThickness: 2,
          }
        )
        .setOrigin(0.5)
        .setDepth(10001)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => {
          this.cancelReady();
        })
        .on("pointerover", function () {
          this.setFill("#ffffff");
        })
        .on("pointerout", function () {
          this.setFill("#ff4444");
        });
      this.overlayGroup.add(cancelButton);
    }

    console.log("Waiting for players screen shown with current ready states:", {
      localPlayer: this.isPlayerReady,
      opponent: this.isOpponentReady,
      statusMessage,
      localPosition,
      remotePosition,
    });
  }

  handlePlayerReady(data) {
    console.log("=== PLAYER READY EVENT RECEIVED ===");
    console.log("Event data:", data);
    console.log("Local player position:", this.playerPosition);
    console.log("Event player position:", data.playerPosition);

    // Prevent ready handling if game already started
    if (this.gameStarted) {
      console.log("Game already started, ignoring ready event");
      return;
    }

    // Validate that we have the necessary data
    if (!data.playerPosition) {
      console.warn("Ready event missing playerPosition, cannot process");
      return;
    }

    if (!this.playerPosition) {
      console.warn(
        "Local playerPosition not set, cannot determine if this is for us or opponent"
      );
      return;
    }

    // Determine if this is about the opponent or self with explicit validation
    const isOpponent = data.playerPosition !== this.playerPosition;
    const playerName = data.playerPosition;

    console.log("Ready event analysis:", {
      eventPlayerPosition: data.playerPosition,
      localPlayerPosition: this.playerPosition,
      isOpponent: isOpponent,
      currentLocalReady: this.isPlayerReady,
      currentOpponentReady: this.isOpponentReady,
    });

    if (isOpponent) {
      console.log(`✅ Opponent (${playerName}) is ready!`);
      this.isOpponentReady = true;
    } else {
      console.log(`✅ Received confirmation that we (${playerName}) are ready`);
      // This should already be true from handleReady(), but make sure
      this.isPlayerReady = true;
    }

    // Update waiting screen if visible
    if (this.waitingStatusText && this.readyStatusText) {
      const localPosition = this.playerPosition || "player1";
      const remotePosition =
        localPosition === "player1" ? "player2" : "player1";

      // Update ready status display
      const localStatus = this.isPlayerReady ? "✓" : "⏳";
      const remoteStatus = this.isOpponentReady ? "✓" : "⏳";

      this.readyStatusText.setText(
        `${localStatus} ${localPosition.toUpperCase()} READY\n${remoteStatus} ${remotePosition.toUpperCase()} READY`
      );

      // Update main status based on ready states
      if (this.isPlayerReady && this.isOpponentReady) {
        this.waitingStatusText.setText("Both players ready! Starting game...");
        console.log("✅ Both players confirmed ready, game should start soon");
      } else if (this.isPlayerReady && !this.isOpponentReady) {
        this.waitingStatusText.setText("Waiting for opponent to ready up...");
      } else if (!this.isPlayerReady && this.isOpponentReady) {
        this.waitingStatusText.setText("Opponent ready! Click READY to start!");
      } else {
        this.waitingStatusText.setText("Waiting for players to ready up...");
      }
    }

    // Log final ready state for debugging
    console.log("Final ready states after event:", {
      localPlayer: this.isPlayerReady,
      opponent: this.isOpponentReady,
      bothReady: this.isPlayerReady && this.isOpponentReady,
      gameStarted: this.gameStarted,
    });
    console.log("=== END PLAYER READY EVENT ===");

    // IMPORTANT: Don't auto-start the game here
    // Wait for explicit all-players-ready or game-started events from backend
    // This prevents premature game starts
  }

  handleAllPlayersReady(data) {
    console.log("All players ready event received:", data);

    // Double-check that both players are actually marked as ready
    if (!this.isPlayerReady || !this.isOpponentReady) {
      console.warn(
        "All-players-ready received but local state shows not all ready:",
        {
          localPlayer: this.isPlayerReady,
          opponent: this.isOpponentReady,
        }
      );

      // Force update ready states based on the event data
      if (data.readyPlayers && Array.isArray(data.readyPlayers)) {
        data.readyPlayers.forEach((playerPos) => {
          if (playerPos === this.playerPosition) {
            this.isPlayerReady = true;
          } else {
            this.isOpponentReady = true;
          }
        });
      }
    }

    // Prevent countdown if game already started
    if (this.gameStarted) {
      console.log("Game already started, ignoring all-players-ready");
      return;
    }

    // Update status text
    if (this.waitingStatusText) {
      this.waitingStatusText.setText("All players ready! Starting in 3...");

      // Update ready status display to show both players ready
      if (this.readyStatusText) {
        const localPosition = this.playerPosition || "player1";
        const remotePosition =
          localPosition === "player1" ? "player2" : "player1";
        this.readyStatusText.setText(
          `✓ ${localPosition.toUpperCase()} READY\n✓ ${remotePosition.toUpperCase()} READY`
        );
      }

      // Countdown before starting - this countdown is just for UI feedback
      // The actual game start is handled by the backend sending game-started event
      let countdown = 3;
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0 && this.waitingStatusText && !this.gameStarted) {
          this.waitingStatusText.setText(
            `All players ready! Starting in ${countdown}...`
          );
        } else if (this.waitingStatusText && !this.gameStarted) {
          this.waitingStatusText.setText("Waiting for server to start game...");
          clearInterval(countdownInterval);
        } else {
          // Game started during countdown, clear interval
          clearInterval(countdownInterval);
        }
      }, 1000);
    }

    console.log(
      "Countdown started, waiting for backend to send game-started event"
    );
  }

  cancelReady() {
    if (this.gameStarted) {
      console.log("Game already started, cannot cancel ready");
      return;
    }

    console.log("Player cancelled ready up");

    // Reset ready states
    this.isPlayerReady = false;
    // Note: Keep opponent ready state as-is since they might still be ready

    // If we have socket service, emit cancel ready event
    // (This depends on backend implementation - may not be needed)
    if (
      this.socketService &&
      this.socketService.isSocketConnected() &&
      this.socketService.isRoomJoined()
    ) {
      try {
        // Check if backend supports cancel-ready event
        console.log("Emitting cancel-ready event to server");
        if (this.socketService.getSocket()) {
          this.socketService.getSocket().emit("cancel-ready", {
            roomId: this.socketService.getCurrentRoomId(),
          });
        }
      } catch (error) {
        console.warn(
          "Failed to emit cancel-ready event (backend may not support it):",
          error
        );
      }
    }

    // Clear the overlay and show ready button again
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }

    // Clear waiting screen references
    this.waitingStatusText = null;
    this.readyStatusText = null;

    console.log("Ready state reset, showing ready button again");
    console.log("Current ready states after cancel:", {
      localPlayer: this.isPlayerReady,
      opponent: this.isOpponentReady,
    });

    // Show ready button again after a short delay
    this.time.delayedCall(500, () => {
      // Double check game hasn't started while we were in delay
      if (this.gameStarted) {
        console.log(
          "Game started during cancel delay, not showing ready button"
        );
        return;
      }
      this.showReadyButton();
    });
  }

  handlePause() {
    // Simplified pause for online - just show message
    console.log("Game paused in online mode");
  }

  // Essential game creation methods
  createFieldBoundaries() {
    // Create invisible walls for physics
    this.topWall = this.physics.add.staticGroup();
    this.topWall
      .create(GAME_CONFIG.CANVAS_WIDTH / 2, -10, "pixel")
      .setScale(GAME_CONFIG.CANVAS_WIDTH, 20)
      .refreshBody();

    this.ground = this.physics.add.staticGroup();
    this.ground
      .create(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.FIELD.GROUND_Y, "pixel")
      .setScale(GAME_CONFIG.CANVAS_WIDTH, 20)
      .refreshBody();

    this.leftWall = this.physics.add.staticGroup();
    this.leftWall
      .create(-10, GAME_CONFIG.CANVAS_HEIGHT / 2, "pixel")
      .setScale(20, GAME_CONFIG.CANVAS_HEIGHT)
      .refreshBody();

    this.rightWall = this.physics.add.staticGroup();
    this.rightWall
      .create(
        GAME_CONFIG.CANVAS_WIDTH + 10,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        "pixel"
      )
      .setScale(20, GAME_CONFIG.CANVAS_HEIGHT)
      .refreshBody();
  }

  createGoalPosts() {
    const goalY = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y - 80;
    const crossbarY = goalY - GAME_CONFIG.FIELD.GOAL_HEIGHT / 2;

    // Physical crossbars to block ball from entering from above
    this.leftCrossbar = this.physics.add.staticGroup();
    this.leftCrossbar
      .create(75, crossbarY, "pixel")
      .setScale(GAME_CONFIG.FIELD.GOAL_WIDTH + 100, 8)
      .refreshBody();

    this.rightCrossbar = this.physics.add.staticGroup();
    this.rightCrossbar
      .create(GAME_CONFIG.CANVAS_WIDTH - 75, crossbarY, "pixel")
      .setScale(GAME_CONFIG.FIELD.GOAL_WIDTH + 100, 8)
      .refreshBody();

    // Goal zones for collision detection
    this.leftGoalZone = this.physics.add.staticGroup();
    this.leftGoalZone
      .create(75, goalY + 10, "pixel")
      .setScale(GAME_CONFIG.FIELD.GOAL_WIDTH, GAME_CONFIG.FIELD.GOAL_HEIGHT)
      .refreshBody();

    this.rightGoalZone = this.physics.add.staticGroup();
    this.rightGoalZone
      .create(GAME_CONFIG.CANVAS_WIDTH - 75, goalY + 10, "pixel")
      .setScale(GAME_CONFIG.FIELD.GOAL_WIDTH, GAME_CONFIG.FIELD.GOAL_HEIGHT)
      .refreshBody();

    // Add net graphics
    this.leftNet = this.add
      .image(
        75,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y + 55,
        "left-net"
      )
      .setOrigin(0.5, 1)
      .setScale(0.91, 0.91)
      .setDepth(5);

    this.rightNet = this.add
      .image(
        GAME_CONFIG.CANVAS_WIDTH - 75,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y + 55,
        "right-net"
      )
      .setOrigin(0.5, 1)
      .setScale(0.91, 0.91)
      .setDepth(5);
  }

  createBall() {
    // Create the ball using an image sprite
    this.ball = this.physics.add.sprite(
      GAME_CONFIG.BALL.STARTING_POSITION.x,
      GAME_CONFIG.BALL.STARTING_POSITION.y,
      "ball"
    );

    // Scale the image to match the desired ball size
    const texture = this.textures.get("ball").getSourceImage();
    const scaleX = GAME_CONFIG.BALL.SIZE / texture.width;
    const scaleY = GAME_CONFIG.BALL.SIZE / texture.height;
    this.ball.setScale(scaleX, scaleY);

    // Set physics properties
    this.ball.setBounce(GAME_CONFIG.BALL.BOUNCE);
    this.ball.setDragX(GAME_CONFIG.BALL.DRAG_X);
    this.ball.setDragY(GAME_CONFIG.BALL.DRAG_Y);
    this.ball.setMaxVelocity(
      GAME_CONFIG.BALL.MAX_VELOCITY,
      GAME_CONFIG.BALL.MAX_VELOCITY
    );
    this.ball.setCollideWorldBounds(true);
    this.ball.body.customBoundsRectangle = new Phaser.Geom.Rectangle(
      0,
      0,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y + 20
    );

    // Note: Ball collisions will be set up after players are created
  }

  setupBallCollisions() {
    // Safety check: ensure players exist before setting up collisions
    if (
      !this.player1 ||
      !this.player1.sprite ||
      !this.player2 ||
      !this.player2.sprite
    ) {
      console.warn("Players not ready for collision setup, skipping...");
      return;
    }

    // Ball collisions with walls and ground
    this.physics.add.collider(this.ball, this.ground);
    this.physics.add.collider(this.ball, this.leftWall);
    this.physics.add.collider(this.ball, this.rightWall);
    this.physics.add.collider(this.ball, this.topWall);

    // Ball collisions with goal crossbars
    this.physics.add.collider(this.ball, this.leftCrossbar);
    this.physics.add.collider(this.ball, this.rightCrossbar);

    // Goal detection
    this.physics.add.overlap(this.ball, this.leftGoalZone, () => {
      if (this.goalCooldown <= 0 && !this.pausedForGoal) {
        this.handleGoal("player2");
      }
    });

    this.physics.add.overlap(this.ball, this.rightGoalZone, () => {
      if (this.goalCooldown <= 0 && !this.pausedForGoal) {
        this.handleGoal("player1");
      }
    });

    // Player-ball collisions
    this.physics.add.collider(
      this.player1.sprite,
      this.ball,
      (player, ball) => {
        this.lastPlayerToTouchBall = this.player1;
        this.kickBall(this.player1.sprite, ball);
      }
    );

    this.physics.add.collider(
      this.player2.sprite,
      this.ball,
      (player, ball) => {
        this.lastPlayerToTouchBall = this.player2;
        this.kickBall(this.player2.sprite, ball);
      }
    );

    console.log("Ball collisions set up successfully");
  }

  createUI() {
    // Timer display
    this.timerText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.TIMER_Y,
        "Time: 01:00",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: GAME_CONFIG.UI.FONT_SIZES.TIMER,
          fill: "#fff",
          backgroundColor: "#222",
          padding: { x: 16, y: 8 },
          align: "center",
          fontStyle: "bold",
          borderRadius: 12,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(3000);

    // Scoreboard
    this.scoreText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.SCORE_Y,
        "Player 1: 0  -  Player 2: 0",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: GAME_CONFIG.UI.FONT_SIZES.SCORE,
          fill: "#fff",
          backgroundColor: "#1976d2",
          padding: { x: 18, y: 8 },
          align: "center",
          fontStyle: "bold",
          borderRadius: 12,
          stroke: "#000",
          strokeThickness: 3,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(3000);

    // Player position indicator
    this.positionText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.SCORE_Y + 60,
        `You are: ${this.playerPosition || "Unknown"}`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "16px",
          fill: "#ffff00",
          backgroundColor: "#000",
          padding: { x: 12, y: 6 },
          align: "center",
          fontStyle: "bold",
          borderRadius: 8,
          stroke: "#000",
          strokeThickness: 2,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(3000);
  }

  createPlayerStatsDisplay() {
    // Simplified stats for online
    this.add.text(20, 90, "🔵 Player 1", {
      fontFamily: '"Press Start 2P"',
      fontSize: "16px",
      fill: "#1976d2",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 1,
    });

    this.add
      .text(GAME_CONFIG.CANVAS_WIDTH - 20, 90, "🔴 Player 2", {
        fontFamily: '"Press Start 2P"',
        fontSize: "16px",
        fill: "#d32f2f",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 1,
      })
      .setOrigin(1, 0);
  }

  updateScoreDisplay() {
    const scoreString = `🔵 Player 1: ${this.player1Score}  -  Player 2: ${this.player2Score} 🔴`;
    this.scoreText.setText(scoreString);
  }

  updateTimerDisplay() {
    const minutes = Math.floor(this.gameTime / 60);
    const seconds = this.gameTime % 60;
    const timeString = `⏱️ ${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    let timerColor = "#ffffff";
    let backgroundColor = "#222222";
    if (this.gameTime <= 10) {
      timerColor = "#ff0000";
      backgroundColor = "#330000";
    } else if (this.gameTime <= 30) {
      timerColor = "#ffaa00";
      backgroundColor = "#332200";
    }

    this.timerText.setStyle({
      fontSize: GAME_CONFIG.UI.FONT_SIZES.TIMER,
      fill: timerColor,
      backgroundColor,
      padding: { x: 16, y: 8 },
      align: "center",
    });

    this.timerText.setText(timeString);
  }

  updatePositionIndicator() {
    if (this.positionText) {
      this.positionText.setText(
        `${this.playerPosition} | Move: WASD/Arrows | Kick: Space/Enter/Shift`
      );
    }
  }

  updatePlayerStatsDisplay() {
    // Simplified for online
  }

  updateTimer() {
    if (this.gameOver || this.pausedForGoal || this.isPaused) return;

    this.gameTime--;
    this.updateTimerDisplay();

    if (this.gameTime <= 0) {
      this.handleGameEnd();
      return;
    }
  }

  checkBallBounds() {
    if (
      this.ball.y > GAME_CONFIG.CANVAS_HEIGHT + 50 ||
      this.ball.x < -50 ||
      this.ball.x > GAME_CONFIG.CANVAS_WIDTH + 50
    ) {
      this.resetBall();
    }
  }

  resetBall() {
    this.ball.setPosition(
      GAME_CONFIG.BALL.STARTING_POSITION.x,
      GAME_CONFIG.BALL.STARTING_POSITION.y
    );
    this.ball.body.setVelocity(0, 0);
  }

  schedulePowerupSpawn() {
    // Simplified for online - may implement later
  }

  handleMatchEnded(data) {
    this.gameOver = true;
    this.player1Score = data.finalScore?.player1 || 0;
    this.player2Score = data.finalScore?.player2 || 0;
    this.updateScoreDisplay();
    this.handleGameEnd();
  }

  handleGoalScored(data) {
    const scorer = data.scorer;
    if (scorer === "player1") {
      this.player1Score++;
    } else if (scorer === "player2") {
      this.player2Score++;
    }
    this.updateScoreDisplay();
    this.showEnhancedGoalEffect();
    this.resetAfterGoal();
  }

  handleGoal(scoringPlayer) {
    if (this.gameOver || this.pausedForGoal || this.goalCooldown > 0) return;

    // Update score
    if (scoringPlayer === "player1") {
      this.player1Score++;
    } else {
      this.player2Score++;
    }

    // Enhanced goal effects
    this.updateScoreDisplay();
    this.showEnhancedGoalEffect();

    // Send goal to server
    if (this.socketService && this.gameStarted) {
      console.log("Sending goal to server:", scoringPlayer);
      this.socketService.scoreGoal(scoringPlayer);
    }

    this.goalCooldown = GAME_CONFIG.GOAL_COOLDOWN;
    this.pausedForGoal = true;

    // Reset after goal
    this.time.delayedCall(GAME_CONFIG.GOAL_PAUSE_DURATION, () => {
      this.resetAfterGoal();
    });
  }

  resetAfterGoal() {
    this.resetBall();
    this.resetPlayerPositions();
    this.pausedForGoal = false;
    this.goalCooldown = 0;
  }

  showEnhancedGoalEffect() {
    // Simplified goal effect for online
    console.log("GOAL!");
  }

  handleGameEnd() {
    this.gameOver = true;
    if (this.timerEvent) this.timerEvent.destroy();
    console.log("Online game ended");
  }

  kickBall(player, ball) {
    if (!player || !ball || !ball.body) return;

    const direction = player.direction || 1;
    const kickPower = 600;

    // Calculate kick direction based on player position and direction
    const kickVelocityX = direction * kickPower;
    const kickVelocityY = -300; // Add some upward force

    ball.body.setVelocity(kickVelocityX, kickVelocityY);

    console.log(
      `Player kicked ball with power ${kickPower} in direction ${direction}`
    );
  }

  handleRemotePlayerPosition(data) {
    if (data.position === this.playerPosition) return;

    const remotePlayer = this.player2;
    if (remotePlayer && remotePlayer.handlePositionUpdate) {
      remotePlayer.handlePositionUpdate(data.player);
    }
  }

  handleRemoteBallState(data) {
    if (this.isBallAuthority) return;

    if (this.ball) {
      this.ball.x = data.ball.x;
      this.ball.y = data.ball.y;
      this.ball.body.setVelocity(data.ball.velocityX, data.ball.velocityY);
    }
  }

  handleGameStateUpdate(data) {
    // Handle comprehensive game state updates from backend
    // This processes the continuous game-state events

    if (!this.gameStarted || !data.gameState) return;

    const gameState = data.gameState;

    // Update ball state if we're not the ball authority
    if (!this.isBallAuthority && gameState.ball) {
      if (this.ball) {
        this.ball.x = gameState.ball.x;
        this.ball.y = gameState.ball.y;
        if (this.ball.body) {
          this.ball.body.setVelocity(
            gameState.ball.velocityX || 0,
            gameState.ball.velocityY || 0
          );
        }
      }
    }

    // Update player positions from game state
    if (gameState.players) {
      Object.keys(gameState.players).forEach((playerId) => {
        const playerData = gameState.players[playerId];

        // Skip updating our own player position
        if (playerId === this.socketService?.getSocket()?.id) return;

        // Update remote player (player2) position
        if (this.player2 && this.player2.sprite && playerData) {
          this.player2.sprite.x = playerData.x || this.player2.sprite.x;
          this.player2.sprite.y = playerData.y || this.player2.sprite.y;

          if (
            this.player2.sprite.body &&
            playerData.velocityX !== undefined &&
            playerData.velocityY !== undefined
          ) {
            this.player2.sprite.body.setVelocity(
              playerData.velocityX,
              playerData.velocityY
            );
          }

          // Update player direction if available
          if (playerData.direction !== undefined) {
            this.player2.direction = playerData.direction;
          }
        }
      });
    }

    // Update scores if they've changed
    if (gameState.score) {
      if (
        gameState.score.player1 !== undefined &&
        gameState.score.player1 !== this.player1Score
      ) {
        this.player1Score = gameState.score.player1;
        this.updateScoreDisplay();
      }
      if (
        gameState.score.player2 !== undefined &&
        gameState.score.player2 !== this.player2Score
      ) {
        this.player2Score = gameState.score.player2;
        this.updateScoreDisplay();
      }
    }

    // Update game time if provided
    if (
      gameState.timeRemaining !== undefined &&
      gameState.timeRemaining !== this.gameTime
    ) {
      this.gameTime = gameState.timeRemaining;
      this.updateTimerDisplay();
    }

    // Handle game end conditions
    if (gameState.gameEnded && !this.gameOver) {
      this.gameOver = true;
      this.handleGameEnd();
    }
  }

  handleRemotePlayerInput(data) {
    if (data.playerId === this.socketService?.getSocket()?.id) return;

    const remotePlayer = this.player2;
    if (remotePlayer && remotePlayer.handleRemoteInput) {
      remotePlayer.handleRemoteInput(data);
    }
  }

  handleInput() {
    if (!this.gameStarted || !this.socketService || !this.player1) return;

    const cursors = this.input.keyboard.createCursorKeys();
    const wasd = this.input.keyboard.addKeys("W,S,A,D");
    const spaceKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    const enterKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER
    );
    const shiftKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );

    // Handle left movement
    if (cursors.left.isDown || wasd.A.isDown) {
      if (!this.leftPressed) {
        this.leftPressed = true;
        this.socketService.sendMoveLeft(true);
      }
      this.player1.sprite.x -= this.playerSpeed;
      this.player1.direction = -1;
    } else {
      if (this.leftPressed) {
        this.leftPressed = false;
        this.socketService.sendMoveLeft(false);
      }
    }

    // Handle right movement
    if (cursors.right.isDown || wasd.D.isDown) {
      if (!this.rightPressed) {
        this.rightPressed = true;
        this.socketService.sendMoveRight(true);
      }
      this.player1.sprite.x += this.playerSpeed;
      this.player1.direction = 1;
    } else {
      if (this.rightPressed) {
        this.rightPressed = false;
        this.socketService.sendMoveRight(false);
      }
    }

    // Handle jump
    if ((cursors.up.isDown || wasd.W.isDown) && this.player1.isOnGround) {
      if (!this.jumpPressed) {
        this.jumpPressed = true;
        this.socketService.sendJump(true);
      }
      this.player1.sprite.body.setVelocityY(-this.jumpPower);
      this.player1.isOnGround = false;
    } else {
      if (this.jumpPressed) {
        this.jumpPressed = false;
        this.socketService.sendJump(false);
      }
    }

    // Handle kick - Multiple keys for better accessibility
    if (spaceKey.isDown || enterKey.isDown || shiftKey.isDown) {
      if (!this.kickPressed) {
        this.kickPressed = true;
        this.socketService.sendKick(true);
        this.performKick();
      }
    } else {
      if (this.kickPressed) {
        this.kickPressed = false;
        this.socketService.sendKick(false);
      }
    }

    // Keep player within bounds
    this.player1.sprite.x = Phaser.Math.Clamp(
      this.player1.sprite.x,
      50,
      GAME_CONFIG.CANVAS_WIDTH - 50
    );

    // Send player position if it has changed significantly
    this.sendPlayerPosition();
  }

  sendPlayerPosition() {
    if (!this.socketService || !this.player1 || !this.player1.sprite) return;

    // Only send if position changed significantly
    const dx = Math.abs(this.player1.sprite.x - this.lastSentPosition.x);
    const dy = Math.abs(this.player1.sprite.y - this.lastSentPosition.y);

    if (dx > this.positionSendThreshold || dy > this.positionSendThreshold) {
      this.socketService.sendPlayerPosition({
        position: this.playerPosition,
        player: {
          x: this.player1.sprite.x,
          y: this.player1.sprite.y,
          velocityX: this.player1.sprite.body
            ? this.player1.sprite.body.velocity.x
            : 0,
          velocityY: this.player1.sprite.body
            ? this.player1.sprite.body.velocity.y
            : 0,
          direction: this.player1.direction
            ? this.player1.direction.toString()
            : "1",
          isOnGround: this.player1.isOnGround || false,
        },
      });

      this.lastSentPosition.x = this.player1.sprite.x;
      this.lastSentPosition.y = this.player1.sprite.y;
    }
  }

  sendBallPosition() {
    if (!this.socketService || !this.ball || !this.isBallAuthority) return;

    this.socketService.sendBallState({
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        velocityX: this.ball.body ? this.ball.body.velocity.x : 0,
        velocityY: this.ball.body ? this.ball.body.velocity.y : 0,
      },
    });
  }

  // Socket event handlers
  handleSocketError(data) {
    console.error("Socket error in OnlineGameScene:", data);

    // Handle different types of errors
    if (data && data.type) {
      switch (data.type) {
        case "GAME_ERROR":
          console.warn("Game error:", data.message);
          break;
        case "CONNECTION_ERROR":
          console.warn("Connection error:", data.message);
          break;
        default:
          console.warn("Unknown error type:", data);
      }
    }

    // Show error notification to user if needed
    // You could add UI feedback here
  }

  handleSocketDisconnected(data) {
    console.warn("Socket disconnected in OnlineGameScene:", data);

    // Pause the game if it's running
    if (this.gameStarted) {
      this.isPaused = true;
      // Show connection lost message
      this.showConnectionLostMessage();
    }
  }

  handleSocketReconnected(data) {
    console.log("Socket reconnected in OnlineGameScene:", data);

    // Resume the game if it was paused due to disconnection
    if (this.isPaused) {
      this.isPaused = false;
      // Hide connection lost message
      this.hideConnectionLostMessage();
    }
  }

  handleRematchRequest(data) {
    console.log("Rematch requested:", data);
    // Show rematch request UI
    // You could implement rematch functionality here
  }

  handleRematchConfirmed(data) {
    console.log("Rematch confirmed:", data);
    // Reset game state for rematch
    this.resetGameState();
  }

  handleRematchDeclined(data) {
    console.log("Rematch declined:", data);
    // Handle rematch decline
  }

  // Connection status UI helpers
  showConnectionLostMessage() {
    // Create overlay for connection lost message
    if (!this.connectionOverlay) {
      this.connectionOverlay = this.add.group();

      const overlay = this.add
        .rectangle(
          GAME_CONFIG.CANVAS_WIDTH / 2,
          GAME_CONFIG.CANVAS_HEIGHT / 2,
          GAME_CONFIG.CANVAS_WIDTH,
          GAME_CONFIG.CANVAS_HEIGHT,
          0x000000,
          0.8
        )
        .setDepth(20000);
      this.connectionOverlay.add(overlay);

      const titleText = this.add
        .text(
          GAME_CONFIG.CANVAS_WIDTH / 2,
          GAME_CONFIG.CANVAS_HEIGHT / 2 - 50,
          "CONNECTION LOST",
          {
            fontFamily: '"Press Start 2P"',
            fontSize: "32px",
            fill: "#ff4444",
            stroke: "#000000",
            strokeThickness: 4,
            align: "center",
          }
        )
        .setOrigin(0.5)
        .setDepth(20001);
      this.connectionOverlay.add(titleText);

      const statusText = this.add
        .text(
          GAME_CONFIG.CANVAS_WIDTH / 2,
          GAME_CONFIG.CANVAS_HEIGHT / 2 + 20,
          "Attempting to reconnect...",
          {
            fontFamily: '"Press Start 2P"',
            fontSize: "18px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center",
          }
        )
        .setOrigin(0.5)
        .setDepth(20001);
      this.connectionOverlay.add(statusText);
    }
  }

  hideConnectionLostMessage() {
    if (this.connectionOverlay) {
      this.connectionOverlay.clear(true, true);
      this.connectionOverlay = null;
    }
  }

  // Enhanced kick functionality for online mode
  performKick() {
    if (!this.player1 || !this.player1.sprite || !this.ball) return;

    const distance = Phaser.Math.Distance.Between(
      this.player1.sprite.x,
      this.player1.sprite.y,
      this.ball.x,
      this.ball.y
    );

    if (distance < 100) {
      this.kickBall(this.player1.sprite, this.ball);
    }
  }

  // Debug methods for ready system
  getReadyStatus() {
    return {
      isPlayerReady: this.isPlayerReady,
      isOpponentReady: this.isOpponentReady,
      gameStarted: this.gameStarted,
      hasOverlay: !!this.overlayGroup,
      overlayChildCount: this.overlayGroup
        ? this.overlayGroup.children.length
        : 0,
      socketConnected: this.socketService?.isSocketConnected(),
      roomJoined: this.socketService?.isRoomJoined(),
      playerPosition: this.playerPosition,
      roomState: this.socketService?.getCurrentRoomState(),
    };
  }

  debugReadySystem() {
    const readyStates = {
      // Local game state
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      isPaused: this.isPaused,
      pausedForGoal: this.pausedForGoal,

      // Ready states
      isPlayerReady: this.isPlayerReady,
      isOpponentReady: this.isOpponentReady,
      bothPlayersReady: this.isPlayerReady && this.isOpponentReady,

      // Player position
      playerPosition: this.playerPosition,

      // UI state
      hasOverlay: !!this.overlayGroup,
      overlayChildrenCount: this.overlayGroup
        ? this.overlayGroup.children.length
        : 0,
      hasWaitingText: !!this.waitingStatusText,
      hasReadyStatusText: !!this.readyStatusText,

      // Socket state
      socketConnected: this.socketService
        ? this.socketService.isSocketConnected()
        : false,
      roomJoined: this.socketService
        ? this.socketService.isRoomJoined()
        : false,
      playersInRoom: this.socketService
        ? this.socketService.getPlayersInRoom()
        : 0,
      currentRoomId: this.socketService
        ? this.socketService.getCurrentRoomId()
        : null,

      // Timing information
      timestamp: new Date().toISOString(),

      // Current UI text content
      waitingTextContent: this.waitingStatusText
        ? this.waitingStatusText.text
        : null,
      readyStatusTextContent: this.readyStatusText
        ? this.readyStatusText.text
        : null,
    };

    console.log("=== READY SYSTEM DEBUG INFO ===");
    console.table(readyStates);
    console.log(
      "Room state:",
      this.socketService
        ? this.socketService.getCurrentRoomState()
        : "No socket service"
    );
    console.log("================================");

    return readyStates;
  }

  // Enhanced method to force clear ready system (for debugging)
  forceResetReadySystem() {
    console.log("=== FORCE RESETTING READY SYSTEM ===");

    // Reset all ready states
    this.isPlayerReady = false;
    this.isOpponentReady = false;

    // Clear all UI
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }

    this.waitingStatusText = null;
    this.readyStatusText = null;

    // Reset game state flags
    this.gameStarted = false;
    this.gameOver = false;
    this.pausedForGoal = false;

    console.log("Ready system reset complete");
    console.log("New state:", this.debugReadySystem());

    // Show ready button if appropriate
    if (!this.gameStarted) {
      this.time.delayedCall(1000, () => {
        this.showReadyButton();
      });
    }
  }

  // Expose debug method globally
  exposeDebugMethods() {
    if (typeof window !== "undefined") {
      // Enhanced debug methods for troubleshooting
      window.__HEADBALL_DEBUG_READY = () => this.debugReadySystem();
      window.__HEADBALL_FORCE_RESET_READY = () => this.forceResetReadySystem();
      window.__HEADBALL_FORCE_GAME_START = () => {
        console.log("Force starting game...");
        this.handleGameStarted({
          forcedStart: true,
          timestamp: Date.now(),
        });
      };
      window.__HEADBALL_GET_GAME_STATE = () => ({
        gameStarted: this.gameStarted,
        isPlayerReady: this.isPlayerReady,
        isOpponentReady: this.isOpponentReady,
        playerPosition: this.playerPosition,
        hasOverlay: !!this.overlayGroup,
        socketConnected: this.socketService?.isSocketConnected(),
        roomJoined: this.socketService?.isRoomJoined(),
        playersInRoom: this.socketService?.getPlayersInRoom(),
      });
      window.__HEADBALL_FORCE_READY = () => {
        console.log("Force ready up...");
        this.handleReady();
      };
      window.__HEADBALL_FORCE_CANCEL_READY = () => {
        console.log("Force cancel ready...");
        this.cancelReady();
      };

      // NEW: Monitor ready events to detect the bug
      window.__HEADBALL_MONITOR_READY_EVENTS = () => {
        console.log("🔍 Setting up ready event monitoring...");
        const originalHandlePlayerReady = this.handlePlayerReady.bind(this);
        this.handlePlayerReady = (data) => {
          console.log("🔔 READY EVENT INTERCEPTED:", {
            eventData: data,
            currentLocalPosition: this.playerPosition,
            currentLocalReady: this.isPlayerReady,
            currentOpponentReady: this.isOpponentReady,
            timestamp: new Date().toISOString(),
          });

          // Call original method
          const result = originalHandlePlayerReady(data);

          console.log("🔔 AFTER PROCESSING READY EVENT:", {
            newLocalReady: this.isPlayerReady,
            newOpponentReady: this.isOpponentReady,
            bothReady: this.isPlayerReady && this.isOpponentReady,
          });

          return result;
        };
        console.log("✅ Ready event monitoring enabled");
      };

      console.log("🎮 Debug methods exposed to window:");
      console.log(
        "  __HEADBALL_DEBUG_READY() - Show detailed ready system state"
      );
      console.log(
        "  __HEADBALL_FORCE_RESET_READY() - Reset ready system completely"
      );
      console.log("  __HEADBALL_FORCE_GAME_START() - Force start the game");
      console.log("  __HEADBALL_GET_GAME_STATE() - Get current game state");
      console.log("  __HEADBALL_FORCE_READY() - Force ready up");
      console.log("  __HEADBALL_FORCE_CANCEL_READY() - Force cancel ready");
      console.log(
        "  __HEADBALL_MONITOR_READY_EVENTS() - Monitor ready events for debugging"
      );
    }
  }

  handleGameEnded(data) {
    console.log("Game ended from backend:", data);

    this.gameOver = true;

    // Update final scores
    if (data.finalScore) {
      this.player1Score = data.finalScore.player1 || 0;
      this.player2Score = data.finalScore.player2 || 0;
      this.updateScoreDisplay();
    }

    // Stop timer
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }

    // Show game end overlay with results
    this.showGameEndScreen(data);

    console.log(
      `Game ended: ${data.reason}, Winner: ${data.winner}, Duration: ${data.duration}s`
    );
  }

  showGameEndScreen(gameEndData) {
    // Clear any existing overlays
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }

    this.overlayGroup = this.add.group();

    // Semi-transparent background
    const overlay = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        GAME_CONFIG.CANVAS_WIDTH,
        GAME_CONFIG.CANVAS_HEIGHT,
        0x000000,
        0.8
      )
      .setDepth(9999);
    this.overlayGroup.add(overlay);

    // Game Over title
    const titleText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 150,
        "GAME OVER",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "48px",
          fill: "#ff4444",
          stroke: "#000000",
          strokeThickness: 6,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(titleText);

    // Winner announcement
    let winnerText = "DRAW!";
    let winnerColor = "#ffaa00";

    if (gameEndData.winner === "player1") {
      winnerText = "PLAYER 1 WINS!";
      winnerColor = "#1976d2";
    } else if (gameEndData.winner === "player2") {
      winnerText = "PLAYER 2 WINS!";
      winnerColor = "#d32f2f";
    }

    const winner = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 80,
        winnerText,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "32px",
          fill: winnerColor,
          stroke: "#000000",
          strokeThickness: 4,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(winner);

    // Final score
    const scoreText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 20,
        `Final Score: ${this.player1Score} - ${this.player2Score}`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "24px",
          fill: "#ffffff",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(scoreText);

    // Game details
    const reasonText =
      gameEndData.reason === "time-up"
        ? "Time's Up!"
        : `Game ended: ${gameEndData.reason}`;
    const detailsText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 30,
        reasonText,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "18px",
          fill: "#cccccc",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(detailsText);

    // Duration
    const duration = Math.floor(gameEndData.duration || 0);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    const durationText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 70,
        `Match Duration: ${minutes}:${seconds.toString().padStart(2, "0")}`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "16px",
          fill: "#aaaaaa",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(durationText);

    // Add pulsing effect to winner text
    this.tweens.add({
      targets: winner,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: "Power2",
    });
  }
}
