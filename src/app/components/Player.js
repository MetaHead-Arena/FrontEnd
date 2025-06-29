import { GAME_CONFIG } from "./config.js";

export class Player {
  constructor(scene, x, y, playerKey, controls, spriteKey = "player1") {
    this.scene = scene;
    this.controls = controls;
    this.playerKey = playerKey;
    // this.sprite = scene.physics.add.sprite(x, y, spriteKey);
    // Get attributes from config (with fallback to defaults)
    this.attributes = GAME_CONFIG.PLAYER.ATTRIBUTES[playerKey] || {
      ...GAME_CONFIG.PLAYER.DEFAULT_ATTRIBUTES,
      name: `Player ${playerKey}`,
      color: 0xffffff,
    };

    // Base attributes (what the player starts with)
    this.baseAttributes = {
      speed: this.attributes.speed,
      jumpHeight: this.attributes.jumpHeight,
      size: this.attributes.size,
      kickPower: this.attributes.kickPower,
      shootPower: this.attributes.shootPower,
    };

    // Current attributes (base + power-ups)
    this.currentAttributes = { ...this.baseAttributes };

    // Calculate actual stats based on current attributes
    this.speed = GAME_CONFIG.PLAYER.BASE_SPEED * this.currentAttributes.speed;
    this.jumpVelocity =
      GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY * this.currentAttributes.jumpHeight;
    this.kickPower =
      GAME_CONFIG.PLAYER.BASE_KICK_POWER * this.currentAttributes.kickPower;
    this.shootPower =
      GAME_CONFIG.PLAYER.BASE_SHOOT_POWER * this.currentAttributes.shootPower;

    // Create player sprite with texture
    const textureKey = spriteKey || playerKey.toLowerCase();
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setOrigin(0.5, 1); // Bottom center

    // Scale image to match PLAYER.WIDTH & HEIGHT
    const targetWidth = GAME_CONFIG.PLAYER.WIDTH * this.attributes.size;
    const targetHeight = GAME_CONFIG.PLAYER.HEIGHT * this.attributes.size;

    const texture = scene.textures.get(textureKey);
    const frame = texture.getSourceImage();
    const scaleX = targetWidth / frame.width;
    const scaleY = targetHeight / frame.height;

    this.sprite.setScale(scaleX, scaleY);

    this.sprite.setBounce(GAME_CONFIG.PLAYER.BOUNCE);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDragX(GAME_CONFIG.PLAYER.DRAG_X);
    this.sprite.refreshBody();

    // Movement properties
    this.isOnGround = false;

    // Power-up system
    this.activePowerups = {};
    this.basePowerupIndicator = null;

    // Shooting system
    this.isShooting = false;
    this.shootCooldown = 0;
    this.lastShootTime = 0;

    // Online multiplayer state
    this.isOnlinePlayer = scene.gameMode === "online";
    this.socketService = null;
    this.playerPosition = null;

    // Initialize socket service for online games
    if (this.isOnlinePlayer) {
      this.initializeSocketService();
    }

    // Setup collisions
    this.setupCollisions();
  }

  async initializeSocketService() {
    try {
      const { socketService } = await import("../../services/socketService");
      this.socketService = socketService;

      // Get player position from global variable
      if (typeof window !== "undefined" && window.__HEADBALL_PLAYER_POSITION) {
        this.playerPosition = window.__HEADBALL_PLAYER_POSITION;
      }

      console.log(
        "Player socket service initialized for position:",
        this.playerPosition
      );
    } catch (error) {
      console.error("Failed to initialize socket service for player:", error);
    }
  }

  setupCollisions() {
    this.scene.physics.add.collider(this.sprite, this.scene.ground, () => {
      this.isOnGround = true;
    });

    this.scene.physics.add.collider(this.sprite, this.scene.leftWall);
    this.scene.physics.add.collider(this.sprite, this.scene.rightWall);
    this.scene.physics.add.collider(this.sprite, this.scene.topWall);
  }

  update() {
    const wasOnGround = this.isOnGround;

    this.isOnGround =
      this.sprite.body.touching.down ||
      this.sprite.body.onFloor() ||
      (this.sprite.body.velocity.y >= 0 && this.sprite.body.touching.down);

    if (this.isOnGround && !wasOnGround) {
      // Just landed
    }

    this.updatePowerupIndicatorPosition();

    if (this.controls === "arrows") {
      this.handleArrowControls();
    } else if (this.controls === "wasd") {
      this.handleWASDControls();
    }

    // Position sending is now handled in GameScene update loop for better performance
  }

  handleArrowControls() {
    const cursors = this.scene.cursors;
    const rightShift = this.scene.rightShift;

    const currentSpeed = this.getCurrentSpeed();
    if (cursors.left.isDown) {
      this.sprite.setVelocityX(-currentSpeed);
      this.sendInput("move-left", { pressed: true });
    } else if (cursors.right.isDown) {
      this.sprite.setVelocityX(currentSpeed);
      this.sendInput("move-right", { pressed: true });
    } else {
      this.sprite.setVelocityX(0);
      this.sendInput("move-left", { pressed: false });
      this.sendInput("move-right", { pressed: false });
    }

    if (cursors.up.isDown && this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
      this.sendInput("jump", { pressed: true });
    }

    if (rightShift && rightShift.isDown && this.canShoot()) {
      this.shoot();
      this.sendInput("kick", { pressed: true });
    }
  }

