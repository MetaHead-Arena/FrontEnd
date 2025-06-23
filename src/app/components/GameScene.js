import { GAME_CONFIG, PIXEL_SPRITE } from "./config.js";
import { Player } from "./Player.js";
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

    // Game mode (2player or vsAI)
    this.gameMode = "2player";
  }

  init(data) {
    // Set game mode from window object (set by React component)
    if (typeof window !== "undefined" && window.__HEADBALL_GAME_MODE) {
      this.gameMode = window.__HEADBALL_GAME_MODE;
    } else if (data && data.gameMode) {
      // Fallback to data parameter if window is not available
      this.gameMode = data.gameMode;
    }
    // Default remains "2player" if neither is available
  }

  preload() {
    this.load.image("pixel", PIXEL_SPRITE);
    this.load.image("player1", "/head-1.png");
    this.load.image("player2", "/head-2.png");
    this.load.image("ball", "/ball.png");
    this.load.image("court", "/court.png");this.load.image("court", "/court.png"); // Load pixel-art stadium background // Load pixel-art stadium background
  }

  resetGameState() {
    // Reset all game state variables
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.goalCooldown = 0;
    this.pausedForGoal = false;

    // Reset timer system
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.timerEvent = null;
    this.gameStarted = false;

    // Reset power-up system
    this.powerups = [];
    this.powerupSpawnTimer = null;
    this.lastPlayerToTouchBall = null;
  }

  create() {
       this.add.rectangle(768, 650, 20, 20, 0xff0000); // Ball marker
   this.add.rectangle(200, 680, 20, 20, 0x00ff00); // Player 1 marker
   this.add.rectangle(1336, 680, 20, 20, 0x0000ff); // Player 2 marker
    // console.log("[GameScene] create called");
    // Reset all game state variables
    this.resetGameState();

    // Set world bounds and gravity
    this.physics.world.setBounds(
      0,
      0,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT
    );
    this.physics.world.gravity.y = GAME_CONFIG.GRAVITY;

    // Add pixel-art stadium background image
    this.add.image(0, 0, "court").setOrigin(0, 0).setDisplaySize(1536, 1024);

    // Create field boundaries and goal posts
    this.createFieldBoundaries();
    // this.createGoalPosts();

    // Setup game components
    this.setupControls();
    this.createPlayers();
    this.createBall();
    this.createUI();
    this.createPlayerStatsDisplay();
    this.startGameTimer();
    this.startPowerupSystem();
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
        .create(
          GAME_CONFIG.CANVAS_WIDTH / 2,
          820,
          "pixel"
        )
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
    // Create Player 1 (always human)
    this.player1 = new Player(
      this,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
      "PLAYER1",
      "arrows"
    );

    // Create Player 2 based on game mode
    if (this.gameMode === "vsAI") {
      // Create AI player
      this.player2 = new AIPlayer(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "AI"
      );

      // Set AI difficulty (can be made configurable later)
      this.player2.setDifficulty("medium");
    } else {
      // Create human Player 2
      this.player2 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "PLAYER2",
        "wasd"
      );
    }

    // Player collision
    this.physics.add.collider(this.player1.sprite, this.player2.sprite);

    // Control hints based on game mode
    let controlText = "";
    if (this.gameMode === "vsAI") {
      controlText = "Player 1: Arrow Keys + Right Shift (Shoot) | AI Player";
    } else {
      controlText =
        "Player 1: Arrow Keys + Right Shift (Shoot) | Player 2: WASD Keys + Space (Shoot)";
    }

    this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.CONTROLS_Y,
        controlText,
        {
          fontSize: GAME_CONFIG.UI.FONT_SIZES.CONTROLS,
          fill: "#ffffff",
          backgroundColor: "#000000",
          padding: { x: 8, y: 4 },
          align: "center",
        }
      )
      .setOrigin(0.5, 0.5);

    // Add powerup bar under the controls text
    this.powerupBarText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.POWERUP_BAR_Y,
        "🌟 Power-ups will appear on the field - touch them with the ball! 🌟",
        {
          fontSize: GAME_CONFIG.UI.FONT_SIZES.POWERUP_BAR,
          fill: "#ffff00",
          backgroundColor: "#333333",
          padding: { x: 8, y: 4 },
          align: "center",
          stroke: "#000000",
          strokeThickness: 1,
        }
      )
      .setOrigin(0.5, 0.5)
      .setDepth(3000);
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
    this.ball.setCollideWorldBounds(true);
    this.ball.setDragX(GAME_CONFIG.BALL.DRAG_X);
    this.ball.setDragY(GAME_CONFIG.BALL.DRAG_Y);
    this.ball.setMaxVelocity(
      GAME_CONFIG.BALL.MAX_VELOCITY,
      GAME_CONFIG.BALL.MAX_VELOCITY
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
    // Check if player is shooting or just moving normally
    const isShooting = player.isCurrentlyShooting();

    // Calculate kick direction and force using player's attributes
    const dx = ball.x - player.sprite.x;
    const dy = ball.y - player.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return;

    const dirX = dx / distance;
    const dirY = dy / distance;

    const playerSpeed = Math.sqrt(
      player.sprite.body.velocity.x ** 2 + player.sprite.body.velocity.y ** 2
    );

    let kickForce, kickX, kickY;

    if (isShooting) {
      // Shooting behavior - more powerful and direct
      kickForce = player.getShootPower() + playerSpeed * 1.5;
      kickX = dirX * kickForce;
      kickY = dirY * kickForce + GAME_CONFIG.BALL.KICK_UPWARD_FORCE * 0.5; // Less upward force for shooting

      // Add shooting visual effect
      this.createShootEffect(
        player.sprite.x,
        player.sprite.y,
        player.attributes.color
      );

      // Log shooting action
      this.logToConsole(`${player.attributes.name} shoots! 💥`, "powerup");
    } else {
      // Normal kicking behavior
      kickForce = player.getKickPower() + playerSpeed * 2;
      kickX = dirX * kickForce;
      kickY = dirY * kickForce + GAME_CONFIG.BALL.KICK_UPWARD_FORCE;
    }

    ball.body.setVelocity(
      ball.body.velocity.x + kickX,
      ball.body.velocity.y + kickY
    );
    ball.x += dirX * GAME_CONFIG.BALL.SEPARATION_FORCE;
    ball.y += dirY * GAME_CONFIG.BALL.SEPARATION_FORCE;
  }

  handleGoal(scoringPlayer) {
    if (this.gameOver || this.pausedForGoal) return;

    // Update score
    if (scoringPlayer === "player1") {
      this.player1Score++;
    } else {
      this.player2Score++;
    }

    // Enhanced goal effects
    this.updateScoreDisplay();
    this.showEnhancedGoalEffect();

    // Console logging
    const goalMessage =
      GAME_CONFIG.FEEDBACK.GOAL_MESSAGES[
        Math.floor(Math.random() * GAME_CONFIG.FEEDBACK.GOAL_MESSAGES.length)
      ];
    const scoringPlayerName =
      scoringPlayer === "player1"
        ? "Player 1"
        : this.gameMode === "vsAI"
        ? "AI"
        : "Player 2";
    this.logToConsole(
      `${goalMessage} ${scoringPlayerName} scores! Score: ${this.player1Score}-${this.player2Score}`,
      "goal"
    );

    this.goalCooldown = GAME_CONFIG.GOAL_COOLDOWN;
    this.pausedForGoal = true;

    // Reset after goal
    this.time.delayedCall(GAME_CONFIG.GOAL_PAUSE_DURATION, () => {
      this.resetAfterGoal();
    });
  }

  handleGameEnd() {
    this.gameOver = true;
    if (this.timerEvent) this.timerEvent.destroy();
    if (this.powerupSpawnTimer) this.powerupSpawnTimer.destroy();

    // Clean up remaining power-ups
    this.powerups.forEach((powerup) => {
      if (powerup.lifetimeTimer) {
        powerup.lifetimeTimer.destroy();
      }
      if (powerup.sprite && powerup.sprite.active) {
        powerup.sprite.destroy();
      }
      if (powerup.icon && powerup.icon.active) {
        powerup.icon.destroy();
      }
    });
    this.powerups = [];

    let resultMessage = "";
    let resultColor = "#00ff00";

    if (this.player1Score > this.player2Score) {
      resultMessage = "🏆 Player 1 Wins! 🎉";
      resultColor = "#1976d2";
    } else if (this.player2Score > this.player1Score) {
      const player2Name = this.gameMode === "vsAI" ? "AI" : "Player 2";
      resultMessage = `🏆 ${player2Name} Wins! 🎉`;
      resultColor = "#d32f2f";
    } else {
      resultMessage = "🤝 It's a Draw! 🤝";
      resultColor = "#ffaa00";
    }

    // Enhanced result display
    this.winText.setText(resultMessage);
    this.winText.setStyle({
      fontSize: GAME_CONFIG.UI.FONT_SIZES.WIN_MESSAGE,
      fill: resultColor,
      stroke: "#000000",
      strokeThickness: 3,
      align: "center",
    });

    // Add final score summary
    const finalScoreText = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      350,
      `Final Score: ${this.player1Score} - ${this.player2Score}`,
      {
        fontSize: "24px",
        fill: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
        align: "center",
      }
    );
    finalScoreText.setOrigin(0.5, 0.5);
    finalScoreText.setDepth(2000);

    this.winText.setVisible(true);
    this.restartButton.setVisible(true);

    // Console log final result
    this.logToConsole(
      `🏁 Game Over! ${resultMessage} Final Score: ${this.player1Score}-${this.player2Score}`,
      "goal"
    );

    this.ball.body.setVelocity(0, 0);
    this.player1.sprite.body.setVelocity(0, 0);
    this.player2.sprite.body.setVelocity(0, 0);
  }

  createUI() {
    // Move scoreboard and timer to top center
    this.timerText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.TIMER_Y,
        "Time: 01:00",
        {
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

    this.scoreText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.UI.SCORE_Y,
        "Player 1: 0  -  Player 2: 0",
        {
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

    // Goal effect text
    this.goalEffectText = this.add
      .text(
        GAME_CONFIG.CANVAS_WIDTH / 2,
        GAME_CONFIG.CANVAS_HEIGHT / 2,
        "GOAL!",
        {
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

    // Win message
    this.winText = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 300, "", {
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

    // Restart button
    this.restartButton = this.add
      .text(GAME_CONFIG.CANVAS_WIDTH / 2, 400, "Press R to Return to Menu", {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.RESTART_BUTTON,
        fill: "#fff",
        backgroundColor: "#007700",
        padding: { x: 15, y: 8 },
        align: "center",
        borderRadius: 8,
        fontStyle: "bold",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(4000)
      .setVisible(false);

    this.restartKey = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.R
    );
  }

  startPowerupSystem() {
    this.schedulePowerupSpawn();
  }

  schedulePowerupSpawn() {
    if (this.gameOver) return;

    const delay = Phaser.Math.Between(
      GAME_CONFIG.POWERUPS.SPAWN_INTERVAL_MIN,
      GAME_CONFIG.POWERUPS.SPAWN_INTERVAL_MAX
    );

    this.powerupSpawnTimer = this.time.delayedCall(delay, () => {
      this.spawnPowerup();
      this.schedulePowerupSpawn(); // Schedule next spawn
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
      fontSize: "20px",
      fill: "#ffffff",
    });
    icon.setOrigin(0.5, 0.5);
    icon.setDepth(801);

    // Add physics
    this.physics.add.existing(powerup);
    powerup.body.setCircle(GAME_CONFIG.POWERUPS.SIZE);
    powerup.body.setImmovable(true);
    powerup.body.setGravityY(-GAME_CONFIG.GRAVITY); // Cancel out world gravity
    powerup.body.setVelocity(0, 0); // Make sure it's completely still

    // Add gentle floating animation
    this.tweens.add({
      targets: [powerup, icon],
      y: y - 5, // Very small movement
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Add glowing effect
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

    // Set up collision with ball
    this.physics.add.overlap(this.ball, powerup, () => {
      this.collectPowerup(powerupData);
    });

    // Auto-remove power-up after lifetime expires
    powerupData.lifetimeTimer = this.time.delayedCall(
      GAME_CONFIG.POWERUPS.LIFETIME,
      () => {
        this.removePowerup(powerupData);
      }
    );
  }

  collectPowerup(powerupData) {
    if (powerupData.collected) return; // Prevent double collection

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

      // Show power-up notification
      this.showPowerupNotification(
        powerupData.config.name,
        this.lastPlayerToTouchBall
      );

      // Console logging
      const powerupMessage =
        GAME_CONFIG.FEEDBACK.POWERUP_MESSAGES[
          Math.floor(
            Math.random() * GAME_CONFIG.FEEDBACK.POWERUP_MESSAGES.length
          )
        ];
      const playerName =
        this.lastPlayerToTouchBall === this.player1 ? "Player 1" : "Player 2";
      this.logToConsole(
        `${powerupMessage} ${playerName} collected ${powerupData.config.name}!`,
        "powerup"
      );
    }

    this.removePowerup(powerupData);
  }

  removePowerup(powerupData) {
    if (powerupData.collected) return; // Already removed
    powerupData.collected = true;

    // Cancel the lifetime timer if it exists
    if (powerupData.lifetimeTimer) {
      powerupData.lifetimeTimer.destroy();
      powerupData.lifetimeTimer = null;
    }

    // Remove from array first
    const index = this.powerups.indexOf(powerupData);
    if (index > -1) {
      this.powerups.splice(index, 1);
    }

    // Immediately destroy sprites
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
    // Player 1 stats (left side, below controls)
    this.add.text(20, 130, "🔵 Player 1", {
      fontSize: "16px",
      fill: "#1976d2",
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 1,
    });
    this.player1StatsText = this.add.text(
      20,
      150,
      "⚡SPD: 1.0 | 🦘JMP: 1.0 | 📏SIZ: 1.0 | ⚽KCK: 1.0 | 🎯SHT: 1.0",
      {
        fontSize: "12px",
        fill: "#fff",
        backgroundColor: "#001122",
        padding: { x: 6, y: 3 },
        stroke: "#1976d2",
        strokeThickness: 1,
      }
    );

    // Player 2/AI stats (right side, below controls)
    const player2Name = this.gameMode === "vsAI" ? "AI" : "Player 2";
    const player2Color = this.gameMode === "vsAI" ? "#ff6600" : "#d32f2f";
    const player2BgColor = this.gameMode === "vsAI" ? "#331100" : "#220011";

    this.add
      .text(GAME_CONFIG.CANVAS_WIDTH - 20, 130, `${player2Name} `, {
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
        150,
        "⚡SPD: 1.0 | 🦘JMP: 1.0 | 📏SIZ: 1.0 | ⚽KCK: 1.0 | 🎯SHT: 1.0",
        {
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
    if (!this.player1StatsText || !this.player2StatsText) return;
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
    p1Text += this.player1.activePowerups.KICK
    ? `⚽KCK: ${p1Current.kickPower.toFixed(1)}✨`
    : "";
  }}