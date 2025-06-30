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
    this.playerSpeed = GAME_CONFIG.PLAYER.BASE_SPEED * 2.0; // Match PLAYER1/PLAYER2 speed attribute
    this.jumpPower = Math.abs(GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY); // Convert to positive value

    // Initialize input tracking
    this.leftPressed = false;
    this.rightPressed = false;
    this.jumpPressed = false;
    this.kickPressed = false;

    // Initialize last sent position for optimization
    this.lastSentPosition = { x: 0, y: 0, time: 0 }; // Include time field for throttling
    this.positionSendThreshold = 5; // Only send if moved more than 5 pixels
    this.lastPositionSendTime = 0; // Add time-based throttling

    // Initialize ready state tracking
    this.isPlayerReady = false;
    this.isOpponentReady = false;

    // Add new property for assumed position
    this._assumedPosition = null;

    // Initialize rematch state tracking
    this.rematchState = {
      player1Requested: false,
      player2Requested: false,
      timeoutActive: false,
    };
  }

  init(data) {
    // For online games, get player position from backend (don't use hash)
    if (typeof window !== "undefined") {
      // Check if position was already set by room events
      this.playerPosition = window.__HEADBALL_PLAYER_POSITION || null;

      console.log("=== ONLINE POSITION INIT DEBUG ===");
      console.log("Initial player position:", this.playerPosition);

      // If no position set yet, it will be set when room-joined event is received
      if (!this.playerPosition) {
        console.log(
          "⏳ Player position not set yet - will be set by room events"
        );
        // Set temporary defaults that will be overridden
        this.playerPosition = "player1"; // Temporary fallback
        this.isBallAuthority = true;
      } else {
        this.isBallAuthority = this.playerPosition === "player1";
        console.log("✅ Using existing player position:", this.playerPosition);
        console.log("Ball authority:", this.isBallAuthority);
      }

      console.log("=== END ONLINE POSITION INIT ===");

      // Store ball authority in global scope for debugging
      window.__HEADBALL_IS_BALL_AUTHORITY = this.isBallAuthority;

      // Record what position we assumed at init so we can correct later
      this._assumedPosition = this.playerPosition;
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

    // Set up keyboard controls (like GameScene)
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.space = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.enter = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ENTER
    );
    this.shift = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT
    );

    // Create physics world boundaries
    this.createFieldBoundaries();

    // Create goal posts
    this.createGoalPosts();

    // Create players FIRST
    this.createPlayers();

    // Create ball AFTER players
    this.createBall();

    // Set up ball collisions AFTER both players and ball are created
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
    console.log("Player1 exists:", !!this.player1);
    console.log("Player2 exists:", !!this.player2);
    console.log("Ball exists:", !!this.ball);
    console.log("Ball has physics body:", !!(this.ball && this.ball.body));
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

    // Initialize rematch state tracking
    this.rematchState = {
      player1Requested: false,
      player2Requested: false,
      timeoutActive: false,
    };

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

    // CRITICAL: Room events to get correct player position
    this.socketService.on("room-joined", (data) => {
      console.log("🏠 Room joined event received:", data);
      this.handleRoomJoinedEvent(data);
    });

    this.socketService.on("room-created", (data) => {
      console.log("🏠 Room created event received:", data);
      this.handleRoomJoinedEvent(data);
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
      console.log("📡 Game-state event received:", {
        hasGameState: !!data.gameState,
        hasTimeRemaining: data.gameState?.timeRemaining !== undefined,
        timeRemaining: data.gameState?.timeRemaining,
        currentLocalTime: this.gameTime,
        gameStarted: this.gameStarted,
        timestamp: new Date().toISOString(),
      });
      this.handleGameStateUpdate(data);
    });

    // Timer events - Server-controlled timer system
    this.socketService.on("timer-update", (data) => {
      console.log("Received timer-update event:", data);
      this.handleTimerUpdate(data);
    });

    this.socketService.on("game-time", (data) => {
      console.log("Received game-time event:", data);
      this.handleGameTimeUpdate(data);
    });

    this.socketService.on("timer-warning", (data) => {
      console.log("Received timer-warning event:", data);
      this.handleTimerWarning(data);
    });

    this.socketService.on("time-up", (data) => {
      console.log("Received time-up event:", data);
      this.handleTimeUp(data);
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
    this.socketService.on("rematch-requested", (data) => {
      console.log("🔄 Rematch requested by opponent:", data);

      if (!this.gameOver) {
        console.warn("Received rematch request but game is not over");
        return;
      }

      // Update rematch state
      this.rematchState = data.rematchState || {};

      // Show rematch request notification
      this.showRematchRequestOverlay(data);

      // Update rematch status display
      this.updateRematchStatusDisplay();

      // Show notification message
      this.showMessage(
        `${data.requesterUsername || "Opponent"} wants a rematch!`,
        4000
      );
    });

    this.socketService.on("rematch-confirmed", (data) => {
      console.log("✅ Rematch confirmed by both players:", data);

      // Show confirmation message
      this.showMessage("Rematch accepted! Starting new game...", 3000);

      // Clear current overlay
      if (this.overlayGroup) {
        this.overlayGroup.clear(true, true);
        this.overlayGroup = null;
      }

      // Reset game state for rematch
      this.resetGameStateForRematch();

      // The server will send a new game-started event
    });

    this.socketService.on("rematch-declined", (data) => {
      console.log("❌ Rematch declined:", data);

      // Show decline message
      this.showMessage("Opponent declined rematch. Returning to menu...", 3000);

      // Update rematch button to show declined state
      this.updateRematchButtonState("REMATCH DECLINED", 0xff4444, false);

      // Automatically leave room after a delay
      this.time.delayedCall(3000, () => {
        this.leaveRoom();
      });
    });

    // Powerup synchronization events
    this.socketService.on("powerup-spawned", (data) => {
      console.log("Powerup spawned by authority:", data);
      this.handleRemotePowerupSpawn(data);
    });

    this.socketService.on("powerup-collected", (data) => {
      console.log("Powerup collected by authority:", data);
      this.handleRemotePowerupCollection(data);
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
    console.log("🚀 Game started via socket:", data);
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

    console.log(`⏰ Initial game time set to: ${this.gameTime} seconds`);
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

    console.log("🎮 Online game is now active!");
    console.log(`⏰ Timer should be running from ${this.gameTime}s`);

    // Force a small delay to ensure all UI updates are processed
    this.time.delayedCall(100, () => {
      console.log("Game start transition complete");
      console.log(
        `⏰ Timer status check: ${this.gameTime}s, timerEvent exists: ${!!this
          .timerEvent}`
      );
    });
  }

  resetPlayerPositions() {
    if (this.player1) {
      if (this.playerPosition === "player1") {
        // Local player is player1 (left side)
        this.player1.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x;
        this.player1.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y;
        console.log("Local player reset to left side");
      } else {
        // Local player is player2 (right side)
        this.player1.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x;
        this.player1.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;
        console.log("Local player reset to right side");
      }
      this.player1.sprite.body.setVelocity(0, 0);
    }

    if (this.player2) {
      if (this.playerPosition === "player1") {
        // Remote player is player2 (right side)
        this.player2.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x;
        this.player2.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;
        console.log("Remote player reset to right side");
      } else {
        // Remote player is player1 (left side)
        this.player2.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x;
        this.player2.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y;
        console.log("Remote player reset to left side");
      }
      this.player2.sprite.body.setVelocity(0, 0);
    }
  }

  createPlayers() {
    console.log("=== OnlineGameScene PLAYER CREATION DEBUG ===");
    console.log("Player position from backend:", this.playerPosition);
    console.log("Ball authority:", this.isBallAuthority);
    console.log(
      "PLAYER1 config position:",
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1
    );
    console.log(
      "PLAYER2 config position:",
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2
    );

    // FIXED: Player 1 (left side) always uses WASD, Player 2 (right side) always uses arrows
    // regardless of which player this client represents

    if (this.playerPosition === "player1") {
      // This client is player1 (left side of field)
      console.log(
        "Creating LOCAL player1 on LEFT side (WASD), REMOTE player2 on RIGHT side (arrows)"
      );

      // Local player: left side, WASD controls, player1 sprite
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x, // 300 (left)
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER1",
        "wasd", // Player 1 always uses WASD
        "player1"
      );

      // Remote player: right side, player2 sprite
      this.player2 = new RemotePlayer(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x, // 1200 (right)
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "PLAYER2",
        "player2"
      );
    } else {
      // This client is player2 (right side of field)
      console.log(
        "Creating LOCAL player2 on RIGHT side (arrows), REMOTE player1 on LEFT side (WASD)"
      );

      // Local player: right side, arrow controls, player2 sprite
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x, // 1200 (right)
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "PLAYER2", // This local player represents PLAYER2
        "arrows", // Player 2 always uses arrows
        "player2"
      );

      // Remote player: left side, player1 sprite
      this.player2 = new RemotePlayer(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x, // 300 (left)
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER1", // Remote player represents PLAYER1
        "player1"
      );
    }

    // Set online player properties for local player (player1)
    this.player1.isOnlinePlayer = true;
    this.player1.playerPosition = this.playerPosition;
    this.player1.socketService = this.socketService;

    // Set online player properties for remote player (player2)
    this.player2.isOnlinePlayer = true;
    this.player2.remotePlayerPosition =
      this.playerPosition === "player1" ? "player2" : "player1";

    console.log("=== FINAL PLAYER POSITIONS ===");
    console.log(
      "Local player (player1) at:",
      this.player1.sprite.x,
      this.player1.sprite.y
    );
    console.log(
      "Remote player (player2) at:",
      this.player2.sprite.x,
      this.player2.sprite.y
    );
    console.log("Local player controls:", this.player1.controls);
    console.log("Local player sprite:", this.player1.sprite.texture.key);
    console.log("Remote player sprite:", this.player2.sprite.texture.key);
    console.log("Ball authority:", this.isBallAuthority);
    console.log("=====================================");
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
    // For online multiplayer, timer is SERVER-CONTROLLED with local backup
    console.log("⏰ Starting SERVER-SYNCHRONIZED timer system");

    // Don't start a local timer unless game has actually started
    if (!this.gameStarted) {
      console.log("❌ Timer not initialized - online game not yet started");
      return;
    }

    // Use server-provided game time or default
    if (this.gameTime <= 0 || this.gameTime === GAME_CONFIG.GAME_DURATION) {
      this.gameTime = GAME_CONFIG.GAME_DURATION;
      console.log(`⏰ Using default game duration: ${this.gameTime}s`);
    } else {
      console.log(`⏰ Using server-provided game time: ${this.gameTime}s`);
    }

    this.updateTimerDisplay();

    // Start a BACKUP local timer that syncs with server updates
    if (this.timerEvent) {
      console.log("⏰ Destroying existing timer event");
      this.timerEvent.destroy();
    }

    // Server sync timer - much slower, just for backup
    this.timerEvent = this.time.addEvent({
      delay: 5000, // 5 seconds - very slow backup
      callback: this.syncTimerWithServer,
      callbackScope: this,
      loop: true,
    });

    // Track when we last received a server update
    this.lastServerTimerUpdate = Date.now();
    this.serverTimerUpdateTimeout = 10000; // 10 seconds timeout

    console.log(
      `✅ Server-synchronized timer started! Initial time: ${this.gameTime}s`
    );
  }

  syncTimerWithServer() {
    if (!this.gameStarted || this.gameOver) return;

    const timeSinceServerUpdate = Date.now() - this.lastServerTimerUpdate;

    // If we haven't heard from server in a while, request sync
    if (timeSinceServerUpdate > this.serverTimerUpdateTimeout) {
      console.warn("⚠️ Timer sync timeout - requesting server update");
      if (this.socketService && this.socketService.isSocketConnected()) {
        this.socketService.getSocket().emit("request-timer-sync", {
          roomId: this.socketService.getCurrentRoomId(),
          localTime: this.gameTime,
        });
      }
    }
  }

  updateTimer() {
    // DEPRECATED: This method is replaced by server-driven timer
    // Keeping for compatibility but logging warning
    console.warn("⚠️ updateTimer() called - this should be server-driven now");
    this.updateTimerBackup();
  }

  updateTimerBackup() {
    // Backup timer: only run if we haven't received server updates recently
    const timeSinceServerUpdate = Date.now() - this.lastServerTimerUpdate;

    console.log(
      `⏰ updateTimerBackup() called - gameStarted: ${this.gameStarted}, gameOver: ${this.gameOver}, isPaused: ${this.isPaused}, gameTime: ${this.gameTime}, timeSinceServerUpdate: ${timeSinceServerUpdate}ms`
    );

    if (!this.gameStarted || this.gameOver || this.isPaused) {
      console.log(
        `❌ Backup timer update skipped - gameStarted: ${this.gameStarted}, gameOver: ${this.gameOver}, isPaused: ${this.isPaused}`
      );
      return;
    }

    // Only run backup timer if server updates are stale
    if (timeSinceServerUpdate < this.serverTimerUpdateTimeout) {
      console.log(`✅ Server timer is active, skipping backup timer`);
      return;
    }

    console.log(`⚠️ Server timer appears stale, running backup timer`);

    // Stop timer if game time is 0 or negative
    if (this.gameTime <= 0) {
      console.log(`⏰ Backup timer reached 0 - stopping local timer`);
      this.gameTime = 0;
      this.updateTimerDisplay();

      // Stop the timer to prevent infinite logging
      if (this.timerEvent) {
        this.timerEvent.destroy();
        this.timerEvent = null;
        console.log("⏰ Backup timer stopped at 0 seconds");
      }

      // Wait for server to send game-ended event
      console.log("⏰ Waiting for server to confirm game end");
      return;
    }

    // Count down locally as backup
    this.gameTime--;
    this.updateTimerDisplay();

    console.log(`⏰ Backup timer: ${this.gameTime}s remaining`);
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

  schedulePowerupSpawn() {
    if (this.gameOver) return;

    const delay = Phaser.Math.Between(
      GAME_CONFIG.POWERUPS.SPAWN_INTERVAL_MIN,
      GAME_CONFIG.POWERUPS.SPAWN_INTERVAL_MAX
    );

    this.powerupSpawnTimer = this.time.delayedCall(delay, () => {
      this.spawnPowerup();
      this.schedulePowerupSpawn();
    });
  }

  spawnPowerup() {
    if (this.gameOver) return;

    // Random position in upper half of field
    const x = Phaser.Math.Between(100, GAME_CONFIG.CANVAS_WIDTH - 100);
    const y = Phaser.Math.Between(150, 350);

    // Random power-up type
    const types = Object.keys(GAME_CONFIG.POWERUPS.TYPES);
    const randomType = types[Phaser.Math.Between(0, types.length - 1)];
    const powerupConfig = GAME_CONFIG.POWERUPS.TYPES[randomType];

    // Create power-up visual
    const powerup = this.add.circle(
      x,
      y,
      GAME_CONFIG.POWERUPS.SIZE,
      powerupConfig.color
    );
    powerup.setStrokeStyle(4, 0xffffff);
    powerup.setDepth(800);

    // Add icon text
    const icon = this.add.text(x, y, powerupConfig.icon, {
      fontFamily: '"Press Start 2P"',
      fontSize: "20px",
      fill: "#ffffff",
    });
    icon.setOrigin(0.5, 0.5);
    icon.setDepth(801);

    // Add physics
    this.physics.add.existing(powerup);
    powerup.body.setCircle(GAME_CONFIG.POWERUPS.SIZE);
    powerup.body.setImmovable(true);
    powerup.body.setGravityY(-GAME_CONFIG.GRAVITY);
    powerup.body.setVelocity(0, 0);

    // Floating animation
    this.tweens.add({
      targets: [powerup, icon],
      y: y - 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Glowing effect
    this.tweens.add({
      targets: powerup,
      alpha: 0.7,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Store power-up data
    const powerupData = {
      sprite: powerup,
      icon: icon,
      type: randomType,
      config: powerupConfig,
      collected: false,
      lifetimeTimer: null,
      id: `powerup_${Date.now()}_${Math.random()}`,
    };

    this.powerups.push(powerupData);

    // Broadcast powerup spawn to other players
    if (this.socketService && this.socketService.isSocketConnected()) {
      this.socketService.getSocket().emit("powerup-spawned", {
        id: powerupData.id,
        x: x,
        y: y,
        type: randomType,
        timestamp: Date.now(),
      });
    }

    // Collision with ball
    this.physics.add.overlap(this.ball, powerup, () => {
      this.collectPowerup(powerupData);
    });

    // Auto-remove after lifetime
    powerupData.lifetimeTimer = this.time.delayedCall(
      GAME_CONFIG.POWERUPS.LIFETIME,
      () => {
        this.removePowerup(powerupData);
      }
    );
  }

  collectPowerup(powerupData) {
    if (powerupData.collected) return;

    // Broadcast powerup collection to other players
    if (
      this.socketService &&
      this.socketService.isSocketConnected() &&
      powerupData.id
    ) {
      this.socketService.getSocket().emit("powerup-collected", {
        id: powerupData.id,
        collectorPosition:
          this.lastPlayerToTouchBall?.playerPosition || this.playerPosition,
        timestamp: Date.now(),
      });
    }

    // Create particle effect at collection point
    this.createParticleEffect(
      powerupData.sprite.x,
      powerupData.sprite.y,
      powerupData.config.color,
      GAME_CONFIG.POWERUPS.PARTICLE_COUNT
    );

    // Apply power-up to last player who touched the ball
    if (this.lastPlayerToTouchBall) {
      this.lastPlayerToTouchBall.applyPowerup(powerupData.type);

      // Show notification
      this.showPowerupNotification(
        powerupData.config.name,
        this.lastPlayerToTouchBall
      );
    }

    this.removePowerup(powerupData);
  }

  removePowerup(powerupData) {
    if (powerupData.collected) return;
    powerupData.collected = true;

    // Cancel timer
    if (powerupData.lifetimeTimer) {
      powerupData.lifetimeTimer.destroy();
      powerupData.lifetimeTimer = null;
    }

    // Remove from array
    const index = this.powerups.indexOf(powerupData);
    if (index > -1) {
      this.powerups.splice(index, 1);
    }

    // Destroy sprites
    if (powerupData.sprite && powerupData.sprite.active) {
      powerupData.sprite.destroy();
    }
    if (powerupData.icon && powerupData.icon.active) {
      powerupData.icon.destroy();
    }
  }

  showPowerupNotification(powerupName, player) {
    const playerName = player.attributes?.name || "Player";
    const text = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      200,
      `${playerName} got ${powerupName}!`,
      {
        fontSize: "24px",
        fill: "#ffff00",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
      }
    );
    text.setOrigin(0.5, 0.5);
    text.setDepth(2000);

    // Animate notification
    this.tweens.add({
      targets: text,
      y: 150,
      alpha: 0,
      duration: 2000,
      ease: "Power2",
      onComplete: () => {
        text.destroy();
      },
    });
  }

  createParticleEffect(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const size = Phaser.Math.Between(2, 6);
      const particle = this.add.circle(x, y, size, color, 0.8);
      particle.setDepth(1000);

      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(50, 150);
      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      this.tweens.add({
        targets: particle,
        x: x + velocityX,
        y: y + velocityY,
        alpha: 0,
        scale: 0,
        duration: 800,
        ease: "Power2",
        onComplete: () => particle.destroy(),
      });
    }
  }

  update() {
    // SAFETY CHECK: If game has started but we still have overlay screens, clear them
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
    if (!this.gameStarted) return;

    // Update player physics and ground state (like GameScene)
    if (this.player1 && this.player1.sprite && this.player1.sprite.body) {
      this.player1.isOnGround =
        this.player1.sprite.body.touching.down ||
        this.player1.sprite.body.onFloor();

      // Call player1 update method if it exists
      if (typeof this.player1.update === "function") {
        this.player1.update();
      }
    }

    // Update remote player (player2)
    if (this.player2 && this.player2.sprite && this.player2.sprite.body) {
      this.player2.isOnGround =
        this.player2.sprite.body.touching.down ||
        this.player2.sprite.body.onFloor();

      // Call player2 update method to handle position interpolation
      if (typeof this.player2.update === "function") {
        this.player2.update();
      }
    }

    // Handle input for the local player
    this.handleInput();

    // Only ball authority sends ball state updates
    if (this.isBallAuthority && this.ball) {
      this.sendBallPosition();
    }

    // Decrease goal cooldown
    if (this.goalCooldown > 0) this.goalCooldown--;

    // Check ball bounds and reset if needed
    this.checkBallBounds();

    // Update UI displays
    this.updatePlayerStatsDisplay();
  }

  // Add new method for ball-player collision detection
  checkBallPlayerCollisions() {
    if (!this.ball || !this.ball.body) return;

    // Check collision with local player (player1)
    if (this.player1 && this.player1.sprite && this.player1.sprite.body) {
      const distance1 = Phaser.Math.Distance.Between(
        this.player1.sprite.x,
        this.player1.sprite.y,
        this.ball.x,
        this.ball.y
      );

      // Collision detection based on sprite sizes
      const collisionDistance = 40; // Adjust based on sprite sizes

      if (distance1 < collisionDistance) {
        this.handleBallPlayerCollision(this.player1, this.ball);
      }
    }

    // Check collision with remote player (player2)
    if (this.player2 && this.player2.sprite && this.player2.sprite.body) {
      const distance2 = Phaser.Math.Distance.Between(
        this.player2.sprite.x,
        this.player2.sprite.y,
        this.ball.x,
        this.ball.y
      );

      const collisionDistance = 40;

      if (distance2 < collisionDistance) {
        this.handleBallPlayerCollision(this.player2, this.ball);
      }
    }
  }

  // Add new method to handle ball-player collision
  handleBallPlayerCollision(player, ball) {
    if (!player || !player.sprite || !ball || !ball.body) return;

    // Prevent multiple rapid collisions
    const now = Date.now();
    if (player.lastBallCollision && now - player.lastBallCollision < 100) {
      return;
    }
    player.lastBallCollision = now;

    // Update last player to touch ball
    this.lastPlayerToTouchBall = player;

    // Calculate collision direction
    const dx = ball.x - player.sprite.x;
    const dy = ball.y - player.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    const normalX = dx / distance;
    const normalY = dy / distance;

    // Get player's current velocity for momentum transfer
    const playerVelX = player.sprite.body.velocity.x;
    const playerVelY = player.sprite.body.velocity.y;
    const playerSpeed = Math.sqrt(
      playerVelX * playerVelX + playerVelY * playerVelY
    );

    // Determine kick power based on player attributes and movement
    let kickPower = 300; // Base kick power

    // Add momentum from player movement
    kickPower += playerSpeed * 2;

    // Check if player is actively kicking (for local player)
    if (player === this.player1 && this.kickPressed) {
      kickPower *= 1.5; // Increase power for intentional kicks
      console.log("Intentional kick detected, increasing power");
    }

    // Apply kick force to ball
    const kickVelX = normalX * kickPower + playerVelX * 0.3;
    const kickVelY = normalY * kickPower + playerVelY * 0.3 - 100; // Add upward force

    // Set ball velocity
    ball.body.setVelocity(kickVelX, kickVelY);

    // Separate ball from player to prevent sticking
    ball.x += normalX * 30;
    ball.y += normalY * 30;

    console.log(
      `Ball kicked by ${player.name || "player"} with power ${kickPower}`
    );
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
    let eventPlayerPosition = data.playerPosition;

    // Fallback: try to extract playerPosition from room data if missing
    if (!eventPlayerPosition && data.room && data.room.players) {
      const playerInRoom = data.room.players.find(
        (p) => p.id === data.playerId
      );
      if (playerInRoom) {
        eventPlayerPosition = playerInRoom.position;
        console.log(
          "Extracted playerPosition from room data:",
          eventPlayerPosition
        );
      }
    }

    if (!eventPlayerPosition) {
      console.warn(
        "Ready event missing playerPosition and could not extract from room data, cannot process"
      );
      return;
    }

    if (!this.playerPosition) {
      console.warn(
        "Local playerPosition not set, cannot determine if this is for us or opponent"
      );
      return;
    }

    // Determine if this is about the opponent or self with explicit validation
    const isOpponent = eventPlayerPosition !== this.playerPosition;
    const playerName = eventPlayerPosition;

    console.log("Ready event analysis:", {
      eventPlayerPosition: eventPlayerPosition,
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

    // Goal detection - fixed to match demo logic
    this.physics.add.overlap(this.ball, this.leftGoalZone, () => {
      if (
        this.goalCooldown <= 0 &&
        !this.pausedForGoal &&
        this.isBallAuthority
      ) {
        // Left goal = player2 scores (ball goes left)
        this.handleGoal("player2");
      }
    });

    this.physics.add.overlap(this.ball, this.rightGoalZone, () => {
      if (
        this.goalCooldown <= 0 &&
        !this.pausedForGoal &&
        this.isBallAuthority
      ) {
        // Right goal = player1 scores (ball goes right)
        this.handleGoal("player1");
      }
    });

    // CRITICAL FIX: Ball-player collisions should only affect ball physics for ball authority
    // But both players need to see the collision for visual feedback
    this.physics.add.collider(
      this.player1.sprite,
      this.ball,
      (player, ball) => {
        console.log(
          "Ball collision with player1, ball authority:",
          this.isBallAuthority
        );
        this.lastPlayerToTouchBall = this.player1;

        // Only ball authority handles physics changes
        if (this.isBallAuthority) {
          this.handleBallPlayerCollision(this.player1, ball);
        }
      }
    );

    this.physics.add.collider(
      this.player2.sprite,
      this.ball,
      (player, ball) => {
        console.log(
          "Ball collision with player2, ball authority:",
          this.isBallAuthority
        );
        this.lastPlayerToTouchBall = this.player2;

        // Only ball authority handles physics changes
        if (this.isBallAuthority) {
          this.handleBallPlayerCollision(this.player2, ball);
        }
      }
    );

    console.log(
      "Ball collisions set up successfully with authority-based physics"
    );
    console.log("Ball authority:", this.isBallAuthority);
    console.log("Player position:", this.playerPosition);
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
    // Convert to integer to avoid floating point display
    const gameTimeInt = Math.floor(this.gameTime);
    const minutes = Math.floor(gameTimeInt / 60);
    const seconds = gameTimeInt % 60;
    const timeString = `⏱️ ${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    console.log(
      `🖥️ updateTimerDisplay called - gameTime: ${
        this.gameTime
      }s, timeString: "${timeString}", timerText exists: ${!!this.timerText}`
    );

    let timerColor = "#ffffff";
    let backgroundColor = "#222222";
    if (this.gameTime <= 10) {
      timerColor = "#ff0000";
      backgroundColor = "#330000";
    } else if (this.gameTime <= 30) {
      timerColor = "#ffaa00";
      backgroundColor = "#332200";
    }

    if (this.timerText) {
      this.timerText.setStyle({
        fontSize: GAME_CONFIG.UI.FONT_SIZES.TIMER,
        fill: timerColor,
        backgroundColor,
        padding: { x: 16, y: 8 },
        align: "center",
      });

      this.timerText.setText(timeString);
      console.log(`✅ Timer display updated to: "${timeString}"`);
    } else {
      console.error("❌ timerText not found! Cannot update timer display");
    }
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
    console.log("🏁 Game ending initiated");
    this.gameOver = true;
    this.gameStarted = false; // Prevent further game actions

    // Clean up any local timer events
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
      console.log("Local timer event cleaned up");
    }

    // Clean up powerup system
    if (this.powerupSpawnTimer) {
      this.powerupSpawnTimer.destroy();
      this.powerupSpawnTimer = null;
    }

    this.powerups.forEach((powerup) => {
      if (powerup.lifetimeTimer) powerup.lifetimeTimer.destroy();
      if (powerup.sprite && powerup.sprite.active) powerup.sprite.destroy();
      if (powerup.icon && powerup.icon.active) powerup.icon.destroy();
    });
    this.powerups = [];

    // Pause physics instead of stopping completely
    this.physics.world.pause();

    // Determine winner and show game end screen
    let resultMessage = "";
    let winner = "draw";

    if (this.player1Score > this.player2Score) {
      winner = "player1";
      resultMessage =
        this.playerPosition === "player1"
          ? "🏆 You Win! 🎉"
          : "💔 You Lost! 💔";
    } else if (this.player2Score > this.player1Score) {
      winner = "player2";
      resultMessage =
        this.playerPosition === "player2"
          ? "🏆 You Win! 🎉"
          : "💔 You Lost! 💔";
    } else {
      resultMessage = "🤝 It's a Draw! 🤝";
    }

    // Send game end to server if we haven't already
    if (this.socketService && this.socketService.isSocketConnected()) {
      const gameEndData = {
        finalScore: {
          player1: this.player1Score,
          player2: this.player2Score,
        },
        duration: GAME_CONFIG.GAME_DURATION - this.gameTime,
        winner: winner,
        endReason: "time_up",
      };

      console.log("📡 Sending game end to server:", gameEndData);
      this.socketService.endGame(gameEndData);
    }

    this.showGameEndOverlay(resultMessage, winner);

    console.log("🏁 Online game ended successfully");
  }

  // Show game end overlay with rematch options
  showGameEndOverlay(resultMessage, winner) {
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
        resultMessage,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "48px",
          fill:
            winner === "draw"
              ? "#ffaa00"
              : winner === this.playerPosition
              ? "#00ff00"
              : "#ff4444",
          stroke: "#000000",
          strokeThickness: 6,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(titleText);

    // Final score
    const scoreText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 80,
        `Final Score: ${this.player1Score} - ${this.player2Score}`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "32px",
          fill: "#ffffff",
          stroke: "#000000",
          strokeThickness: 4,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(scoreText);

    // Buttons
    this.createGameEndButtons();

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
  }

  createGameEndButtons() {
    const buttonWidth = 300;
    const buttonHeight = 70;
    const buttonSpacing = 90;
    const startY = GAME_CONFIG.CANVAS_HEIGHT / 2 + 20;

    // Rematch button
    const rematchButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY,
        buttonWidth,
        buttonHeight,
        0x22c55e,
        1
      )
      .setStrokeStyle(4, 0x16a34a)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(rematchButton);

    const rematchText = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, startY, "REQUEST REMATCH", {
        fontFamily: '"Press Start 2P"',
        fontSize: "20px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(10002);
    this.overlayGroup.add(rematchText);

    // Leave room button
    const leaveButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY + buttonSpacing,
        buttonWidth,
        buttonHeight,
        0xdc2626,
        1
      )
      .setStrokeStyle(4, 0x991b1b)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(leaveButton);

    const leaveText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY + buttonSpacing,
        "LEAVE ROOM",
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
      .setDepth(10002);
    this.overlayGroup.add(leaveButton);

    // Button interactions
    this.setupGameEndButtonInteractions(
      rematchButton,
      rematchText,
      leaveButton,
      leaveText
    );
  }

  setupGameEndButtonInteractions(
    rematchButton,
    rematchText,
    leaveButton,
    leaveText
  ) {
    // Rematch button
    rematchButton.on("pointerover", () => {
      rematchButton.setFillStyle(0x15803d);
      this.tweens.add({
        targets: [rematchButton, rematchText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: "Power2",
      });
    });

    rematchButton.on("pointerout", () => {
      rematchButton.setFillStyle(0x22c55e);
      this.tweens.add({
        targets: [rematchButton, rematchText],
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
        ease: "Power2",
      });
    });

    rematchButton.on("pointerdown", () => {
      this.requestRematch();
    });

    rematchText
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => {
        this.requestRematch();
      });

    // Leave button
    leaveButton.on("pointerover", () => {
      leaveButton.setFillStyle(0xb91c1c);
      this.tweens.add({
        targets: [leaveButton, leaveText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        ease: "Power2",
      });
    });

    leaveButton.on("pointerout", () => {
      leaveButton.setFillStyle(0xdc2626);
      this.tweens.add({
        targets: [leaveButton, leaveText],
        scaleX: 1.0,
        scaleY: 1.0,
        duration: 100,
        ease: "Power2",
      });
    });

    leaveButton.on("pointerdown", () => {
      this.leaveRoom();
    });

    leaveText.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.leaveRoom();
    });
  }

  // Pause functionality with socket integration
  handlePause() {
    if (this.gameOver) return;

    // Don't allow pause during goal pause or if already paused
    if (this.pausedForGoal || this.isPaused) return;

    this.isPaused = true;

    // Pause physics
    this.physics.world.pause();

    // Pause timer if it exists
    if (this.timerEvent) {
      this.timerEvent.paused = true;
    }

    // Send pause request to server
    if (this.socketService && this.socketService.isSocketConnected()) {
      console.log("Sending pause request to server");
      this.socketService.getSocket().emit("game-pause", {
        roomId: this.socketService.getCurrentRoomId(),
        pausedBy: this.playerPosition,
      });
    }

    this.showPauseOverlay();
  }

  showPauseOverlay() {
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

    // Pause title
    const titleText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 120,
        "GAME PAUSED",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "48px",
          fill: "#ffaa00",
          stroke: "#000000",
          strokeThickness: 6,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(titleText);

    // Waiting for opponent message
    const waitingText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 40,
        "Waiting for opponent to resume...",
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
      .setDepth(10000);
    this.overlayGroup.add(waitingText);

    this.createPauseButtons();

    // Pulse effect for title
    this.tweens.add({
      targets: titleText,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "Power2",
    });
  }

  createPauseButtons() {
    const buttonWidth = 280;
    const buttonHeight = 60;
    const buttonSpacing = 80;
    const startY = GAME_CONFIG.CANVAS_HEIGHT / 2 + 40;

    // Resume button
    const resumeButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY,
        buttonWidth,
        buttonHeight,
        0x22c55e,
        1
      )
      .setStrokeStyle(4, 0x16a34a)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(resumeButton);

    const resumeText = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, startY, "RESUME GAME", {
        fontFamily: '"Press Start 2P"',
        fontSize: "18px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(10002);
    this.overlayGroup.add(resumeText);

    // Leave room button
    const leaveButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY + buttonSpacing,
        buttonWidth,
        buttonHeight,
        0xdc2626,
        1
      )
      .setStrokeStyle(4, 0x991b1b)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(leaveButton);

    const leaveText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY + buttonSpacing,
        "LEAVE ROOM",
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
      .setDepth(10002);
    this.overlayGroup.add(leaveText);

    this.setupPauseButtonInteractions(
      resumeButton,
      resumeText,
      leaveButton,
      leaveText
    );
  }

  setupPauseButtonInteractions(
    resumeButton,
    resumeText,
    leaveButton,
    leaveText
  ) {
    // Resume button
    resumeButton.on("pointerover", () => {
      resumeButton.setFillStyle(0x15803d);
    });

    resumeButton.on("pointerout", () => {
      resumeButton.setFillStyle(0x22c55e);
    });

    resumeButton.on("pointerdown", () => {
      this.resumeGame();
    });

    resumeText.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.resumeGame();
    });

    // Leave button interactions (same as before)
    leaveButton.on("pointerover", () => {
      leaveButton.setFillStyle(0xb91c1c);
    });

    leaveButton.on("pointerout", () => {
      leaveButton.setFillStyle(0xdc2626);
    });

    leaveButton.on("pointerdown", () => {
      this.leaveRoom();
    });

    leaveText.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
      this.leaveRoom();
    });
  }

  resumeGame() {
    if (!this.isPaused) return;

    // Send resume request to server
    if (this.socketService && this.socketService.isSocketConnected()) {
      console.log("Sending resume request to server");
      this.socketService.getSocket().emit("game-resume", {
        roomId: this.socketService.getCurrentRoomId(),
        resumedBy: this.playerPosition,
      });
    }

    // Resume will be handled when server confirms
  }

  handleGamePaused(data) {
    console.log("Game paused by server:", data);

    if (!this.isPaused) {
      this.isPaused = true;
      this.physics.world.pause();
      if (this.timerEvent) {
        this.timerEvent.paused = true;
      }
    }

    this.showPauseOverlay();
  }

  handleGameResumed(data) {
    console.log("Game resumed by server:", data);

    if (this.isPaused) {
      this.isPaused = false;
      this.physics.world.resume();
      if (this.timerEvent) {
        this.timerEvent.paused = false;
      }

      // Clear pause overlay
      if (this.overlayGroup) {
        this.overlayGroup.clear(true, true);
        this.overlayGroup = null;
      }
    }
  }

  // Enhanced rematch functionality
  requestRematch() {
    if (!this.socketService || !this.socketService.isSocketConnected()) {
      console.error("Cannot request rematch: socket not connected");
      this.showMessage("Connection error - cannot request rematch", 3000);
      return;
    }

    if (!this.gameOver) {
      console.warn("Cannot request rematch: game not over");
      return;
    }

    console.log("🔄 Requesting rematch");
    this.socketService.requestRematch();

    // Update local rematch state
    if (this.playerPosition === "player1") {
      this.rematchState.player1Requested = true;
    } else {
      this.rematchState.player2Requested = true;
    }

    // Update the rematch status display
    this.updateRematchStatusDisplay();

    // Update button to show request sent
    const rematchButton = this.overlayGroup?.children.entries.find(
      (child) => child.type === "Rectangle" && child.fillColor === 0x22c55e
    );
    if (rematchButton) {
      rematchButton.setFillStyle(0x6b7280); // Gray out button
    }

    const rematchText = this.overlayGroup?.children.entries.find(
      (child) => child.type === "Text" && child.text === "REQUEST REMATCH"
    );
    if (rematchText) {
      rematchText.setText("REMATCH SENT...");
    }

    // Show confirmation message
    this.showMessage("Rematch request sent! Waiting for opponent...", 3000);
  }

  updateRematchButtonState(text, color, enabled) {
    if (!this.overlayGroup) return;

    const rematchButton = this.overlayGroup.children.entries.find(
      (child) =>
        child.type === "Rectangle" &&
        (child.fillColor === 0x22c55e || child.fillColor === 0x6b7280)
    );
    if (rematchButton) {
      rematchButton.setFillStyle(color);
      rematchButton.setInteractive(enabled);
    }

    const rematchText = this.overlayGroup.children.entries.find(
      (child) =>
        child.type === "Text" &&
        (child.text.includes("REMATCH") || child.text.includes("SENT"))
    );
    if (rematchText) {
      rematchText.setText(text);
    }
  }

  leaveRoom() {
    console.log("🚪 Leaving room initiated");

    // Clean up game state first
    this.cleanupGameState();

    if (this.socketService && this.socketService.isSocketConnected()) {
      console.log("📡 Emitting leave-room to server");
      this.socketService.leaveRoom();
    } else {
      console.warn("Socket not connected, performing local cleanup only");
    }

    // Clear overlay
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }

    // Show leaving message briefly
    this.showMessage("Leaving room...", 2000);

    // Navigate back to main menu after a brief delay
    this.time.delayedCall(1000, () => {
      this.restartGame();
    });
  }

  cleanupGameState() {
    console.log("🧹 Cleaning up game state");

    // Reset game flags
    this.gameStarted = false;
    this.gameOver = false;
    this.isPaused = false;
    this.pausedForGoal = false;

    // Stop timers
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }

    // Stop powerup system
    if (this.powerupSpawnTimer) {
      this.powerupSpawnTimer.destroy();
      this.powerupSpawnTimer = null;
    }

    // Clean up powerups
    this.powerups.forEach((powerup) => {
      if (powerup.lifetimeTimer) powerup.lifetimeTimer.destroy();
      if (powerup.sprite && powerup.sprite.active) powerup.sprite.destroy();
      if (powerup.icon && powerup.icon.active) powerup.icon.destroy();
    });
    this.powerups = [];

    // Resume physics in case it was paused
    if (this.physics && this.physics.world) {
      this.physics.world.resume();
    }

    // Reset scores
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameTime = GAME_CONFIG.GAME_DURATION;

    // Reset ready states
    this.isPlayerReady = false;
    this.isOpponentReady = false;

    console.log("✅ Game state cleanup complete");
  }

  restartGame() {
    // Use the callback function to return to menu
    if (typeof window !== "undefined" && window.__HEADBALL_RETURN_TO_MENU) {
      window.__HEADBALL_RETURN_TO_MENU();
    } else if (typeof window !== "undefined" && window.location) {
      // Fallback to direct navigation
      window.location.href = "/";
    }
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
    // Only process position updates for the remote player (not our own position)
    if (data.position === this.playerPosition) {
      console.log("Ignoring own position update");
      return;
    }

    console.log("📥 RECEIVING remote player position update:", {
      remotePosition: data.position,
      localPosition: this.playerPosition,
      remoteX: data.player.x,
      remoteY: data.player.y,
      remoteVelX: data.player.velocityX,
      remoteVelY: data.player.velocityY,
      timestamp: new Date().toISOString(),
    });

    const remotePlayer = this.player2;
    if (remotePlayer && remotePlayer.handlePositionUpdate) {
      // Before update
      const beforePos = {
        x: remotePlayer.sprite.x,
        y: remotePlayer.sprite.y,
      };

      remotePlayer.handlePositionUpdate(data.player);

      // After update
      const afterPos = {
        x: remotePlayer.sprite.x,
        y: remotePlayer.sprite.y,
      };

      console.log("✅ Remote player position updated:", {
        before: beforePos,
        after: afterPos,
        changed: beforePos.x !== afterPos.x || beforePos.y !== afterPos.y,
      });
    } else {
      console.warn(
        "❌ Remote player not found or missing handlePositionUpdate method:",
        {
          remotePlayerExists: !!remotePlayer,
          hasHandlePositionUpdate: !!(
            remotePlayer && remotePlayer.handlePositionUpdate
          ),
          remotePlayerType: remotePlayer
            ? remotePlayer.constructor.name
            : "null",
        }
      );

      // Fallback: directly update remote player position if method is missing
      if (remotePlayer && remotePlayer.sprite && data.player) {
        console.log("🔄 Using fallback position update");
        const oldX = remotePlayer.sprite.x;
        const oldY = remotePlayer.sprite.y;

        remotePlayer.sprite.x = data.player.x;
        remotePlayer.sprite.y = data.player.y;

        if (
          remotePlayer.sprite.body &&
          data.player.velocityX !== undefined &&
          data.player.velocityY !== undefined
        ) {
          remotePlayer.sprite.body.setVelocity(
            data.player.velocityX,
            data.player.velocityY
          );
        }

        console.log("✅ Fallback update applied:", {
          oldPos: { x: oldX, y: oldY },
          newPos: { x: remotePlayer.sprite.x, y: remotePlayer.sprite.y },
        });
      }
    }
  }

  handleRemoteBallState(data) {
    if (this.isBallAuthority) {
      console.log("🏀 Ball authority ignoring remote ball state");
      return;
    }

    console.log("🏀 RECEIVING remote ball state:", {
      remoteX: data.ball.x,
      remoteY: data.ball.y,
      remoteVelX: data.ball.velocityX,
      remoteVelY: data.ball.velocityY,
      localX: this.ball.x,
      localY: this.ball.y,
      timestamp: new Date().toISOString(),
    });

    if (this.ball) {
      // Store old position for comparison
      const oldPos = { x: this.ball.x, y: this.ball.y };

      // Improved ball state synchronization with smoother interpolation
      const lerpFactor = 0.6; // How much to trust the received state vs current state

      // Calculate position difference to detect significant changes
      const positionDiff = Math.sqrt(
        Math.pow(data.ball.x - this.ball.x, 2) +
          Math.pow(data.ball.y - this.ball.y, 2)
      );

      // If the ball position is very different, snap to it immediately (teleport correction)
      if (positionDiff > 100) {
        console.log(
          "🏀 Large ball position difference detected, snapping to server state:",
          { positionDiff, from: oldPos, to: { x: data.ball.x, y: data.ball.y } }
        );
        this.ball.x = data.ball.x;
        this.ball.y = data.ball.y;
        this.ball.body.setVelocity(data.ball.velocityX, data.ball.velocityY);
      } else {
        // Otherwise, use smooth interpolation
        this.ball.x = this.ball.x * (1 - lerpFactor) + data.ball.x * lerpFactor;
        this.ball.y = this.ball.y * (1 - lerpFactor) + data.ball.y * lerpFactor;

        // Interpolate velocity as well for smoother movement
        const currentVelX = this.ball.body.velocity.x;
        const currentVelY = this.ball.body.velocity.y;
        const newVelX =
          currentVelX * (1 - lerpFactor) + data.ball.velocityX * lerpFactor;
        const newVelY =
          currentVelY * (1 - lerpFactor) + data.ball.velocityY * lerpFactor;

        this.ball.body.setVelocity(newVelX, newVelY);

        console.log("🏀 Ball interpolated:", {
          from: oldPos,
          to: { x: this.ball.x, y: this.ball.y },
          interpolated: positionDiff <= 100,
        });
      }
    }
  }

  handleGameStateUpdate(data) {
    // Handle comprehensive game state updates from backend
    // This processes the continuous game-state events

    console.log(
      `📊 handleGameStateUpdate called - gameStarted: ${
        this.gameStarted
      }, hasGameState: ${!!data.gameState}`
    );

    if (!this.gameStarted) {
      console.log("❌ Game not started, ignoring game state update");
      return;
    }

    if (!data.gameState) {
      console.log("❌ No gameState in data, ignoring update");
      return;
    }

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
    if (gameState.timeRemaining !== undefined) {
      const oldTime = this.gameTime;

      // Only update if there's a significant difference (avoid micro-adjustments)
      if (Math.abs(gameState.timeRemaining - this.gameTime) > 1) {
        this.gameTime = gameState.timeRemaining;
        this.updateTimerDisplay();
        console.log(
          `🔄 Server timer sync: ${oldTime}s → ${this.gameTime}s (large correction)`
        );
      } else if (gameState.timeRemaining !== this.gameTime) {
        this.gameTime = gameState.timeRemaining;
        this.updateTimerDisplay();
        console.log(
          `🔄 Server timer sync: ${oldTime}s → ${this.gameTime}s (minor correction)`
        );
      }

      // Log when we receive server timer updates
      if (this.gameTime % 15 === 0 || this.gameTime <= 10) {
        console.log(`📡 Server timer update received: ${this.gameTime}s`);
      }
    }

    // Handle game end conditions
    if (gameState.gameEnded && !this.gameOver) {
      console.log("Game ended from server game state");
      this.gameOver = true;
      this.handleGameEnd();
    }

    // Handle game time-based end condition
    if (
      gameState.timeRemaining !== undefined &&
      gameState.timeRemaining <= 0 &&
      !this.gameOver
    ) {
      console.log("Game time reached 0 from server");
      this.gameTime = 0;
      this.updateTimerDisplay();
      // Wait for explicit game-ended event from server
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
    if (!this.player1.sprite || !this.player1.sprite.body) return;
    if (this.gameOver) return;

    // Allow both WASD and Arrow keys for all players
    const leftKey = this.wasd.A.isDown || this.cursors.left.isDown;
    const rightKey = this.wasd.D.isDown || this.cursors.right.isDown;
    const upKey = this.wasd.W.isDown || this.cursors.up.isDown;
    const kickKey = this.space.isDown || this.enter.isDown || this.shift.isDown;

    // Initialize speed
    const playerSpeed = GAME_CONFIG.PLAYER.BASE_SPEED * 2.0;
    const jumpPower = Math.abs(GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY);

    // Handle horizontal movement
    let horizontalVelocity = 0;

    if (leftKey) {
      if (!this.leftPressed) {
        this.leftPressed = true;
        this.socketService.sendMoveLeft(true);
      }
      horizontalVelocity = -playerSpeed;
      this.player1.direction = "left";
    } else {
      if (this.leftPressed) {
        this.leftPressed = false;
        this.socketService.sendMoveLeft(false);
      }
    }

    if (rightKey) {
      if (!this.rightPressed) {
        this.rightPressed = true;
        this.socketService.sendMoveRight(true);
      }
      horizontalVelocity = playerSpeed;
      this.player1.direction = "right";
    } else {
      if (this.rightPressed) {
        this.rightPressed = false;
        this.socketService.sendMoveRight(false);
      }
    }

    // Apply horizontal movement
    if (horizontalVelocity === 0) {
      this.player1.direction = "idle";
      // Apply friction
      const currentVelX = this.player1.sprite.body.velocity.x;
      this.player1.sprite.body.setVelocityX(currentVelX * 0.8);
    } else {
      this.player1.sprite.body.setVelocityX(horizontalVelocity);
    }

    // Handle jump
    if (upKey && this.player1.isOnGround) {
      if (!this.jumpPressed) {
        this.jumpPressed = true;
        this.socketService.sendJump(true);
        this.player1.sprite.body.setVelocityY(-jumpPower);
        this.player1.isOnGround = false;
      }
    } else {
      if (this.jumpPressed) {
        this.jumpPressed = false;
        this.socketService.sendJump(false);
      }
    }

    // Handle kick
    if (kickKey) {
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

    // Send player position updates
    this.sendPlayerPosition();
  }

  sendPlayerPosition() {
    if (!this.socketService || !this.player1 || !this.player1.sprite) {
      console.warn("Cannot send player position - missing requirements:", {
        hasSocketService: !!this.socketService,
        hasPlayer1: !!this.player1,
        hasPlayer1Sprite: !!(this.player1 && this.player1.sprite),
      });
      return;
    }

    // Initialize lastSentPosition if not set
    if (!this.lastSentPosition) {
      this.lastSentPosition = { x: 0, y: 0, time: 0 };
    }

    const now = Date.now();

    // Reduce throttle time for smoother movement (max 30 updates per second = 33ms)
    if (now - this.lastSentPosition.time < 33) {
      return;
    }

    // Send position if changed significantly OR if enough time has passed
    const dx = Math.abs(this.player1.sprite.x - this.lastSentPosition.x);
    const dy = Math.abs(this.player1.sprite.y - this.lastSentPosition.y);
    const timeSinceLastSend = now - this.lastSentPosition.time;

    // Reduced threshold for more responsive movement (was 2, now 1)
    const shouldSendPosition = dx > 1 || dy > 1 || timeSinceLastSend > 100;

    if (shouldSendPosition) {
      // CRITICAL FIX: Use the actual player position from the player object
      const actualPlayerPosition =
        this.player1.playerPosition || this.playerPosition;

      const positionData = {
        position: actualPlayerPosition, // Use the correct position
        player: {
          x: this.player1.sprite.x,
          y: this.player1.sprite.y,
          velocityX: this.player1.sprite.body
            ? this.player1.sprite.body.velocity.x
            : 0,
          velocityY: this.player1.sprite.body
            ? this.player1.sprite.body.velocity.y
            : 0,
          direction: this.player1.direction ? this.player1.direction : "idle",
          isOnGround: this.player1.isOnGround || false,
        },
      };

      console.log("📡 SENDING player position:", {
        position: positionData.position,
        x: positionData.player.x,
        y: positionData.player.y,
        dx: dx,
        dy: dy,
        timeSinceLastSend: timeSinceLastSend,
      });

      // Use socketService method directly
      this.socketService.sendPlayerPosition(positionData);

      this.lastSentPosition.x = this.player1.sprite.x;
      this.lastSentPosition.y = this.player1.sprite.y;
      this.lastSentPosition.time = now;
    }
  }

  sendBallPosition() {
    if (!this.socketService || !this.ball || !this.isBallAuthority) {
      if (!this.isBallAuthority) {
        // This is normal - only ball authority sends ball state
        return;
      }
      console.warn("Cannot send ball position - missing requirements:", {
        hasSocketService: !!this.socketService,
        hasBall: !!this.ball,
        isBallAuthority: this.isBallAuthority,
      });
      return;
    }

    // Throttle ball updates to every 33ms (30 FPS) for smoother synchronization
    const now = Date.now();
    if (!this.lastBallStateSend || now - this.lastBallStateSend > 33) {
      const ballData = {
        ball: {
          x: this.ball.x,
          y: this.ball.y,
          velocityX: this.ball.body ? this.ball.body.velocity.x : 0,
          velocityY: this.ball.body ? this.ball.body.velocity.y : 0,
        },
      };

      console.log("🏀 SENDING ball state:", {
        x: ballData.ball.x,
        y: ballData.ball.y,
        velX: ballData.ball.velocityX,
        velY: ballData.ball.velocityY,
        authority: this.isBallAuthority,
      });

      this.socketService.sendBallState(ballData);
      this.lastBallStateSend = now;
    }
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

  // Timer event handlers for server-controlled timer
  handleTimerUpdate(data) {
    if (!this.gameStarted || this.gameOver) return;

    console.log("📡 Timer-update event from server:", data);

    // Mark that we received a server timer update
    this.lastServerTimerUpdate = Date.now();

    if (data.timeRemaining !== undefined) {
      const oldTime = this.gameTime;
      this.gameTime = data.timeRemaining;
      this.updateTimerDisplay();

      console.log(`🔄 Timer-update sync: ${oldTime}s → ${this.gameTime}s`);
    }

    // Handle additional timer data
    if (data.elapsedTime !== undefined) {
      console.log(`📊 Game elapsed time: ${data.elapsedTime} seconds`);
    }
  }

  handleGameTimeUpdate(data) {
    if (!this.gameStarted || this.gameOver) return;

    console.log("📡 Game-time event from server:", data);

    // Mark that we received a server timer update
    this.lastServerTimerUpdate = Date.now();

    if (data.gameTime !== undefined) {
      const oldTime = this.gameTime;
      this.gameTime = data.gameTime;
      this.updateTimerDisplay();

      console.log(`🔄 Game-time sync: ${oldTime}s → ${this.gameTime}s`);
    }

    // Handle additional timing information
    if (data.elapsedTime !== undefined) {
      console.log(`📊 Game elapsed time: ${data.elapsedTime} seconds`);
    }

    if (data.timeRemaining !== undefined) {
      const oldTime = this.gameTime;
      this.gameTime = data.timeRemaining;
      this.updateTimerDisplay();

      console.log(
        `🔄 Game-time timeRemaining sync: ${oldTime}s → ${this.gameTime}s`
      );
    }

    if (data.matchDuration !== undefined) {
      console.log(`📊 Match duration: ${data.matchDuration} seconds`);
    }
  }

  handleTimerWarning(data) {
    console.log("⚠️ Timer warning from server:", data);

    // Mark that we received a server timer update
    this.lastServerTimerUpdate = Date.now();

    // Update time if provided
    if (data.timeRemaining !== undefined) {
      const oldTime = this.gameTime;
      this.gameTime = data.timeRemaining;
      this.updateTimerDisplay();
      console.log(`🔄 Timer warning sync: ${oldTime}s → ${this.gameTime}s`);
    }

    // Show visual/audio warning when time is low
    if (data.warning === "low-time" || data.timeRemaining <= 30) {
      console.log("⚠️ Low time warning - 30 seconds remaining!");
      this.showTimerWarning("30 seconds remaining!", "#ffaa00");
    }

    if (data.warning === "critical-time" || data.timeRemaining <= 10) {
      console.log("🚨 Critical time warning - 10 seconds remaining!");
      this.showTimerWarning("10 seconds remaining!", "#ff0000");
    }

    // Always update timer display with warning colors
    this.updateTimerDisplay();
  }

  handleTimeUp(data) {
    console.log("⏰ Time up event from server:", data);

    // Mark that we received a server timer update
    this.lastServerTimerUpdate = Date.now();

    // Server says time is up, handle game end
    this.gameTime = 0;
    this.updateTimerDisplay();

    // Stop local timer immediately
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
      console.log("⏰ Local timer stopped due to server time-up");
    }

    // Show time up effect
    this.showTimerWarning("TIME'S UP!", "#ff0000", 2000);

    // Let server handle the game end logic
    // We just update the UI to reflect time is up
    if (!this.gameOver) {
      console.log("Time's up! Waiting for server to end game...");
      // The server should send a game-ended event shortly
    }
  }

  // Helper method to show timer warnings
  showTimerWarning(message, color = "#ffaa00", duration = 1500) {
    // Create warning text
    const warningText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 100,
        message,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "32px",
          fill: color,
          stroke: "#000000",
          strokeThickness: 4,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(5000);

    // Animate warning
    this.tweens.add({
      targets: warningText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: "Power2",
    });

    // Fade out and destroy
    this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: warningText,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          warningText.destroy();
        },
      });
    });
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
    console.log("🔄 Rematch requested by opponent:", data);

    if (!this.gameOver) {
      console.warn("Received rematch request but game is not over");
      return;
    }

    // Update rematch state
    this.rematchState = data.rematchState || {};

    // Show rematch request notification
    this.showRematchRequestOverlay(data);

    // Update rematch status display
    this.updateRematchStatusDisplay();

    // Show notification message
    this.showMessage(
      `${data.requesterUsername || "Opponent"} wants a rematch!`,
      4000
    );
  }

  handleRematchConfirmed(data) {
    console.log("✅ Rematch confirmed by both players:", data);

    // Show confirmation message
    this.showMessage("Rematch accepted! Starting new game...", 3000);

    // Clear current overlay
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }

    // Reset game state for rematch
    this.resetGameStateForRematch();

    // The server will send a new game-started event
  }

  handleRematchDeclined(data) {
    console.log("❌ Rematch declined:", data);

    // Show decline message
    this.showMessage("Opponent declined rematch. Returning to menu...", 3000);

    // Update rematch button to show declined state
    this.updateRematchButtonState("REMATCH DECLINED", 0xff4444, false);

    // Automatically leave room after a delay
    this.time.delayedCall(3000, () => {
      this.leaveRoom();
    });
  }

  showRematchRequestOverlay(data) {
    // Clear any existing overlay
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

    // Title
    const titleText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 100,
        "REMATCH REQUEST",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "36px",
          fill: "#fde047",
          stroke: "#000000",
          strokeThickness: 4,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(titleText);

    // Message
    const messageText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 40,
        `Opponent wants a rematch!\nDo you accept?`,
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
    this.overlayGroup.add(messageText);

    // Accept button
    const acceptButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2 - 150,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 60,
        250,
        70,
        0x22c55e,
        1
      )
      .setStrokeStyle(4, 0x16a34a)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(acceptButton);

    const acceptText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2 - 150,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 60,
        "ACCEPT",
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
      .setDepth(10002);
    this.overlayGroup.add(acceptText);

    // Decline button
    const declineButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2 + 150,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 60,
        250,
        70,
        0xdc2626,
        1
      )
      .setStrokeStyle(4, 0x991b1b)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(declineButton);

    const declineText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2 + 150,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 60,
        "DECLINE",
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
      .setDepth(10002);
    this.overlayGroup.add(declineText);

    // Button interactions
    acceptButton.on("pointerdown", () => {
      console.log("Player accepted rematch");
      this.socketService.requestRematch(); // Accept by requesting rematch too
      this.showMessage("Rematch accepted! Waiting for game to start...", 3000);
    });

    declineButton.on("pointerdown", () => {
      console.log("Player declined rematch");
      this.socketService.declineRematch();
      this.showMessage("Rematch declined. Returning to menu...", 3000);

      this.time.delayedCall(2000, () => {
        this.leaveRoom();
      });
    });
  }

  resetGameStateForRematch() {
    console.log("🔄 Resetting game state for rematch");

    // Reset game flags
    this.gameStarted = false;
    this.gameOver = false;
    this.isPaused = false;
    this.pausedForGoal = false;

    // Reset scores and timer
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameTime = GAME_CONFIG.GAME_DURATION;

    // Reset ready states
    this.isPlayerReady = false;
    this.isOpponentReady = false;

    // Clean up powerups
    this.powerups.forEach((powerup) => {
      if (powerup.lifetimeTimer) powerup.lifetimeTimer.destroy();
      if (powerup.sprite && powerup.sprite.active) powerup.sprite.destroy();
      if (powerup.icon && powerup.icon.active) powerup.icon.destroy();
    });
    this.powerups = [];

    // Resume physics
    if (this.physics && this.physics.world) {
      this.physics.world.resume();
    }

    // Reset player positions
    this.resetPlayerPositions();

    // Reset ball position
    if (this.ball) {
      this.ball.x = GAME_CONFIG.BALL.STARTING_POSITION.x;
      this.ball.y = GAME_CONFIG.BALL.STARTING_POSITION.y;
      this.ball.body.setVelocity(0, 0);
    }

    // Update UI
    this.updateScoreDisplay();
    this.updateTimerDisplay();

    console.log("✅ Game state reset for rematch complete");
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
    if (this.gameOver) return; // Don't allow kicking if game is over

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

      // NEW: Debug timer system
      window.__HEADBALL_DEBUG_TIMER = () => {
        console.log("=== TIMER SYSTEM DEBUG ===");
        console.log("Game time:", this.gameTime);
        console.log("Game started:", this.gameStarted);
        console.log("Game over:", this.gameOver);
        console.log("Has local timer event:", !!this.timerEvent);
        console.log("Timer mode: Server-controlled");
        console.log(
          "Socket connected:",
          this.socketService?.isSocketConnected()
        );
        console.log("==========================");

        return {
          gameTime: this.gameTime,
          gameStarted: this.gameStarted,
          gameOver: this.gameOver,
          hasLocalTimer: !!this.timerEvent,
          timerMode: "server-controlled",
          socketConnected: this.socketService?.isSocketConnected(),
        };
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
      console.log("  __HEADBALL_DEBUG_TIMER() - Debug timer system state");

      // NEW: Debug position synchronization
      window.__HEADBALL_DEBUG_POSITIONS = () => {
        console.log("=== POSITION SYNCHRONIZATION DEBUG ===");
        console.log("Player Position:", this.playerPosition);
        console.log("Ball Authority:", this.isBallAuthority);
        console.log("Game Started:", this.gameStarted);

        if (this.player1 && this.player1.sprite) {
          console.log("Local Player (player1):", {
            x: this.player1.sprite.x,
            y: this.player1.sprite.y,
            velocityX: this.player1.sprite.body?.velocity.x,
            velocityY: this.player1.sprite.body?.velocity.y,
            isOnGround: this.player1.isOnGround,
            direction: this.player1.direction,
          });
        }

        if (this.player2 && this.player2.sprite) {
          console.log("Remote Player (player2):", {
            x: this.player2.sprite.x,
            y: this.player2.sprite.y,
            velocityX: this.player2.sprite.body?.velocity.x,
            velocityY: this.player2.sprite.body?.velocity.y,
            isRemotePlayer: this.player2 instanceof RemotePlayer,
            hasHandlePositionUpdate:
              typeof this.player2.handlePositionUpdate === "function",
          });
        }

        if (this.ball) {
          console.log("Ball:", {
            x: this.ball.x,
            y: this.ball.y,
            velocityX: this.ball.body?.velocity.x,
            velocityY: this.ball.body?.velocity.y,
            hasPhysicsBody: !!this.ball.body,
          });
        }

        console.log("Socket Service:", {
          connected: this.socketService?.isSocketConnected(),
          roomJoined: this.socketService?.isRoomJoined(),
        });

        console.log("==========================================");

        return {
          playerPosition: this.playerPosition,
          isBallAuthority: this.isBallAuthority,
          gameStarted: this.gameStarted,
          localPlayer:
            this.player1 && this.player1.sprite
              ? {
                  x: this.player1.sprite.x,
                  y: this.player1.sprite.y,
                  hasPhysicsBody: !!this.player1.sprite.body,
                }
              : null,
          remotePlayer:
            this.player2 && this.player2.sprite
              ? {
                  x: this.player2.sprite.x,
                  y: this.player2.sprite.y,
                  hasPhysicsBody: !!this.player2.sprite.body,
                  isRemotePlayer:
                    this.player2.constructor.name === "RemotePlayer",
                }
              : null,
          ball: this.ball
            ? {
                x: this.ball.x,
                y: this.ball.y,
                hasPhysicsBody: !!this.ball.body,
              }
            : null,
        };
      };

      console.log(
        "  __HEADBALL_DEBUG_POSITIONS() - Debug position synchronization"
      );

      // NEW: Auto-monitor system for troubleshooting
      window.__HEADBALL_START_MONITORING = () => {
        if (window.__HEADBALL_MONITOR_INTERVAL) {
          clearInterval(window.__HEADBALL_MONITOR_INTERVAL);
        }

        console.log("🔍 Starting real-time monitoring...");
        let lastPositions = {};

        window.__HEADBALL_MONITOR_INTERVAL = setInterval(() => {
          const current = window.__HEADBALL_DEBUG_POSITIONS();

          // Check if positions are changing
          if (lastPositions.localPlayer && current.localPlayer) {
            const localMoved =
              Math.abs(current.localPlayer.x - lastPositions.localPlayer.x) >
                1 ||
              Math.abs(current.localPlayer.y - lastPositions.localPlayer.y) > 1;

            if (localMoved) {
              console.log("✅ Local player is moving");
            } else {
              console.log("⚠️ Local player not moving");
            }
          }

          if (lastPositions.remotePlayer && current.remotePlayer) {
            const remoteMoved =
              Math.abs(current.remotePlayer.x - lastPositions.remotePlayer.x) >
                1 ||
              Math.abs(current.remotePlayer.y - lastPositions.remotePlayer.y) >
                1;

            if (remoteMoved) {
              console.log("✅ Remote player is moving");
            } else {
              console.log("❌ Remote player NOT moving");
            }
          }

          if (current.ball && lastPositions.ball) {
            const ballMoved =
              Math.abs(current.ball.x - lastPositions.ball.x) > 1 ||
              Math.abs(current.ball.y - lastPositions.ball.y) > 1;

            if (ballMoved) {
              console.log("✅ Ball is moving");
            } else {
              console.log("⚠️ Ball is static");
            }
          }

          lastPositions = current;
        }, 2000); // Check every 2 seconds

        console.log(
          "✅ Monitoring started. Call __HEADBALL_STOP_MONITORING() to stop."
        );
      };

      window.__HEADBALL_STOP_MONITORING = () => {
        if (window.__HEADBALL_MONITOR_INTERVAL) {
          clearInterval(window.__HEADBALL_MONITOR_INTERVAL);
          window.__HEADBALL_MONITOR_INTERVAL = null;
          console.log("🛑 Monitoring stopped");
        }
      };

      console.log(
        "  __HEADBALL_START_MONITORING() - Start real-time monitoring"
      );
      console.log("  __HEADBALL_STOP_MONITORING() - Stop monitoring");

      // NEW: Comprehensive diagnostics for movement issues
      window.__HEADBALL_DIAGNOSE_MOVEMENT = () => {
        console.log("=== MOVEMENT DIAGNOSTICS ===");

        // Check socket connectivity
        console.log("Socket Status:", {
          connected: this.socketService?.isSocketConnected(),
          roomJoined: this.socketService?.isRoomJoined(),
          hasSocket: !!this.socketService,
          socketId: this.socketService?.getSocket()?.id,
        });

        // Check player positions
        console.log("Player Positions:", {
          localPosition: this.playerPosition,
          localPlayer: this.player1
            ? {
                x: this.player1.sprite.x,
                y: this.player1.sprite.y,
                exists: true,
              }
            : { exists: false },
          remotePlayer: this.player2
            ? {
                x: this.player2.sprite.x,
                y: this.player2.sprite.y,
                exists: true,
                type: this.player2.constructor.name,
              }
            : { exists: false },
        });

        // Check ball authority
        console.log("Ball Authority:", {
          isBallAuthority: this.isBallAuthority,
          ballExists: !!this.ball,
          ballPosition: this.ball ? { x: this.ball.x, y: this.ball.y } : null,
        });

        // Check game state
        console.log("Game State:", {
          gameStarted: this.gameStarted,
          gameOver: this.gameOver,
          isPaused: this.isPaused,
        });

        // Check backend player position validation
        if (this.socketService?.getSocket()) {
          console.log("Backend Validation Check:", {
            frontendPosition: this.playerPosition,
            socketId: this.socketService.getSocket().id,
            roomState: this.socketService.getCurrentRoomState(),
          });
        }

        console.log("==========================");

        return {
          socketConnected: this.socketService?.isSocketConnected(),
          gameStarted: this.gameStarted,
          isBallAuthority: this.isBallAuthority,
          playerPosition: this.playerPosition,
          hasPlayers: { local: !!this.player1, remote: !!this.player2 },
          hasBall: !!this.ball,
          positionMismatchRisk:
            !this.playerPosition ||
            (this.playerPosition !== "player1" &&
              this.playerPosition !== "player2"),
        };
      };

      // NEW: Test movement functionality
      window.__HEADBALL_TEST_MOVEMENT = () => {
        console.log("=== TESTING MOVEMENT ===");

        if (!this.gameStarted) {
          console.warn("Game not started - movement won't work");
          return;
        }

        if (!this.socketService?.isSocketConnected()) {
          console.warn("Socket not connected - movement sync won't work");
          return;
        }

        console.log("Sending test movement...");
        console.log("Current position being sent:", this.playerPosition);

        // Send a test movement
        this.socketService.sendMoveRight(true);
        setTimeout(() => {
          this.socketService.sendMoveRight(false);
        }, 500);

        console.log("Test movement sent - check if remote player moves");
      };

      // NEW: Test ball interaction
      window.__HEADBALL_TEST_BALL = () => {
        console.log("=== TESTING BALL INTERACTION ===");

        if (!this.isBallAuthority) {
          console.warn("Not ball authority - cannot test ball physics");
          return;
        }

        if (!this.ball) {
          console.warn("Ball not found");
          return;
        }

        console.log("Adding test velocity to ball...");
        this.ball.body.setVelocity(200, -300);
        console.log("Ball should move and sync to other player");
      };

      // NEW: Check position assignment
      window.__HEADBALL_CHECK_POSITIONS = () => {
        console.log("=== POSITION ASSIGNMENT CHECK ===");

        const roomState = this.socketService?.getCurrentRoomState();
        const socketId = this.socketService?.getSocket()?.id;

        console.log("Frontend State:", {
          playerPosition: this.playerPosition,
          isBallAuthority: this.isBallAuthority,
          socketId: socketId,
        });

        console.log("Room State:", roomState);

        console.log("Global Variables:", {
          windowPlayerPosition:
            typeof window !== "undefined"
              ? window.__HEADBALL_PLAYER_POSITION
              : "undefined",
          windowBallAuthority:
            typeof window !== "undefined"
              ? window.__HEADBALL_IS_BALL_AUTHORITY
              : "undefined",
        });

        const isValid =
          this.playerPosition &&
          (this.playerPosition === "player1" ||
            this.playerPosition === "player2");
        console.log("Position Valid:", isValid);

        if (!isValid) {
          console.warn("❌ INVALID POSITION - This will cause sync issues!");
        } else {
          console.log("✅ Position assignment looks correct");
        }

        console.log("================================");

        return {
          valid: isValid,
          playerPosition: this.playerPosition,
          isBallAuthority: this.isBallAuthority,
          socketId: socketId,
        };
      };

      console.log(
        "  __HEADBALL_DIAGNOSE_MOVEMENT() - Diagnose movement issues"
      );
      console.log("  __HEADBALL_TEST_MOVEMENT() - Test movement sync");
      console.log(
        "  __HEADBALL_TEST_BALL() - Test ball sync (ball authority only)"
      );
      console.log("  __HEADBALL_CHECK_POSITIONS() - Check position assignment");
    }
  }

  handleGameEnded(data) {
    console.log("🏁 Game ended from backend:", data);

    // Prevent duplicate game end handling
    if (this.gameOver) {
      console.log("Game already marked as over, skipping duplicate end");
      return;
    }

    this.gameOver = true;
    this.gameStarted = false; // Stop game actions

    // Update final scores
    if (data.finalScore) {
      this.player1Score = data.finalScore.player1 || 0;
      this.player2Score = data.finalScore.player2 || 0;
      this.updateScoreDisplay();
    }

    // Stop timer and cleanup
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = null;
    }

    // Pause physics
    this.physics.world.pause();

    // Show game end overlay with rematch options
    this.showGameEndScreen(data);

    console.log(
      `✅ Game ended: ${data.reason}, Winner: ${data.winner}, Duration: ${data.duration}s`
    );
  }

  showGameEndScreen(gameEndData) {
    console.log("🎮 Showing game end screen with rematch options");

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

    // **REMATCH BUTTONS** - Add them here
    const buttonWidth = 300;
    const buttonHeight = 70;
    const buttonSpacing = 90;
    const startY = GAME_CONFIG.CANVAS_HEIGHT / 2 + 140;

    // Rematch button
    const rematchButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY,
        buttonWidth,
        buttonHeight,
        0x22c55e,
        1
      )
      .setStrokeStyle(4, 0x16a34a)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(rematchButton);

    const rematchText = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, startY, "REQUEST REMATCH", {
        fontFamily: '"Press Start 2P"',
        fontSize: "20px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(10002);
    this.overlayGroup.add(rematchText);

    // Leave room button
    const leaveButton = this.add
      .rectangle(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY + buttonSpacing,
        buttonWidth,
        buttonHeight,
        0xdc2626,
        1
      )
      .setStrokeStyle(4, 0x991b1b)
      .setDepth(10001)
      .setInteractive({ useHandCursor: true });
    this.overlayGroup.add(leaveButton);

    const leaveText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        startY + buttonSpacing,
        "LEAVE ROOM",
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
      .setDepth(10002);
    this.overlayGroup.add(leaveText);

    // Button interactions
    this.setupGameEndButtonInteractions(
      rematchButton,
      rematchText,
      leaveButton,
      leaveText
    );

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

    console.log("✅ Game end screen with rematch buttons created successfully");
  }

  handleRoomJoinedEvent(data) {
    console.log("🏠 Room joined event received:", data);

    // Store room information
    this.roomId = data.roomId;
    this.roomCode = data.roomCode;
    this.playersInRoom = data.playersInRoom;

    // CRITICAL: Get the authoritative player position from backend
    const backendPlayerPosition = data.playerPosition;

    console.log("🎯 Position assignment from backend:", {
      currentAssumption: this.playerPosition,
      backendAssignment: backendPlayerPosition,
      needsRebuild: this.playerPosition !== backendPlayerPosition,
    });

    // Store the authoritative position globally for other components
    if (typeof window !== "undefined") {
      window.__HEADBALL_PLAYER_POSITION = backendPlayerPosition;
    }

    // Check if we need to rebuild players due to position mismatch
    if (this.playerPosition !== backendPlayerPosition) {
      console.log("🔄 Position mismatch detected - rebuilding players:", {
        from: this.playerPosition,
        to: backendPlayerPosition,
      });

      // Update our position
      this.playerPosition = backendPlayerPosition;

      // Rebuild players with correct positions
      this._rebuildPlayersForAuthoritativePosition();
    } else {
      console.log("✅ Position matches - no rebuild needed");
    }

    // Update UI
    this.updateRoomUI();
    this.showMessage(`Joined room: ${this.roomCode}`, 3000);
  }

  /**
   * Recreate local and remote Player instances once the authoritative
   * playerPosition arrives from the backend.  This prevents mismatches that
   * cause the server to reject player-position packets (and therefore remote
   * players appearing frozen).
   */
  _rebuildPlayersForAuthoritativePosition() {
    console.log(
      "🔨 Rebuilding players for authoritative position:",
      this.playerPosition
    );

    // Clean up existing players
    if (this.player1) {
      this.player1.destroy();
      this.player1 = null;
    }
    if (this.player2) {
      this.player2.destroy();
      this.player2 = null;
    }

    // Update ball authority based on position
    this.isBallAuthority = this.playerPosition === "player1";

    // Store in global variables for consistency
    if (typeof window !== "undefined") {
      window.__HEADBALL_IS_BALL_AUTHORITY = this.isBallAuthority;
    }

    // Recreate players with correct assignments
    this.createPlayers();

    console.log("✅ Players rebuilt successfully:", {
      playerPosition: this.playerPosition,
      isBallAuthority: this.isBallAuthority,
      hasPlayer1: !!this.player1,
      hasPlayer2: !!this.player2,
    });
  }

  // Check ball bounds and reset if needed
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

  // Handle remote powerup spawn from other players
  handleRemotePowerupSpawn(data) {
    console.log("Creating remote powerup:", data);
    this.createSyncedPowerup(data.x, data.y, data.type, data.id);
  }

  // Handle remote powerup collection from other players
  handleRemotePowerupCollection(data) {
    console.log("Removing collected powerup:", data);
    const powerup = this.powerups.find((p) => p.id === data.id);
    if (powerup) {
      // Apply powerup effect if it was collected by a player
      if (data.collectorPosition) {
        const collector =
          data.collectorPosition === this.playerPosition
            ? this.player1
            : this.player2;
        if (collector && collector.applyPowerup) {
          collector.applyPowerup(powerup.type);
          this.showPowerupNotification(powerup.config.name, collector);
        }
      }

      this.removePowerup(powerup);
    }
  }

  // Create powerup from sync data
  createSyncedPowerup(x, y, type, id) {
    if (this.gameOver) return;

    const powerupConfig = GAME_CONFIG.POWERUPS.TYPES[type];
    if (!powerupConfig) return;

    // Create power-up visual
    const powerup = this.add.circle(
      x,
      y,
      GAME_CONFIG.POWERUPS.SIZE,
      powerupConfig.color
    );
    powerup.setStrokeStyle(4, 0xffffff);
    powerup.setDepth(800);

    // Add icon text
    const icon = this.add.text(x, y, powerupConfig.icon, {
      fontFamily: '"Press Start 2P"',
      fontSize: "20px",
      fill: "#ffffff",
    });
    icon.setOrigin(0.5, 0.5);
    icon.setDepth(801);

    // Add physics
    this.physics.add.existing(powerup);
    powerup.body.setCircle(GAME_CONFIG.POWERUPS.SIZE);
    powerup.body.setImmovable(true);
    powerup.body.setGravityY(-GAME_CONFIG.GRAVITY);
    powerup.body.setVelocity(0, 0);

    // Floating animation
    this.tweens.add({
      targets: [powerup, icon],
      y: y - 5,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Glowing effect
    this.tweens.add({
      targets: powerup,
      alpha: 0.7,
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Store power-up data
    const powerupData = {
      sprite: powerup,
      icon: icon,
      type: type,
      config: powerupConfig,
      collected: false,
      lifetimeTimer: null,
      id: id,
    };

    this.powerups.push(powerupData);

    // Collision with ball for all players
    this.physics.add.overlap(this.ball, powerup, () => {
      this.collectPowerup(powerupData);
    });

    // Auto-remove after lifetime
    powerupData.lifetimeTimer = this.time.delayedCall(
      GAME_CONFIG.POWERUPS.LIFETIME,
      () => {
        this.removePowerup(powerupData);
      }
    );
  }

  // Helper method to show temporary messages to the user
  showMessage(message, duration = 3000) {
    // Create message text at top of screen
    const messageText = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 150, message, {
        fontFamily: '"Press Start 2P"',
        fontSize: "20px",
        fill: "#ffffff",
        backgroundColor: "#000000",
        padding: { x: 20, y: 10 },
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(15000); // Very high depth to appear above everything

    // Animate message appearance
    messageText.setAlpha(0);
    this.tweens.add({
      targets: messageText,
      alpha: 1,
      duration: 300,
      ease: "Power2",
    });

    // Auto-remove after duration
    this.time.delayedCall(duration, () => {
      this.tweens.add({
        targets: messageText,
        alpha: 0,
        duration: 500,
        ease: "Power2",
        onComplete: () => {
          messageText.destroy();
        },
      });
    });

    console.log(`📢 Message shown: "${message}"`);
  }

  // Helper method to update room UI (placeholder)
  updateRoomUI() {
    // Update any room-related UI elements
    console.log("Room UI updated");
  }

  // Update rematch status display to show who has requested rematch
  updateRematchStatusDisplay() {
    if (!this.gameOver || !this.overlayGroup) return;

    // Find existing rematch status text
    let statusText = this.overlayGroup.children.entries.find(
      (child) => child.type === "Text" && child.text.includes("Rematch Status:")
    );

    // Create status text if it doesn't exist
    if (!statusText) {
      statusText = this.add
        .text(
          GAME_CONFIG.CANVAS_WIDTH / 2,
          GAME_CONFIG.CANVAS_HEIGHT / 2 + 180,
          "",
          {
            fontFamily: '"Press Start 2P"',
            fontSize: "16px",
            fill: "#ffffff",
            align: "center",
            stroke: "#000000",
            strokeThickness: 2,
          }
        )
        .setOrigin(0.5)
        .setDepth(10001);
      this.overlayGroup.add(statusText);
    }

    // Generate status text based on rematch state
    let statusMessage = "📊 Rematch Status:\n";

    if (this.rematchState) {
      // Check local player status
      const localPlayerRequested =
        this.playerPosition === "player1"
          ? this.rematchState.player1Requested
          : this.rematchState.player2Requested;

      // Check opponent status
      const opponentRequested =
        this.playerPosition === "player1"
          ? this.rematchState.player2Requested
          : this.rematchState.player1Requested;

      statusMessage += `You: ${
        localPlayerRequested ? "✅ READY FOR REMATCH" : "⏳ Not requested"
      }\n`;
      statusMessage += `Opponent: ${
        opponentRequested ? "✅ READY FOR REMATCH" : "⏳ Not requested"
      }`;

      if (localPlayerRequested && opponentRequested) {
        statusMessage += "\n\n🎮 Both players ready! Starting rematch...";
        statusText.setFill("#00ff00"); // Green for ready
      } else if (localPlayerRequested) {
        statusMessage += "\n\n⌛ Waiting for opponent to accept...";
        statusText.setFill("#ffff00"); // Yellow for waiting
      } else if (opponentRequested) {
        statusMessage +=
          "\n\n❓ Opponent wants a rematch! Make your decision...";
        statusText.setFill("#ff8800"); // Orange for action needed
      } else {
        statusMessage += "\n\n❓ No rematch requests yet";
        statusText.setFill("#ffffff"); // White for neutral
      }
    } else {
      statusMessage += "No rematch data available";
      statusText.setFill("#ffffff");
    }

    statusText.setText(statusMessage);

    console.log("🔄 Rematch status updated:", {
      playerPosition: this.playerPosition,
      rematchState: this.rematchState,
      statusMessage: statusMessage.replace(/\n/g, " | "),
    });
  }
}