  handleWASDControls() {
    const wasd = this.scene.wasd;
    const space = this.scene.space;

    const currentSpeed = this.getCurrentSpeed();
    if (wasd.A.isDown) {
      this.sprite.setVelocityX(-currentSpeed);
      this.sendInput("move-left", { pressed: true });
    } else if (wasd.D.isDown) {
      this.sprite.setVelocityX(currentSpeed);
      this.sendInput("move-right", { pressed: true });
    } else {
      this.sprite.setVelocityX(0);
      this.sendInput("move-left", { pressed: false });
      this.sendInput("move-right", { pressed: false });
    }

    if (wasd.W.isDown && this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
      this.sendInput("jump", { pressed: true });
    }

    if (space && space.isDown && this.canShoot()) {
      this.shoot();
      this.sendInput("kick", { pressed: true });
    }
  }

  sendInput(action, data) {
    if (this.isOnlinePlayer && this.socketService && this.scene.gameStarted) {
      this.socketService.sendInput(action, data);
    }
  }

  sendPlayerPosition() {
    if (
      this.isOnlinePlayer &&
      this.socketService &&
      this.playerPosition &&
      this.scene.gameStarted
    ) {
      // Throttle position updates to every 50ms (20 times per second)
      const now = Date.now();
      if (!this.lastPositionSend || now - this.lastPositionSend > 50) {
        const playerData = {
          x: this.sprite.x,
          y: this.sprite.y,
          velocityX: this.sprite.body.velocity.x,
          velocityY: this.sprite.body.velocity.y,
          direction: this.getDirection(),
          isOnGround: this.isOnGround,
        };

        console.log(`Sending position for ${this.playerPosition}:`, playerData);
        this.socketService.sendPlayerPosition(this.playerPosition, playerData);
        this.lastPositionSend = now;
      }
    }
  }

  getDirection() {
    if (this.sprite.body.velocity.x < 0) return "left";
    if (this.sprite.body.velocity.x > 0) return "right";
    return "idle";
  }

  updateCurrentAttributes() {
    this.currentAttributes.speed =
      this.baseAttributes.speed *
      (this.activePowerups.SPEED
        ? GAME_CONFIG.POWERUPS.TYPES.SPEED.multiplier
        : 1);

    this.currentAttributes.jumpHeight =
      this.baseAttributes.jumpHeight *
      (this.activePowerups.JUMP
        ? GAME_CONFIG.POWERUPS.TYPES.JUMP.multiplier
        : 1);

    this.currentAttributes.size = this.baseAttributes.size;

    this.currentAttributes.kickPower =
      this.baseAttributes.kickPower *
      (this.activePowerups.KICK
        ? GAME_CONFIG.POWERUPS.TYPES.KICK.multiplier
        : 1);

    this.currentAttributes.shootPower =
      this.baseAttributes.shootPower *
      (this.activePowerups.SHOOT
        ? GAME_CONFIG.POWERUPS.TYPES.SHOOT.multiplier
        : 1);
  }

  getKickPower() {
    this.updateCurrentAttributes();
    return (
      GAME_CONFIG.PLAYER.BASE_KICK_POWER * this.currentAttributes.kickPower
    );
  }

  getCurrentSpeed() {
    this.updateCurrentAttributes();
    return GAME_CONFIG.PLAYER.BASE_SPEED * this.currentAttributes.speed;
  }

  getCurrentJumpVelocity() {
    this.updateCurrentAttributes();
    return (
      GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY * this.currentAttributes.jumpHeight
    );
  }

  getShootPower() {
    this.updateCurrentAttributes();
    return (
      GAME_CONFIG.PLAYER.BASE_SHOOT_POWER * this.currentAttributes.shootPower
    );
  }

  shoot() {
    const now = Date.now();
    if (now - this.lastShootTime < this.shootCooldown) return;

    this.isShooting = true;
    this.lastShootTime = now;

    // Reset shooting state after a short delay
    this.scene.time.delayedCall(200, () => {
      this.isShooting = false;
    });
  }

  isCurrentlyShooting() {
    return this.isShooting;
  }

  canShoot() {
    const now = Date.now();
    return now - this.lastShootTime >= this.shootCooldown;
  }

  applyPowerup(type) {
    const powerupConfig = GAME_CONFIG.POWERUPS.TYPES[type];
    if (!powerupConfig) return;

    this.activePowerups[type] = true;

    // Remove powerup after duration
    this.scene.time.delayedCall(powerupConfig.duration, () => {
      this.removePowerup(type);
    });

    this.updatePowerupIndicator();
  }

  removePowerup(type) {
    delete this.activePowerups[type];
    this.updatePowerupIndicator();
  }

  updatePowerupIndicator() {
    if (this.basePowerupIndicator) {
      this.basePowerupIndicator.destroy();
    }

    const activePowerups = Object.keys(this.activePowerups);
    if (activePowerups.length === 0) return;

    const powerupText = activePowerups
      .map((type) => GAME_CONFIG.POWERUPS.TYPES[type].icon)
      .join(" ");

    this.basePowerupIndicator = this.scene.add.text(
      this.sprite.x,
      this.sprite.y - 80,
      powerupText,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: "16px",
        fill: "#ffff00",
        stroke: "#000000",
        strokeThickness: 2,
      }
    );
    this.basePowerupIndicator.setOrigin(0.5, 0.5);
    this.basePowerupIndicator.setDepth(1000);
  }

  updatePowerupIndicatorPosition() {
    if (this.basePowerupIndicator) {
      this.basePowerupIndicator.x = this.sprite.x;
      this.basePowerupIndicator.y = this.sprite.y - 80;
    }
  }

  destroy() {
    if (this.basePowerupIndicator) {
      this.basePowerupIndicator.destroy();
    }
    if (this.sprite) {
      this.sprite.destroy();
    }
  }
}
