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
    // Set game mode from menu selection
    if (data && data.gameMode) {
      this.gameMode = data.gameMode;
    }
  }

  preload() {
    this.load.image("pixel", PIXEL_SPRITE);
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
    console.log("[GameScene] create called");
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

    // Create field background
    this.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT,
      GAME_CONFIG.COLORS.FIELD_GREEN
    );

    // Enhanced field markings
    this.createEnhancedFieldMarkings();

    // Create field boundaries and goal posts
    this.createFieldBoundaries();
    this.createGoalPosts();

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
      .create(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.CANVAS_HEIGHT + 10, "pixel")
      .setScale(GAME_CONFIG.CANVAS_WIDTH, 20)
      .refreshBody();

    this.leftWall = this.physics.add.staticGroup();
    this.leftWall
      .create(-10, GAME_CONFIG.CANVAS_HEIGHT / 2, "pixel")
      .setScale(20, GAME_CONFIG.CANVAS_HEIGHT)
      .refreshBody();

    this.rightWall = this.physics.add.staticGroup();
    this.rightWall
      .create(GAME_CONFIG.CANVAS_WIDTH + 10, GAME_CONFIG.CANVAS_HEIGHT / 2, "pixel")
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
      controlText = "Player 1: Arrow Keys + Right Shift (Shoot) | Player 2: WASD Keys + Space (Shoot)";
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
    this.powerupBarText = this.add.text(
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
    ).setOrigin(0.5, 0.5).setDepth(3000);
  }

  createBall() {
    // Create ball as a circle with config settings
    this.ball = this.add.circle(
      GAME_CONFIG.BALL.STARTING_POSITION.x,
      GAME_CONFIG.BALL.STARTING_POSITION.y,
      GAME_CONFIG.BALL.SIZE / 2,
      GAME_CONFIG.COLORS.WHITE
    );
    this.physics.add.existing(this.ball);
    this.ball.body.setCircle(GAME_CONFIG.BALL.SIZE / 2);

    // Ball physics
    this.ball.body.setBounce(GAME_CONFIG.BALL.BOUNCE);
    this.ball.body.setCollideWorldBounds(true);
    this.ball.body.setDragX(GAME_CONFIG.BALL.DRAG_X);
    this.ball.body.setDragY(GAME_CONFIG.BALL.DRAG_Y);
    this.ball.body.setMaxVelocity(
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
      this.createShootEffect(player.sprite.x, player.sprite.y, player.attributes.color);
      
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
    const scoringPlayerName = scoringPlayer === "player1" ? "Player 1" : 
      (this.gameMode === "vsAI" ? "AI" : "Player 2");
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
    this.timerText = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.UI.TIMER_Y,
      "Time: 01:00",
      {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.TIMER,
        fill: "#fff",
        backgroundColor: "#222",
        padding: { x: 16, y: 8 },
        align: "center",
        fontStyle: 'bold',
        borderRadius: 12,
      }
    ).setOrigin(0.5, 0.5).setDepth(3000);

    this.scoreText = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.UI.SCORE_Y,
      "Player 1: 0  -  Player 2: 0",
      {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.SCORE,
        fill: "#fff",
        backgroundColor: "#1976d2",
        padding: { x: 18, y: 8 },
        align: "center",
        fontStyle: 'bold',
        borderRadius: 12,
        stroke: '#000',
        strokeThickness: 3
      }
    ).setOrigin(0.5, 0.5).setDepth(3000);

    // Goal effect text
    this.goalEffectText = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      "GOAL!",
      {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.GOAL_EFFECT,
        fill: "#ffff00",
        stroke: "#000000",
        strokeThickness: 4,
        align: "center",
        fontStyle: 'bold',
      }
    ).setOrigin(0.5, 0.5).setDepth(4000).setVisible(false);

    // Win message
    this.winText = this.add.text(GAME_CONFIG.CANVAS_WIDTH / 2, 300, "", {
      fontSize: GAME_CONFIG.UI.FONT_SIZES.WIN_MESSAGE,
      fill: "#00ff00",
      stroke: "#000000",
      strokeThickness: 3,
      align: "center",
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5).setDepth(4000).setVisible(false);

    // Restart button
    this.restartButton = this.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      400,
      "Press R to Return to Menu",
      {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.RESTART_BUTTON,
        fill: "#fff",
        backgroundColor: "#007700",
        padding: { x: 15, y: 8 },
        align: "center",
        borderRadius: 8,
        fontStyle: 'bold',
      }
    ).setOrigin(0.5, 0.5).setDepth(4000).setVisible(false);

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
    
    this.add.text(GAME_CONFIG.CANVAS_WIDTH - 20, 130, `${player2Name} 🔴`, {
      fontSize: "16px",
      fill: player2Color,
      fontStyle: "bold",
      stroke: "#000000",
      strokeThickness: 1,
    }).setOrigin(1, 0);
    this.player2StatsText = this.add.text(
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
    ).setOrigin(1, 0);
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
  }

  resetBall() {
    this.ball.setPosition(
      GAME_CONFIG.BALL.STARTING_POSITION.x,
      GAME_CONFIG.BALL.STARTING_POSITION.y
    );
    this.ball.body.setVelocity(0, 0);
  }

  checkBallBounds() {
    if (this.ball.y > GAME_CONFIG.CANVAS_HEIGHT + 50 || this.ball.x < -50 || this.ball.x > GAME_CONFIG.CANVAS_WIDTH + 50) {
      this.resetBall();
    }
  }

  restartGame() {
    this.scene.stop("GameScene");
    this.scene.start("MenuScene");
  }

  startGameTimer() {
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.gameStarted = true;
    this.updateTimerDisplay();

    this.timerEvent = this.time.addEvent({
      delay: 1000,
      callback: this.updateTimer,
      callbackScope: this,
      loop: true,
    });
  }

  updateTimer() {
    if (this.gameOver || this.pausedForGoal) return;

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
    const minutes = Math.floor(this.gameTime / 60);
    const seconds = this.gameTime % 60;
    const timeString = `⏱️ ${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    // Enhanced timer styling based on time remaining
    let timerColor = "#ffffff";
    let backgroundColor = "#222222";

    if (this.gameTime <= 10) {
      timerColor = "#ff0000";
      backgroundColor = "#330000";
      // Add pulsing effect for last 10 seconds
      this.tweens.add({
        targets: this.timerText,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 500,
        yoyo: true,
        ease: "Power2",
      });
    } else if (this.gameTime <= 30) {
      timerColor = "#ffaa00";
      backgroundColor = "#332200";
    }

    this.timerText.setStyle({
      fontSize: GAME_CONFIG.UI.FONT_SIZES.TIMER,
      fill: timerColor,
      backgroundColor: backgroundColor,
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
    const goalY = GAME_CONFIG.FIELD.GROUND_Y - GAME_CONFIG.FIELD.GOAL_HEIGHT / 2;
    const crossbarY = goalY - GAME_CONFIG.FIELD.GOAL_HEIGHT / 2;

    // Left goal posts and crossbar
    this.add.rectangle(50, goalY, 8, GAME_CONFIG.FIELD.GOAL_HEIGHT, GAME_CONFIG.COLORS.WHITE);
    this.add.rectangle(100, goalY, 8, GAME_CONFIG.FIELD.GOAL_HEIGHT, GAME_CONFIG.COLORS.WHITE);
    this.add.rectangle(75, crossbarY, 50, 8, GAME_CONFIG.COLORS.WHITE);
    this.add.rectangle(75, GAME_CONFIG.FIELD.GROUND_Y, GAME_CONFIG.FIELD.GOAL_WIDTH, 4, GAME_CONFIG.COLORS.WHITE);

    // Right goal posts and crossbar
    this.add.rectangle(GAME_CONFIG.CANVAS_WIDTH - 50, goalY, 8, GAME_CONFIG.FIELD.GOAL_HEIGHT, GAME_CONFIG.COLORS.WHITE);
    this.add.rectangle(GAME_CONFIG.CANVAS_WIDTH - 100, goalY, 8, GAME_CONFIG.FIELD.GOAL_HEIGHT, GAME_CONFIG.COLORS.WHITE);
    this.add.rectangle(GAME_CONFIG.CANVAS_WIDTH - 75, crossbarY, 50, 8, GAME_CONFIG.COLORS.WHITE);
    this.add.rectangle(GAME_CONFIG.CANVAS_WIDTH - 75, GAME_CONFIG.FIELD.GROUND_Y, GAME_CONFIG.FIELD.GOAL_WIDTH, 4, GAME_CONFIG.COLORS.WHITE);

    // Goal areas
    const leftGoalArea = this.add.rectangle(125, goalY, GAME_CONFIG.FIELD.GOAL_AREA_WIDTH, GAME_CONFIG.FIELD.GOAL_HEIGHT + 40, GAME_CONFIG.COLORS.FIELD_GREEN);
    leftGoalArea.setStrokeStyle(3, GAME_CONFIG.COLORS.WHITE);

    const rightGoalArea = this.add.rectangle(GAME_CONFIG.CANVAS_WIDTH - 125, goalY, GAME_CONFIG.FIELD.GOAL_AREA_WIDTH, GAME_CONFIG.FIELD.GOAL_HEIGHT + 40, GAME_CONFIG.COLORS.FIELD_GREEN);
    rightGoalArea.setStrokeStyle(3, GAME_CONFIG.COLORS.WHITE);

    // Physical crossbars to block ball from entering from above
    this.leftCrossbar = this.physics.add.staticGroup();
    this.leftCrossbar.create(75, crossbarY, "pixel").setScale(50, 8).refreshBody();

    this.rightCrossbar = this.physics.add.staticGroup();
    this.rightCrossbar.create(GAME_CONFIG.CANVAS_WIDTH - 75, crossbarY, "pixel").setScale(50, 8).refreshBody();

    // Fixed Goal zones for collision detection - positioned only at the goal mouth opening
    this.leftGoalZone = this.physics.add.staticGroup();
    // Position the goal zone at the goal mouth, between the posts and below the crossbar
    this.leftGoalZone.create(75, goalY + 10, "pixel").setScale(40, GAME_CONFIG.FIELD.GOAL_HEIGHT - 10).refreshBody();

    this.rightGoalZone = this.physics.add.staticGroup();
    // Position the goal zone at the goal mouth, between the posts and below the crossbar  
    this.rightGoalZone.create(GAME_CONFIG.CANVAS_WIDTH - 75, goalY + 10, "pixel").setScale(40, GAME_CONFIG.FIELD.GOAL_HEIGHT - 10).refreshBody();
  }

  createEnhancedFieldMarkings() {
    // Main field outline
    this.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.CANVAS_WIDTH - 4,
      GAME_CONFIG.CANVAS_HEIGHT - 4
    ).setStrokeStyle(4, GAME_CONFIG.COLORS.WHITE);

    // Center line
    this.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      4,
      GAME_CONFIG.CANVAS_HEIGHT - 8,
      GAME_CONFIG.COLORS.WHITE
    );

    // Center circle
    const centerCircle = this.add.circle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.FIELD.CENTER_CIRCLE_RADIUS,
      0x1b5e20 // darker green for center circle
    );
    centerCircle.setStrokeStyle(4, GAME_CONFIG.COLORS.WHITE);

    // Center spot
    this.add.circle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      4,
      GAME_CONFIG.COLORS.WHITE
    );

    // Add crowd only at the top (removed bottom crowd)
    this.add.rectangle(GAME_CONFIG.CANVAS_WIDTH / 2, 10, GAME_CONFIG.CANVAS_WIDTH, 20, 0x888888).setDepth(2000); // Top stand only
    
    // Add simple "people" cheering only at the top
    for (let i = 0; i < Math.floor(GAME_CONFIG.CANVAS_WIDTH / 30); i++) {
      const color = Phaser.Display.Color.RandomRGB().color;
      this.add.circle(20 + i * 30, 20, 8, color).setDepth(2001);
    }

    // Goal areas (penalty boxes)
    const goalAreaWidth = 120;
    const goalAreaHeight = 200;
    this.add.rectangle(goalAreaWidth / 2, GAME_CONFIG.CANVAS_HEIGHT / 2, goalAreaWidth, goalAreaHeight).setStrokeStyle(3, GAME_CONFIG.COLORS.WHITE);
    this.add.rectangle(GAME_CONFIG.CANVAS_WIDTH - goalAreaWidth / 2, GAME_CONFIG.CANVAS_HEIGHT / 2, goalAreaWidth, goalAreaHeight).setStrokeStyle(3, GAME_CONFIG.COLORS.WHITE);

    // Penalty spots
    this.add.circle(80, GAME_CONFIG.CANVAS_HEIGHT / 2, 3, GAME_CONFIG.COLORS.WHITE);
    this.add.circle(GAME_CONFIG.CANVAS_WIDTH - 80, GAME_CONFIG.CANVAS_HEIGHT / 2, 3, GAME_CONFIG.COLORS.WHITE);

    // Corner arcs
    const cornerRadius = 20;
    this.createCornerArc(0, 0, cornerRadius);
    this.createCornerArc(GAME_CONFIG.CANVAS_WIDTH, 0, cornerRadius);
    this.createCornerArc(0, GAME_CONFIG.CANVAS_HEIGHT, cornerRadius);
    this.createCornerArc(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT, cornerRadius);
  }

  createCornerArc(x, y, radius) {
    const graphics = this.add.graphics();
    graphics.lineStyle(3, GAME_CONFIG.COLORS.WHITE);

    let startAngle, endAngle;
    if (x === 0 && y === 0) {
      // Top-left
      startAngle = 0;
      endAngle = Math.PI / 2;
    } else if (x === GAME_CONFIG.CANVAS_WIDTH && y === 0) {
      // Top-right
      startAngle = Math.PI / 2;
      endAngle = Math.PI;
    } else if (x === 0 && y === GAME_CONFIG.CANVAS_HEIGHT) {
      // Bottom-left
      startAngle = -Math.PI / 2;
      endAngle = 0;
    } else {
      // Bottom-right
      startAngle = Math.PI;
      endAngle = (3 * Math.PI) / 2;
    }

    graphics.arc(x, y, radius, startAngle, endAngle);
    graphics.strokePath();
  }

  createParticleEffect(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 6), color);
      particle.setAlpha(0.8);

      const angle = (Math.PI * 2 * i) / count;
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
        onComplete: () => {
          particle.destroy();
        },
      });
    }
  }

  createShootEffect(x, y, playerColor) {
    // Create a more intense particle effect for shooting
    const shootColor = 0xff0066; // Pink/magenta for shooting effect
    
    // Create expanding ring effect
    const ring = this.add.circle(x, y, 20, shootColor, 0.6);
    ring.setDepth(1000);
    
    this.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 300,
      ease: "Power2",
      onComplete: () => {
        ring.destroy();
      },
    });

    // Create directional particles in the direction of the shot
    for (let i = 0; i < 8; i++) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(3, 8), shootColor);
      particle.setAlpha(0.9);
      particle.setDepth(1001);

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
        onComplete: () => {
          particle.destroy();
        },
      });
    }

    // Add screen shake for shooting effect
    this.cameras.main.shake(100, 0.02);
  }

  logToConsole(message, type = "info") {
    if (!GAME_CONFIG.FEEDBACK.CONSOLE_LOGS) return;

    const timestamp = new Date().toLocaleTimeString();
    const styledMessage = `🎮 [${timestamp}] ${message}`;

    switch (type) {
      case "goal":
        console.log(
          `%c${styledMessage}`,
          "color: #00ff00; font-weight: bold; font-size: 14px;"
        );
        break;
      case "powerup":
        console.log(`%c${styledMessage}`, "color: #ffaa00; font-weight: bold;");
        break;
      default:
        console.log(styledMessage);
    }
  }

  update() {
    if (this.goalCooldown > 0) this.goalCooldown--;

    if (this.gameOver && this.restartKey.isDown) {
      this.restartGame();
    }

    if (this.gameOver || this.pausedForGoal) return;

    if (this.player1) this.player1.update();
    if (this.player2) this.player2.update();
    if (this.ball) {
      this.checkBallBounds();
    }

    // Update player stats display to show power-up effects
    this.updatePlayerStatsDisplay();
  }
}
