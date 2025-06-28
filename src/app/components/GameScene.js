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

    // Game mode (2player or vsAI)
    this.gameMode = "2player";
  }

  init(data) {
    if (typeof window !== "undefined" && window.__HEADBALL_GAME_MODE) {
      this.gameMode = window.__HEADBALL_GAME_MODE;
    } else if (data && data.gameMode) {
      this.gameMode = data.gameMode;
    }
  }

  preload() {
    this.load.image("pixel", PIXEL_SPRITE);
    this.load.image("player1", "/head-1.png");
    this.load.image("player2", "/head-2.png");
    this.load.image("ai-head", "/ai-head.png");
    this.load.image("ball", "/ball.png");
    this.load.image("court", "/court.png");
  }

  resetGameState() {
    this.player1Score = 0;
    this.player2Score = 0;
    this.gameOver = false;
    this.goalCooldown = 0;
    this.pausedForGoal = false;
    this.gameTime = GAME_CONFIG.GAME_DURATION;
    this.timerEvent = null;
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
    this.input.keyboard.on("keydown-ESC", this.handlePause, this);

    this.createPlayers();
    this.createBall();
    this.createUI();
    this.createPlayerStatsDisplay();
    this.startGameTimer();
    this.startPowerupSystem();
    this.physics.add.collider(this.player1.sprite, this.player2.sprite);
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

  createFieldBoundaries() {
    // Create invisible walls for physics
    // this.topWall = this.physics.add.staticGroup();
    // this.topWall
    //   .create(GAME_CONFIG.CANVAS_WIDTH / 2, -10, "pixel")
    //   .setScale(GAME_CONFIG.CANVAS_WIDTH, 20)
    //   .refreshBody();

    this.ground = this.physics.add.staticGroup();
    this.ground
      .create(GAME_CONFIG.CANVAS_WIDTH / 2, GAME_CONFIG.FIELD.GROUND_Y, "pixel")
      .setScale(GAME_CONFIG.CANVAS_WIDTH, 20)
      .refreshBody();

    // this.leftWall = this.physics.add.staticGroup();
    // this.leftWall
    //   .create(-10, GAME_CONFIG.CANVAS_HEIGHT / 2, "pixel")
    //   .setScale(20, GAME_CONFIG.CANVAS_HEIGHT)
    //   .refreshBody();

    // this.rightWall = this.physics.add.staticGroup();
    // this.rightWall
    //   .create(
    //     GAME_CONFIG.CANVAS_WIDTH + 10,
    //     GAME_CONFIG.CANVAS_HEIGHT / 2,
    //     "pixel"
    //   )
    //   .setScale(20, GAME_CONFIG.CANVAS_HEIGHT)
    //   .refreshBody();
  }

  createPlayers() {
    if (this.gameMode === "online") {
      // Player 1: Arrow keys, right side, use "player2" image
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "PLAYER1",
        "arrows",
        "player2" // <-- right side image
      );
      // Player 2: Remote placeholder, left side, use "player1" image
      this.player2 = new RemotePlayer(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER2",
        "player1" // <-- left side image
      );
    } else if (this.gameMode === "vsAI") {
      // Player 1: WASD, left side, use "player1" image
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER1",
        "wasd",
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
      // 2 player local: Player 1 (WASD, left, "player1"), Player 2 (arrows, right, "player2")
      this.player1 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER1.y,
        "PLAYER1",
        "wasd",
        "player1"
      );
      this.player2 = new Player(
        this,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x,
        GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y,
        "PLAYER2",
        "arrows",
        "player2"
      );
    }

    this.physics.add.collider(this.player1.sprite, this.player2.sprite);
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

    // Apply velocity to the ball
    ball.body.setVelocity(
      ball.body.velocity.x + kickX,
      ball.body.velocity.y + kickY
    );

    // Slightly separate the ball from the player to avoid sticking
    ball.x += dirX * GAME_CONFIG.BALL.SEPARATION_FORCE;
    ball.y += dirY * GAME_CONFIG.BALL.SEPARATION_FORCE;
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

    this.goalCooldown = GAME_CONFIG.GOAL_COOLDOWN;
    this.pausedForGoal = true;

    // Reset after goal
    this.time.delayedCall(GAME_CONFIG.GOAL_PAUSE_DURATION, () => {
      this.resetAfterGoal();
    });
  }

  handleGameEnd() {
    this.gameOver = true;

    // Stop the timer and powerup systems
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

    // // Enhanced result display
    // this.winText.setText(resultMessage);
    // this.winText.setStyle({
    //   fontSize: GAME_CONFIG.UI.FONT_SIZES.WIN_MESSAGE,
    //   fill: resultColor,
    //   stroke: "#000000",
    //   strokeThickness: 3,
    //   align: "center",
    // });

    // // Add final score summary
    // const finalScoreText = this.add.text(
    //   GAME_CONFIG.CANVAS_WIDTH / 2,
    //   350,
    //   `Final Score: ${this.player1Score} - ${this.player2Score}`,
    //   {
    //     fontSize: "24px",
    //     fill: "#ffffff",
    //     stroke: "#000000",
    //     strokeThickness: 2,
    //     align: "center",
    //   }
    // );
    // finalScoreText.setOrigin(0.5, 0.5);
    // finalScoreText.setDepth(2000);

    // this.winText.setVisible(true);
    // this.restartButton.setVisible(true);

    // // Stop all movement
    // this.ball.body.setVelocity(0, 0);
    // this.player1.sprite.body.setVelocity(0, 0);
    // this.player2.sprite.body.setVelocity(0, 0);
    // Show overlay with Rematch and Back to Main Menu
    this.showOverlay({
      message: resultMessage,
      buttons: [
        {
          text: "REMATCH",
          onClick: () => {
            this.overlayGroup.clear(true, true);
            this.scene.restart({ gameMode: this.gameMode });
          },
        },
        {
          text: "BACK TO MAIN MENU",
          onClick: () => {
            this.overlayGroup.clear(true, true);
            this.restartGame();
          },
        },
      ],
    });

    // Stop all movement
    this.ball.body.setVelocity(0, 0);
    this.player1.sprite.body.setVelocity(0, 0);
    this.player2.sprite.body.setVelocity(0, 0);
  }

  // handleGameEnd() {
  //   this.gameOver = true;
  //   if (this.timerEvent) this.timerEvent.destroy();
  //   if (this.powerupSpawnTimer) this.powerupSpawnTimer.destroy();

  //   // Clean up remaining power-ups
  //   this.powerups.forEach((powerup) => {
  //     if (powerup.lifetimeTimer) {
  //       powerup.lifetimeTimer.destroy();
  //     }
  //     if (powerup.sprite && powerup.sprite.active) {
  //       powerup.sprite.destroy();
  //     }
  //     if (powerup.icon && powerup.icon.active) {
  //       powerup.icon.destroy();
  //     }
  //   });
  //   this.powerups = [];

  //   let resultMessage = "";
  //   if (this.player1Score > this.player2Score) {
  //     resultMessage = "🏆 Player 1 Wins! 🎉";
  //   } else if (this.player2Score > this.player1Score) {
  //     const player2Name = this.gameMode === "vsAI" ? "AI" : "Player 2";
  //     resultMessage = `🏆 ${player2Name} Wins! 🎉`;
  //   } else {
  //     resultMessage = "🤝 It's a Draw! 🤝";
  //   }

  //   // Show overlay with Rematch and Back to Main Menu
  //   this.showOverlay({
  //     message: resultMessage,
  //     buttons: [
  //       {
  //         text: "REMATCH",
  //         onClick: () => {
  //           this.overlayGroup.clear(true, true);
  //           this.scene.restart({ gameMode: this.gameMode });
  //         },
  //       },
  //       {
  //         text: "BACK TO MAIN MENU",
  //         onClick: () => {
  //           this.overlayGroup.clear(true, true);
  //           this.restartGame();
  //         },
  //       },
  //     ],
  //   });

  //   // Stop all movement
  //   this.ball.body.setVelocity(0, 0);
  //   this.player1.sprite.body.setVelocity(0, 0);
  //   this.player2.sprite.body.setVelocity(0, 0);
  // }

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
    const minutes = Math.floor(this.gameTime / 60);
    const seconds = this.gameTime % 60;
    const timeString = `⏱️ ${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    // Determine timer color and background based on time left
    let timerColor = "#ffffff";
    let backgroundColor = "#222222";
    if (this.gameTime <= 10) {
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

    this.player1.update();
    this.player2.update();
    if (this.goalCooldown > 0) this.goalCooldown--;

    this.checkBallBounds();
    this.updatePlayerStatsDisplay();
  }
}
