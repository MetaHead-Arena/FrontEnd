import { GAME_CONFIG, PIXEL_SPRITE } from "./config.js";
import { Player } from "./Player.js";
import { RemotePlayer } from "./RemotePlayer.js";
import { AIPlayer } from "./AIPlayer.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: "GameScene" });

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
    this.gameStarted = false;

    // Power-up system
    this.powerups = [];
    this.powerupSpawnTimer = null;
    this.lastPlayerToTouchBall = null;

    // Visual effects
    this.ballTrail = [];
    this.isShaking = false;

    // Game mode (2player, vsAI, or online)
    this.gameMode = "2player";

    // Online multiplayer state
    this.playerPosition = null; // "player1" or "player2"
    this.isBallAuthority = false; // Whether this player is responsible for ball physics
    this.gameLogicService = null;
    this.socketService = null;

    // Ball state sending
    this.lastBallStateSend = null;

    // Waiting screen references
    this.waitingStatusText = null;
    this.readyStatusText = null;
  }

  init(data) {
    if (typeof window !== "undefined" && window.__HEADBALL_GAME_MODE) {
      this.gameMode = window.__HEADBALL_GAME_MODE;
    } else if (data && data.gameMode) {
      this.gameMode = data.gameMode;
    }

    // Set global player position for online games
    if (this.gameMode === "online" && typeof window !== "undefined") {
      this.playerPosition = window.__HEADBALL_PLAYER_POSITION || null;

      // Debug: Check if position was properly assigned
      console.log("=== POSITION ASSIGNMENT DEBUG ===");
      console.log("Window player position:", window.__HEADBALL_PLAYER_POSITION);
      console.log("Room data:", window.__HEADBALL_ROOM_DATA);

      // If position is still null or invalid, force assignment
      if (
        !this.playerPosition ||
        (this.playerPosition !== "player1" && this.playerPosition !== "player2")
      ) {
        console.warn("Invalid player position detected, forcing assignment...");

        // Use socket ID to determine position consistently
        const socketId =
          window.__HEADBALL_SOCKET_ID ||
          (typeof window.socketService !== "undefined"
            ? window.socketService.getSocket()?.id
            : null);
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
      console.log("=== END POSITION DEBUG ===");
    }
  }

  preload() {
    this.load.image("court", "/court.png");
    this.load.image("pixel", PIXEL_SPRITE);
    this.load.image("player1", "/head-1.png");
    this.load.image("player2", "/head-2.png");
    this.load.image("ai-head", "/ai-head.png");
    this.load.image("ball", "/ball.png");
    this.load.image("left-net", "/left-net.png");
    this.load.image("right-net", "/right-net.png");
  }

  resetGameState() {
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.goalCooldown = 0;
    this.pausedForGoal = false;
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.timerEvent = null;
    // For online games, keep gameStarted false until both players are ready
    this.gameStarted = false;
    this.powerups = [];
    this.powerupSpawnTimer = null;
    this.lastPlayerToTouchBall = null;
  }

  create() {
    this.physics.world.setBounds(
      0,
      0,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT
    );
    this.physics.world.gravity.y = GAME_CONFIG.GRAVITY;

    this.resetGameState();

    this.add.image(0, 0, "court").setOrigin(0, 0).setDisplaySize(1536, 1024);

    this.createFieldBoundaries();
    this.createGoalPosts();

    this.cursors = this.input.keyboard.createCursorKeys();
    this.rightShift = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SHIFT_RIGHT
    );
    this.wasd = {
      W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.space = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.input.keyboard.on("keydown-R", this.handleReady, this);
    this.input.keyboard.on("keydown-ENTER", this.handleReady, this);

    // ESC key handler - handles both pause and cancel ready based on context
    this.input.keyboard.on(
      "keydown-ESC",
      () => {
        if (
          this.gameMode === "online" &&
          !this.gameStarted &&
          this.overlayGroup
        ) {
          this.cancelReady();
        } else {
          this.handlePause();
        }
      },
      this
    );

    this.createPlayers();
    this.createBall();
    this.createUI();
    this.createPlayerStatsDisplay();

    // Only start game systems for non-online modes
    if (this.gameMode !== "online") {
      this.startGameTimer();
      this.startPowerupSystem();
    }

    this.physics.add.collider(this.player1.sprite, this.player2.sprite);

    // Initialize online multiplayer if needed
    if (this.gameMode === "online") {
      this.initializeOnlineMultiplayer();
    }

    // Notify that game engine has finished loading
    this.notifyGameLoaded();
  }

  initializeOnlineMultiplayer() {
    // Import the services dynamically to avoid SSR issues
    if (typeof window !== "undefined") {
      import("../../services/socketService")
        .then(({ socketService }) => {
          this.socketService = socketService;
          this.setupOnlineEventListeners();
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

    // Listen for game state updates
    this.socketService.on("game-started", (data) => {
      console.log("Game started via socket:", data);
      console.log("Current game state:", {
        gameMode: this.gameMode,
        playerPosition: this.playerPosition,
        gameStarted: this.gameStarted,
        gameOver: this.gameOver,
        socketId: this.socketService?.getSocket()?.id,
      });

      // Clear any overlay (like ready overlay)
      if (this.overlayGroup) {
        this.overlayGroup.clear(true, true);
        this.overlayGroup = null;
      }

      this.handleGameStarted(data);
    });

    this.socketService.on("match-ended", (data) => {
      console.log("Match ended via socket:", data);
      this.handleMatchEnded(data);
    });

    this.socketService.on("goal-scored", (data) => {
      console.log("Goal scored via socket:", data);
      this.handleGoalScored(data);
    });

    // Listen for player position updates
    this.socketService.on("player-position", (data) => {
      console.log("Received player-position event:", data);
      this.handleRemotePlayerPosition(data);
    });

    // Listen for ball state updates
    this.socketService.on("ball-state", (data) => {
      console.log("Received ball-state event:", data);
      this.handleRemoteBallState(data);
    });

    // Listen for individual input events
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

    // Also listen for the generic player-input event as fallback
    this.socketService.on("player-input", (data) => {
      console.log("Received player-input event:", data);
      this.handleRemotePlayerInput(data);
    });

    // Listen for player ready events
    this.socketService.on("player-ready", (data) => {
      console.log("Received player-ready event:", data);
      this.handlePlayerReady(data);
    });

    // Listen for both players ready event
    this.socketService.on("all-players-ready", (data) => {
      console.log("All players ready, starting game:", data);
      this.handleAllPlayersReady(data);
    });

    console.log("Online event listeners set up successfully");
  }

  handleGameStarted(data) {
    console.log("Game started via socket:", data);
    console.log("Current game state:", {
      gameMode: this.gameMode,
      playerPosition: this.playerPosition,
      gameStarted: this.gameStarted,
      gameOver: this.gameOver,
      socketId: this.socketService?.getSocket()?.id,
    });

    // Clear any overlay (like ready overlay)
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }

    // Clear waiting screen references
    this.waitingStatusText = null;
    this.readyStatusText = null;

    // Reset only necessary game state (don't call resetGameState as it sets gameStarted = false)
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.goalCooldown = 0;
    this.pausedForGoal = false;
    this.gameTime = data.matchDuration || GAME_CONFIG.GAME_DURATION;
    this.gameStarted = true; // Keep this true!
    this.powerups = [];
    this.powerupSpawnTimer = null;
    this.lastPlayerToTouchBall = null;

    console.log("Game state reset, starting timer and powerups...");

    // Start the game timer for both players
    this.startGameTimer();

    // Start powerup system
    this.startPowerupSystem();

    // Reset player positions to starting positions
    if (this.player1) {
      // Reset to starting position based on player type
      if (this.gameMode === "online" && this.playerPosition === "player1") {
        // This player is player1 (right side)
        this.player1.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x;
        this.player1.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;
        console.log("Player1 (local) positioned on right side");
      } else {
        // This player is player2 (left side) or offline mode
        this.player1.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x;
        this.player1.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y;
        console.log("Player1 (local) positioned on left side");
      }
      this.player1.sprite.body.setVelocity(0, 0);
    }

    if (this.player2) {
      // Reset to starting position based on player type
      if (this.gameMode === "online" && this.playerPosition === "player1") {
        // This player is player1, so player2 is on left
        this.player2.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x;
        this.player2.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y;
        console.log("Player2 (remote) positioned on left side");
      } else {
        // This player is player2, so player2 is on right
        this.player2.sprite.x = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x;
        this.player2.sprite.y = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;
        console.log("Player2 (remote) positioned on right side");
      }
      this.player2.sprite.body.setVelocity(0, 0);
    }

    // Reset ball position
    if (this.ball) {
      this.ball.x = GAME_CONFIG.BALL.STARTING_POSITION.x;
      this.ball.y = GAME_CONFIG.BALL.STARTING_POSITION.y;
      this.ball.body.setVelocity(0, 0);
      console.log("Ball reset to center position");
    }

    // Update UI to show game is active
    this.updateScoreDisplay();
    this.updateTimerDisplay();
    this.updatePositionIndicator();

    console.log("Game started with duration:", this.gameTime);
    console.log("Player position:", this.playerPosition);
    console.log("Ball authority:", this.isBallAuthority);
    console.log("Game is now active for this player!");
  }

  updatePositionIndicator() {
    if (this.positionText && this.gameMode === "online") {
      const controls =
        this.player1.controls === "arrows" ? "Arrow Keys" : "WASD";
      this.positionText.setText(
        `You are: ${this.playerPosition} (${controls})`
      );
    }
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

  handleRemoteBallState(data) {
    if (this.gameMode !== "online" || this.isBallAuthority) {
      return;
    }

    console.log("Receiving ball state from authority:", data);

    // Update ball position from remote authority
    if (this.ball) {
      this.ball.x = data.ball.x;
      this.ball.y = data.ball.y;
      this.ball.body.setVelocity(data.ball.velocityX, data.ball.velocityY);
    }
  }

  handleRemotePlayerPosition(data) {
    if (this.gameMode !== "online" || data.position === this.playerPosition) {
      return;
    }

    console.log("Handling remote player position:", data);

    // Update remote player position
    const remotePlayer = this.player2;
    if (remotePlayer && remotePlayer.handlePositionUpdate) {
      remotePlayer.handlePositionUpdate(data.player);
    } else {
      console.warn(
        "Remote player not found or missing handlePositionUpdate method"
      );
    }
  }

  handleRemotePlayerInput(data) {
    if (
      this.gameMode !== "online" ||
      data.playerId === this.socketService?.getSocket()?.id
    ) {
      return;
    }

    console.log("Handling remote player input:", data);

    // Route input to the correct remote player
    const remotePlayer = this.player2;
    if (remotePlayer && remotePlayer.handleRemoteInput) {
      remotePlayer.handleRemoteInput(data);
    } else {
      console.warn(
        "Remote player not found or missing handleRemoteInput method"
      );
    }
  }

  notifyGameLoaded() {
    // Small delay to ensure everything is properly initialized
    this.time.delayedCall(100, () => {
      console.log("Game engine fully loaded and ready");

      // For online games, show loading screen first
      if (this.gameMode === "online") {
        this.showLoadingScreen();
      }

      // Call the global callback if available (for online games)
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

      // After everything is loaded, show ready button for online games
      if (this.gameMode === "online") {
        this.time.delayedCall(1500, () => {
          this.showReadyButton();
        });
      }
    });
  }

  // --- Overlay Creation Helper ---
  showOverlay({ message, buttons }) {
    if (this.overlayGroup && this.overlayGroup.children) {
      this.overlayGroup.clear(true, true);
    }
    this.overlayGroup = null;
    this.overlayGroup = this.add.group();

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

    const msgText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 80,
        message,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: GAME_CONFIG.UI.FONT_SIZES.WIN_MESSAGE,
          fill: "#fff",
          stroke: "#000",
          strokeThickness: 4,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(msgText);

    // Buttons in a column with margin
    const buttonYStart = GAME_CONFIG.CANVAS_HEIGHT / 2 + 10;
    const buttonSpacing = 80; // vertical space between buttons

    buttons.forEach((btn, i) => {
      const btnWidth = 260,
        btnHeight = 60;
      const btnX = GAME_CONFIG.CANVAS_WIDTH / 2;
      const btnY = buttonYStart + i * buttonSpacing;

      // Button background
      const btnRect = this.add
        .rectangle(btnX, btnY, btnWidth, btnHeight, 0x22223a, 1)
        .setStrokeStyle(4, 0xfacc15)
        .setDepth(10001)
        .setInteractive({ useHandCursor: true });
      this.overlayGroup.add(btnRect);

      // Button text
      const btnText = this.add
        .text(btnX, btnY, btn.text, {
          fontFamily: '"Press Start 2P"',
          fontSize: "20px",
          fill: "#fde047",
          align: "center",
          wordWrap: { width: btnWidth - 32, useAdvancedWrap: true },
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(10002);
      this.overlayGroup.add(btnText);

      btnRect.on("pointerdown", btn.onClick);
      btnText
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", btn.onClick);
    });
  }

  // --- End Game ---
  handleGameEnd() {
    this.gameOver = true;
    if (this.timerEvent) this.timerEvent.destroy();
    if (this.powerupSpawnTimer) this.powerupSpawnTimer.destroy();

    this.powerups.forEach((powerup) => {
      if (powerup.lifetimeTimer) powerup.lifetimeTimer.destroy();
      if (powerup.sprite && powerup.sprite.active) powerup.sprite.destroy();
      if (powerup.icon && powerup.icon.active) powerup.icon.destroy();
    });
    this.powerups = [];

    let resultMessage = "";

    if (this.player1Score > this.player2Score) {
      resultMessage = "🏆 Player 1 Wins! 🎉";
    } else if (this.player2Score > this.player1Score) {
      const player2Name = this.gameMode === "vsAI" ? "AI" : "Player 2";
      resultMessage = `🏆 ${player2Name} Wins! 🎉`;
    } else {
      resultMessage = "🤝 It's a Draw! 🤝";
    }

    this.showOverlay({
      message: resultMessage,
      buttons: [
        {
          text: "REMATCH",
          onClick: () => {
            if (this.overlayGroup && this.overlayGroup.children) {
              this.overlayGroup.clear(true, true);
            }
            this.overlayGroup = null;
            this.scene.restart({ gameMode: this.gameMode });
          },
        },
        {
          text: "BACK TO MAIN MENU",
          onClick: () => {
            if (this.overlayGroup && this.overlayGroup.children) {
              this.overlayGroup.clear(true, true);
            }
            this.overlayGroup = null;
            this.restartGame();
          },
        },
      ],
    });

    if (this.ball && this.ball.body) this.ball.body.setVelocity(0, 0);
    if (this.player1 && this.player1.sprite.body)
      this.player1.sprite.body.setVelocity(0, 0);
    if (this.player2 && this.player2.sprite.body)
      this.player2.sprite.body.setVelocity(0, 0);
  }

  // --- Pause ---
  handlePause() {
    if (this.isPaused || this.gameOver) return;
    this.isPaused = true;
    if (this.timerEvent) this.timerEvent.paused = true;
    this.physics.world.pause();

    this.showOverlay({
      message: "GAME PAUSED",
      buttons: [
        {
          text: "RESUME",
          onClick: () => {
            if (this.overlayGroup) {
              this.overlayGroup.clear(true, true);
              this.overlayGroup = null;
            }
            this.isPaused = false;
            this.physics.world.resume();
            if (this.timerEvent) this.timerEvent.paused = false;
          },
        },
        {
          text: "REMATCH",
          onClick: () => {
            if (this.overlayGroup) {
              this.overlayGroup.clear(true, true);
              this.overlayGroup = null;
            }
            this.isPaused = false;
            this.scene.restart({ gameMode: this.gameMode });
          },
        },
        {
          text: "BACK TO MAIN MENU",
          onClick: () => {
            if (this.overlayGroup) {
              this.overlayGroup.clear(true, true);
              this.overlayGroup = null;
            }
            this.isPaused = false;
            this.restartGame();
          },
        },
      ],
    });
  }

  /**
   * Handle player ready up functionality for online multiplayer
   *
   * This function:
   * - Only works in online mode
   * - Checks if game hasn't started yet
   * - Emits ready event to server via socket service
   * - Shows a waiting screen until both players are ready
   * - Can be triggered by:
   *   - Pressing 'R' key
   *   - Pressing 'Enter' key
   *   - Calling from React UI via window.__HEADBALL_HANDLE_READY()
   *   - Clicking the ready button
   *
   * The overlay is automatically cleared when the game starts
   * via the handleGameStarted function.
   */
  handleReady() {
    // Only allow ready in online mode and when not already in a game
    if (this.gameMode !== "online") {
      console.log("Ready function only available in online mode");
      return;
    }

    if (this.gameStarted) {
      console.log("Game already started, cannot ready up");
      return;
    }

    if (!this.socketService) {
      console.log("Socket service not available");
      return;
    }

    console.log("Player clicked ready from Phaser");

    // Emit ready event to server using the correct method
    try {
      if (typeof this.socketService.emitPlayerReady === "function") {
        this.socketService.emitPlayerReady();
      } else {
        // Fallback to direct emit
        this.socketService.emit("player-ready", {
          playerId: this.socketService.getSocket()?.id,
          playerPosition: this.playerPosition,
        });
      }
      console.log("Ready event emitted successfully");
    } catch (error) {
      console.error("Failed to emit ready event:", error);
    }

    // Show waiting screen
    this.showWaitingForPlayersScreen();
  }

  /**
   * Cancel ready up and return to normal state
   */
  cancelReady() {
    console.log("Player cancelled ready up");

    // Clear the overlay
    if (this.overlayGroup) {
      this.overlayGroup.clear(true, true);
      this.overlayGroup = null;
    }

    // Note: In a real implementation, you might want to emit a "cancel-ready" event
    // to the server, but for now we just clear the UI
    // this.socketService.emitCancelReady();
  }

  /**
   * Show loading screen with animated ball
   */
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

  /**
   * Show ready button after game has loaded
   */
  showReadyButton() {
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

    // Controls info
    const controls = this.playerPosition === "player1" ? "Arrow Keys" : "WASD";
    const side = this.playerPosition === "player1" ? "Right Side" : "Left Side";
    const controlsText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 10,
        `Controls: ${controls} | Position: ${side}`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "16px",
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

  /**
   * Show waiting screen after player clicks ready
   */
  showWaitingForPlayersScreen() {
    // Clear current overlay
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

    // Main title
    const titleText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 100,
        "WAITING FOR PLAYERS",
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

    // Status text
    const statusText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 - 40,
        "You are ready! Waiting for opponent...",
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
    this.overlayGroup.add(statusText);

    // Animated loading indicator
    const loadingDots = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 20,
        "●●●",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "32px",
          fill: "#22c55e",
          stroke: "#000000",
          strokeThickness: 3,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(loadingDots);

    // Animate loading dots
    this.tweens.add({
      targets: loadingDots,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Power2",
    });

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

    // Ready status indicator
    const readyStatus = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2 + 80,
        `✓ ${this.playerPosition?.toUpperCase()} READY`,
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "18px",
          fill: "#22c55e",
          stroke: "#000000",
          strokeThickness: 2,
          align: "center",
        }
      )
      .setOrigin(0.5)
      .setDepth(10000);
    this.overlayGroup.add(readyStatus);

    // Store reference for updating
    this.waitingStatusText = statusText;
    this.readyStatusText = readyStatus;
  }

  /**
   * Handle player ready event from socket
   */
  handlePlayerReady(data) {
    console.log("Player ready event received:", data);

    // Update waiting screen if visible
    if (this.waitingStatusText && this.readyStatusText) {
      const otherPosition =
        this.playerPosition === "player1" ? "player2" : "player1";

      if (data.playerPosition === otherPosition) {
        this.waitingStatusText.setText("Both players ready! Starting game...");
        this.readyStatusText.setText(
          `✓ ${this.playerPosition?.toUpperCase()} READY\n✓ ${otherPosition.toUpperCase()} READY`
        );
      }
    }
  }

  /**
   * Handle all players ready event
   */
  handleAllPlayersReady(data) {
    console.log("All players ready, game will start soon:", data);

    // Update status text
    if (this.waitingStatusText) {
      this.waitingStatusText.setText("All players ready! Starting in 3...");

      // Countdown before starting
      let countdown = 3;
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          this.waitingStatusText.setText(
            `All players ready! Starting in ${countdown}...`
          );
        } else {
          this.waitingStatusText.setText("Game starting now!");
          clearInterval(countdownInterval);
        }
      }, 1000);
    }
  }

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

  createPlayers() {
    console.log("GameScene createPlayers called with:", {
      gameMode: this.gameMode,
      playerPosition: this.playerPosition,
      roomData:
        typeof window !== "undefined"
          ? window.__HEADBALL_ROOM_DATA
          : "undefined",
    });

    if (this.gameMode === "online") {
      // For online games, assign players based on position
      if (this.playerPosition === "player1") {
        console.log("Creating Player1 (local) and Player2 (remote)");
        console.log(
          "Player1 will use both WASD and arrows and be on right side"
        );
        console.log("Player2 will be remote player on left side");

        // This player is Player 1: Both controls, right side, use "player2" image
        this.player1 = new Player(
          this,
          GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
          GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
          "PLAYER1",
          "both", // Allow both control schemes
          "player2" // <-- right side image
        );
        // Remote player is Player 2: left side, use "player1" image
        this.player2 = new RemotePlayer(
          this,
          GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
          GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
          "PLAYER2",
          "player1" // <-- left side image
        );
      } else {
        console.log("Creating Player1 (remote) and Player2 (local)");
        console.log("Player1 will be remote player on left side");
        console.log(
          "Player2 will use both WASD and arrows and be on left side"
        );

        // This player is Player 2: Both controls, left side, use "player1" image
        this.player1 = new Player(
          this,
          GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
          GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
          "PLAYER1",
          "both", // Allow both control schemes
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

      // Debug: Validate player objects after creation
      console.log("Player1 created:", this.player1);
      console.log("Player2 created:", this.player2);
      console.log("Player1 controls:", this.player1.controls);
      console.log("Player2 is remote:", this.player2 instanceof RemotePlayer);
      this.validatePlayerObjects();
    } else if (this.gameMode === "vsAI") {
      // Player 1: Both controls, left side, use "player1" image
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER1",
        "both", // Allow both control schemes
        "player1"
      );
      // Player 2: AI, right side, use "ai-head" image
      this.player2 = new AIPlayer(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "AI",
        "ai-head"
      );
      this.player2.setDifficulty("medium");
    } else {
      // 2 player local: Both players can use both WASD and arrows
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER1",
        "both", // Allow both control schemes
        "player1"
      );
      this.player2 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "PLAYER2",
        "both", // Allow both control schemes
        "player2"
      );
    }

    this.physics.add.collider(this.player1.sprite, this.player2.sprite);
  }

  // Helper method to validate player objects
  validatePlayerObjects() {
    const requiredMethods = [
      "isCurrentlyShooting",
      "getKickPower",
      "getShootPower",
      "getCurrentSpeed",
      "getCurrentJumpVelocity",
    ];

    [this.player1, this.player2].forEach((player, index) => {
      if (!player) {
        console.error(`Player${index + 1} is null or undefined`);
        return;
      }

      console.log(`Validating Player${index + 1}:`, player.constructor.name);

      requiredMethods.forEach((method) => {
        if (typeof player[method] !== "function") {
          console.error(`Player${index + 1} missing method: ${method}`);
        } else {
          console.log(`Player${index + 1} has method: ${method}`);
        }
      });
    });
  }

  createBall() {
    // Create the ball using an image sprite instead of a circle
    this.ball = this.physics.add.sprite(
      GAME_CONFIG.BALL.STARTING_POSITION.x,
      GAME_CONFIG.BALL.STARTING_POSITION.y,
      "ball" // <-- the key from preload()
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
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y + 20 // Max y position
    );

    this.setupBallCollisions();
    this.setupPlayerBallInteractions();
  }

  setupBallCollisions() {
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
  }

  setupPlayerBallInteractions() {
    // Player-ball collisions for kicking
    this.physics.add.collider(
      this.player1.sprite,
      this.ball,
      (player, ball) => {
        this.lastPlayerToTouchBall = this.player1;
        this.kickBall(this.player1, ball);
      }
    );

    this.physics.add.collider(
      this.player2.sprite,
      this.ball,
      (player, ball) => {
        this.lastPlayerToTouchBall = this.player2;
        this.kickBall(this.player2, ball);
      }
    );
  }

  kickBall(player, ball) {
    // Safety checks to ensure player object is valid
    if (!player || !player.sprite || !ball) {
      console.warn("Invalid player or ball object in kickBall");
      return;
    }

    // Check if player has required methods
    if (typeof player.isCurrentlyShooting !== "function") {
      console.warn("Player missing isCurrentlyShooting method:", player);
      return;
    }

    if (typeof player.getKickPower !== "function") {
      console.warn("Player missing getKickPower method:", player);
      return;
    }

    if (typeof player.getShootPower !== "function") {
      console.warn("Player missing getShootPower method:", player);
      return;
    }

    // Prevent multiple rapid collisions
    const now = Date.now();
    if (player.lastBallCollision && now - player.lastBallCollision < 100) {
      return;
    }
    player.lastBallCollision = now;

    // Determine if the player is shooting
    const isShooting = player.isCurrentlyShooting();

    // Calculate direction from player to ball
    const dx = ball.x - player.sprite.x;
    const dy = ball.y - player.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    const dirX = dx / distance;
    const dirY = dy / distance;

    // Calculate player's current speed
    const playerSpeed = Math.sqrt(
      player.sprite.body.velocity.x ** 2 + player.sprite.body.velocity.y ** 2
    );

    let kickForce, kickX, kickY;

    if (isShooting) {
      // Shooting: more powerful, less upward force
      kickForce = player.getShootPower() + playerSpeed * 1.5;
      kickX = dirX * kickForce;
      kickY = dirY * kickForce + GAME_CONFIG.BALL.KICK_UPWARD_FORCE * 0.5;

      // Visual effect for shooting
      this.createShootEffect(
        player.sprite.x,
        player.sprite.y,
        player.attributes.color
      );
    } else {
      // Normal kick: less powerful, more upward force
      kickForce = player.getKickPower() + playerSpeed * 2;
      kickX = dirX * kickForce;
      kickY = dirY * kickForce + GAME_CONFIG.BALL.KICK_UPWARD_FORCE;
    }

    // Apply velocity to the ball with momentum from player
    const playerVelX = player.sprite.body.velocity.x;
    const playerVelY = player.sprite.body.velocity.y;

    ball.body.setVelocity(
      ball.body.velocity.x + kickX + playerVelX * 0.3,
      ball.body.velocity.y + kickY + playerVelY * 0.3
    );

    // Slightly separate the ball from the player to avoid sticking
    ball.x += dirX * GAME_CONFIG.BALL.SEPARATION_FORCE;
    ball.y += dirY * GAME_CONFIG.BALL.SEPARATION_FORCE;

    console.log(
      `Ball kicked by ${player.attributes.name} with power ${kickForce}`
    );
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

    // Send goal to server for online games - only if game is active
    if (this.gameMode === "online" && this.socketService && this.gameStarted) {
      console.log("Sending goal to server:", scoringPlayer);
      this.socketService.scoreGoal(scoringPlayer);
    } else if (
      this.gameMode === "online" &&
      this.socketService &&
      !this.gameStarted
    ) {
      console.warn("Cannot send goal to server: game not started yet");
    }

    this.goalCooldown = GAME_CONFIG.GOAL_COOLDOWN;
    this.pausedForGoal = true;

    // Reset after goal
    this.time.delayedCall(GAME_CONFIG.GOAL_PAUSE_DURATION, () => {
      this.resetAfterGoal();
    });
  }

  createUI() {
    // Timer display (top center)
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

    // Scoreboard (top center, below timer)
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

    // Player position indicator for online games
    if (this.gameMode === "online") {
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

    // Goal effect text (centered, hidden by default)
    this.goalEffectText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        "GOAL!",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: GAME_CONFIG.UI.FONT_SIZES.GOAL_EFFECT,
          fill: "#ffff00",
          stroke: "#000000",
          strokeThickness: 4,
          align: "center",
          fontStyle: "bold",
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(4000)
      .setVisible(false);

    // Win message (centered, hidden by default)
    this.winText = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 300, "", {
        fontFamily: '"Press Start 2P"',
        fontSize: GAME_CONFIG.UI.FONT_SIZES.WIN_MESSAGE,
        fill: "#00ff00",
        stroke: "#000000",
        strokeThickness: 3,
        align: "center",
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(4000)
      .setVisible(false);
    // Restart key
    // this.restartKey = this.input.keyboard.addKey(
    //   Phaser.Input.Keyboard.KeyCodes.R
    // );
  }

  startPowerupSystem() {
    // Don't start powerups unless game has actually started
    if (!this.gameStarted) {
      console.log("Powerup system not started - game not yet started");
      return;
    }

    this.schedulePowerupSpawn();
    console.log("Powerup system started");
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
    };

    this.powerups.push(powerupData);

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

    // Particle effect at collection point
    this.createParticleEffect(
      powerupData.sprite.x,
      powerupData.sprite.y,
      powerupData.type.color,
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
    const playerName = player.attributes.name;
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

  createPlayerStatsDisplay() {
    // Player 1 stats (left)
    this.add.text(20, 90, "🔵 Player 1", {
      fontFamily: '"Press Start 2P"',
      fontSize: "16px",
      fill: "#1976d2",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 1,
    });
    this.player1StatsText = this.add.text(
      20,
      120,
      "⚡SPD: 1.0 | 🦘JMP: 1.0 | 📏SIZ: 1.0 | ⚽KCK: 1.0 | 🎯SHT: 1.0",
      {
        fontFamily: '"Press Start 2P"',
        fontSize: "12px",
        fill: "#fff",
        backgroundColor: "#001122",
        padding: { x: 6, y: 3 },
        stroke: "#1976d2",
        strokeThickness: 1,
      }
    );

    // Player 2/AI stats (right)
    const player2Name = this.gameMode === "vsAI" ? "AI" : "🔴 Player 2";
    const player2Color = this.gameMode === "vsAI" ? "#ff6600" : "#d32f2f";
    const player2BgColor = this.gameMode === "vsAI" ? "#331100" : "#220011";

    this.add
      .text(GAME_CONFIG.CANVAS_WIDTH - 20, 90, `${player2Name} `, {
        fontFamily: '"Press Start 2P"',
        fontSize: "16px",
        fill: player2Color,
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 1,
      })
      .setOrigin(1, 0);

    this.player2StatsText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH - 20,
        120,
        "⚡SPD: 1.0 | 🦘JMP: 1.0 | 📏SIZ: 1.0 | ⚽KCK: 1.0 | 🎯SHT: 1.0",
        {
          fontFamily: '"Press Start 2P"',
          fontSize: "12px",
          fill: "#fff",
          backgroundColor: player2BgColor,
          padding: { x: 6, y: 3 },
          stroke: player2Color,
          strokeThickness: 1,
        }
      )
      .setOrigin(1, 0);
  }

  updatePlayerStatsDisplay() {
    if (
      !this.player1 ||
      !this.player2 ||
      !this.player1StatsText ||
      !this.player2StatsText ||
      !this.player1.currentAttributes ||
      !this.player2.currentAttributes
    ) {
      return;
    }
    // Update Player 1 stats with enhanced formatting
    this.player1.updateCurrentAttributes();
    const p1Current = this.player1.currentAttributes;

    let p1Text = "";
    p1Text += this.player1.activePowerups.SPEED
      ? `⚡SPD: ${p1Current.speed.toFixed(1)}✨`
      : `⚡SPD: ${p1Current.speed.toFixed(1)}`;
    p1Text += " | ";
    p1Text += this.player1.activePowerups.JUMP
      ? `🦘JMP: ${p1Current.jumpHeight.toFixed(1)}✨`
      : `🦘JMP: ${p1Current.jumpHeight.toFixed(1)}`;
    p1Text += " | ";
    p1Text += `📏SIZ: ${p1Current.size.toFixed(1)}`;
    p1Text += " | ";
    p1Text += this.player1.activePowerups.KICKAdd
      ? `⚽KCK: ${p1Current.kickPower.toFixed(1)}✨`
      : `⚽KCK: ${p1Current.kickPower.toFixed(1)}`;

    p1Text += " | ";

    p1Text += this.player1.activePowerups.SHOOT
      ? `🎯SHT: ${p1Current.shootPower.toFixed(1)}✨`
      : `🎯SHT: ${p1Current.shootPower.toFixed(1)}`;

    this.player1StatsText.setText(p1Text);

    // Update Player 2 stats with enhanced formatting

    this.player2.updateCurrentAttributes();

    const p2Current = this.player2.currentAttributes;

    let p2Text = "";

    p2Text += this.player2.activePowerups.SPEED
      ? `⚡SPD: ${p2Current.speed.toFixed(1)}✨`
      : `⚡SPD: ${p2Current.speed.toFixed(1)}`;

    p2Text += " | ";

    p2Text += this.player2.activePowerups.JUMP
      ? `🦘JMP: ${p2Current.jumpHeight.toFixed(1)}✨`
      : `🦘JMP: ${p2Current.jumpHeight.toFixed(1)}`;

    p2Text += " | ";

    p2Text += `📏SIZ: ${p2Current.size.toFixed(1)}`;

    p2Text += " | ";

    p2Text += this.player2.activePowerups.KICK
      ? `⚽KCK: ${p2Current.kickPower.toFixed(1)}✨`
      : `⚽KCK: ${p2Current.kickPower.toFixed(1)}`;

    p2Text += " | ";

    p2Text += this.player2.activePowerups.SHOOT
      ? `🎯SHT: ${p2Current.shootPower.toFixed(1)}✨`
      : `🎯SHT: ${p2Current.shootPower.toFixed(1)}`;

    this.player2StatsText.setText(p2Text);
  }

  updateScoreDisplay() {
    const player2Name = this.gameMode === "vsAI" ? "AI" : "Player 2";

    const scoreString = `🔵 Player 1: ${this.player1Score}  -  ${player2Name}: ${this.player2Score} 🔴`;

    this.scoreText.setText(scoreString);

    // Add subtle glow effect to score

    this.scoreText.setStyle({
      fontSize: GAME_CONFIG.UI.FONT_SIZES.SCORE,

      fill: "#ffffff",

      backgroundColor: "#1976d2",

      padding: { x: 18, y: 8 },

      align: "center",

      stroke: "#000",

      strokeThickness: 3,
    });
  }

  showEnhancedGoalEffect() {
    // Enhanced GOAL text animation
    this.goalEffectText.setVisible(true);
    this.goalEffectText.setScale(0.1);
    this.goalEffectText.setAlpha(1);

    this.tweens.add({
      targets: this.goalEffectText,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 300,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: this.goalEffectText,
          scaleX: 1.0,
          scaleY: 1.0,
          alpha: 0,
          duration: 700,
          ease: "Power2",
          onComplete: () => {
            this.goalEffectText.setVisible(false);
          },
        });
      },
    });

    // Enhanced flash effect
    const flashRect = this.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT,
      GAME_CONFIG.EFFECTS.GOAL_FLASH.COLOR,
      GAME_CONFIG.EFFECTS.GOAL_FLASH.ALPHA
    );
    flashRect.setDepth(1500);

    this.tweens.add({
      targets: flashRect,
      alpha: 0,
      duration: GAME_CONFIG.EFFECTS.GOAL_FLASH.DURATION,
      ease: "Power2",
      onComplete: () => {
        flashRect.destroy();
      },
    });

    // Particle explosion at goal
    const goalX = this.ball.x;
    const goalY = this.ball.y;
    this.createParticleEffect(goalX, goalY, GAME_CONFIG.COLORS.YELLOW, 20);
  }

  resetAfterGoal() {
    this.ball.setPosition(
      GAME_CONFIG.BALL.STARTING_POSITION.x,
      GAME_CONFIG.BALL.STARTING_POSITION.y
    );
    this.ball.body.setVelocity(0, 0);

    this.player1.sprite.setPosition(
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y
    );
    this.player1.sprite.body.setVelocity(0, 0);

    this.player2.sprite.setPosition(
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y
    );
    this.player2.sprite.body.setVelocity(0, 0);

    this.pausedForGoal = false;
    this.goalCooldown = 0;
  }

  resetBall() {
    this.ball.setPosition(
      GAME_CONFIG.BALL.STARTING_POSITION.x,
      GAME_CONFIG.BALL.STARTING_POSITION.y
    );
    this.ball.body.setVelocity(0, 0);
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

  restartGame() {
    // Use the callback function to return to menu
    if (typeof window !== "undefined" && window.__HEADBALL_RETURN_TO_MENU) {
      window.__HEADBALL_RETURN_TO_MENU();
    } else if (typeof window !== "undefined" && window.location) {
      // Fallback to direct navigation
      window.location.href = "/";
    }
  }

  startGameTimer() {
    // Don't start timer unless game has actually started
    if (!this.gameStarted) {
      console.log("Timer not started - game not yet started");
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

    console.log("Game timer started");
  }

  updateTimer() {
    if (this.gameOver || this.pausedForGoal || this.isPaused) return;

    this.gameTime--;
    this.updateTimerDisplay();

    if (this.gameTime <= 0) {
      this.handleGameEnd();
      return;
    }

    if (this.gameTime <= GAME_CONFIG.TIMER_THRESHOLDS.CRITICAL) {
      this.timerText.setStyle({ fill: "#ff0000" });
    } else if (this.gameTime <= GAME_CONFIG.TIMER_THRESHOLDS.WARNING) {
      this.timerText.setStyle({ fill: "#ffff00" });
    } else {
      this.timerText.setStyle({ fill: "#ffffff" });
    }
  }

  updateTimerDisplay() {
    // Convert to integer to avoid floating point display
    const gameTimeInt = Math.floor(this.gameTime);
    const minutes = Math.floor(gameTimeInt / 60);
    const seconds = gameTimeInt % 60;
    const timeString = `⏱️ ${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    // Determine timer color and background based on time left
    let timerColor = "#ffffff";
    let backgroundColor = "#222222";
    if (gameTimeInt <= 10) {
      timerColor = "#ff0000";
      backgroundColor = "#330000";
      // Pulse effect for last 10 seconds
      this.tweens.add({
        targets: this.timerText,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 500,
        yoyo: true,
        ease: "Power2",
      });
    } else if (gameTimeInt <= 30) {
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

  setupControls() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys("W,S,A,D");
    this.rightShift = this.input.keyboard.addKey("SHIFT");
    this.space = this.input.keyboard.addKey("SPACE");
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

    // Goal zones for collision detection (at the goal mouth)
    this.leftGoalZone = this.physics.add.staticGroup();
    this.leftGoalZone
      .create(75, goalY + 10, "pixel")
      .setScale(GAME_CONFIG.FIELD.GOAL_WIDTH, GAME_CONFIG.FIELD.GOAL_HEIGHT)
      .refreshBody();

    // After creating leftCrossbar, rightCrossbar, leftGoalZone, rightGoalZone...

    // Left net
    this.leftNet = this.add
      .image(
        75, // x: match your left goal/crossbar x
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y + 55, // y: adjust as needed
        "left-net"
      )
      .setOrigin(0.5, 1) // adjust as needed for your image
      .setScale(0.91, 0.91) // adjust scale as needed
      .setDepth(5); // higher than players/ball

    // Right net
    this.rightNet = this.add
      .image(
        GAME_CONFIG.CANVAS_WIDTH - 75, // x: match your right goal/crossbar x
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y + 55, // y: adjust as needed
        "right-net"
      )
      .setOrigin(0.5, 1)
      .setScale(0.91, 0.91) // adjust scale as needed
      .setDepth(5); // higher than players/ball

    this.rightGoalZone = this.physics.add.staticGroup();
    this.rightGoalZone
      .create(GAME_CONFIG.CANVAS_WIDTH - 75, goalY + 10, "pixel")
      .setScale(GAME_CONFIG.FIELD.GOAL_WIDTH, GAME_CONFIG.FIELD.GOAL_HEIGHT)

      .refreshBody();
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

  createShootEffect(x, y, color = 0xff0066) {
    // Create an expanding ring effect
    const ring = this.add.circle(x, y, 20, color, 0.6).setDepth(1000);
    this.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 300,
      ease: "Power2",
      onComplete: () => ring.destroy(),
    });

    // Create directional particles
    for (let i = 0; i < 8; i++) {
      const particle = this.add
        .circle(x, y, Phaser.Math.Between(3, 8), color)
        .setAlpha(0.9)
        .setDepth(1001);

      const angle = (Math.PI * 2 * i) / 8;
      const speed = Phaser.Math.Between(100, 200);
      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      this.tweens.add({
        targets: particle,
        x: x + velocityX,
        y: y + velocityY,
        alpha: 0,
        scale: 0,
        duration: 400,
        ease: "Power2",
        onComplete: () => particle.destroy(),
      });
    }

    // Screen shake effect
    this.cameras.main.shake(100, 0.02);
  }

  update() {
    if (this.isPaused || this.gameOver || this.pausedForGoal) return;
    if (!this.player1 || !this.player2 || !this.ball) return;

    // For online games, don't update game logic until game has started
    if (this.gameMode === "online" && !this.gameStarted) return;

    this.player1.update();
    this.player2.update();
    if (this.goalCooldown > 0) this.goalCooldown--;

    // Send position updates for online multiplayer
    if (this.gameMode === "online" && this.gameStarted) {
      // Only send position from the local player (player1 is always local in online mode)
      if (
        this.player1 &&
        this.player1.isOnlinePlayer &&
        this.player1.sendPlayerPosition
      ) {
        this.player1.sendPlayerPosition();
      }

      // Send ball state if this player is the ball authority
      if (this.isBallAuthority && this.ball) {
        // Throttle ball state updates to every 50ms
        const now = Date.now();
        if (!this.lastBallStateSend || now - this.lastBallStateSend > 50) {
          const ballState = {
            ball: {
              x: this.ball.x,
              y: this.ball.y,
              velocityX: this.ball.body.velocity.x,
              velocityY: this.ball.body.velocity.y,
            },
          };
          console.log("Sending ball state:", ballState);
          this.socketService.sendBallState(ballState);
          this.lastBallStateSend = now;
        }
      }
    }

    this.checkBallBounds();
    this.updatePlayerStatsDisplay();
  }
}
