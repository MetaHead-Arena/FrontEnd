import { GAME_CONFIG } from "./config.js";

export class Player {
  constructor(scene, x, y, playerKey, controls = "wasd", spriteKey = null) {
    this.scene = scene;
    this.playerKey = playerKey;
    this.controls = controls;

    // Validate scene and physics system
    if (!scene) {
      throw new Error("Scene is required for Player constructor");
    }

    if (!scene.physics || !scene.physics.add) {
      console.error("Physics system not ready for Player creation:", {
        hasScene: !!scene,
        hasPhysics: !!scene.physics,
        hasAdd: !!(scene.physics && scene.physics.add),
        sceneKey: scene.scene ? scene.scene.key : "unknown",
      });
      throw new Error("Physics system not initialized - cannot create Player");
    }

    // Load player attributes
    this.attributes = GAME_CONFIG.PLAYER.ATTRIBUTES[playerKey] || {
      ...GAME_CONFIG.PLAYER.DEFAULT_ATTRIBUTES,
      name: playerKey,
      color: 0xffffff,
    };

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
    this.direction = "idle";
    this.currentSpeed = 0;

    // Shooting properties
    this.isShooting = false;
    this.shootCooldown = GAME_CONFIG.PLAYER.SHOOT_COOLDOWN;
    this.lastShootTime = 0;

    // Online multiplayer properties
    this.isOnlinePlayer = false;
    this.playerPosition = null; // Will be set by OnlineGameScene
    this.socketService = null; // Will be set by OnlineGameScene
    this.lastPositionSend = null;

    // Power-up system
    this.activePowerups = {};
    this.powerupTimers = {};
    this.powerupIndicator = null;

    // Current attributes (base + power-ups)
    this.currentAttributes = { ...this.attributes };

    // Setup collisions
    this.setupCollisions();

    console.log(`Player created: ${playerKey} with controls: ${controls}`);
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
    // Validate physics system and scene objects before setting up collisions
    if (!this.scene.physics || !this.scene.physics.add) {
      console.warn("Physics system not available for collision setup");
      return;
    }

    // Check if scene objects exist before adding colliders
    if (this.scene.ground) {
      this.scene.physics.add.collider(this.sprite, this.scene.ground, () => {
        this.isOnGround = true;
      });
    }

    if (this.scene.leftWall) {
      this.scene.physics.add.collider(this.sprite, this.scene.leftWall);
    }

    if (this.scene.rightWall) {
      this.scene.physics.add.collider(this.sprite, this.scene.rightWall);
    }

    if (this.scene.topWall) {
      this.scene.physics.add.collider(this.sprite, this.scene.topWall);
    }
  }

  update() {
    // Update ground state based on physics body
    this.isOnGround =
      this.sprite.body.touching.down || this.sprite.body.onFloor();

    // Update current speed for kick power calculation
    this.currentSpeed = Math.sqrt(
      this.sprite.body.velocity.x ** 2 + this.sprite.body.velocity.y ** 2
    );

    // Update power-up timers
    this.updatePowerupTimers();

    // Update power-up indicator position
    this.updatePowerupIndicatorPosition();

    // Handle input if controls are enabled
    if (this.controls !== "none") {
      this.handleInput();
    }

    // Send position updates for online multiplayer
    if (
      this.isOnlinePlayer &&
      this.socketService &&
      this.playerPosition &&
      this.scene.gameStarted
    ) {
      this.sendPlayerPosition();
    }
  }

  handleInput() {
    if (this.isOnlinePlayer) return;

    if (this.controls === "wasd") {
      this.handleWASDControls();
    } else if (this.controls === "arrows") {
      this.handleArrowControls();
    } else if (this.controls === "both") {
      this.handleCombinedControls();
    }
  }

  handleWASDControls() {
    const wasd = this.scene.wasd;
    const space = this.scene.space;
    const currentSpeed = this.getCurrentSpeed();

    if (wasd.A.isDown) {
      this.sprite.setVelocityX(-currentSpeed);
      this.direction = "left";
      this.sendInput("move-left", { pressed: true });
    } else if (wasd.D.isDown) {
      this.sprite.setVelocityX(currentSpeed);
      this.direction = "right";
      this.sendInput("move-right", { pressed: true });
    } else {
      this.sprite.setVelocityX(0);
      this.direction = "idle";
      this.sendInput("move-left", { pressed: false });
      this.sendInput("move-right", { pressed: false });
    }

    if (wasd.W.isDown && this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
      this.sendInput("jump", { pressed: true });
    }

    if (space.isDown && this.canShoot()) {
      this.shoot();
      this.sendInput("kick", { pressed: true });
    }
  }

  handleArrowControls() {
    const cursors = this.scene.cursors;
    const rightShift = this.scene.rightShift;
    const currentSpeed = this.getCurrentSpeed();

    if (cursors.left.isDown) {
      this.sprite.setVelocityX(-currentSpeed);
      this.direction = "left";
      this.sendInput("move-left", { pressed: true });
    } else if (cursors.right.isDown) {
      this.sprite.setVelocityX(currentSpeed);
      this.direction = "right";
      this.sendInput("move-right", { pressed: true });
    } else {
      this.sprite.setVelocityX(0);
      this.direction = "idle";
      this.sendInput("move-left", { pressed: false });
      this.sendInput("move-right", { pressed: false });
    }

    if (cursors.up.isDown && this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
      this.sendInput("jump", { pressed: true });
    }

    if (rightShift.isDown && this.canShoot()) {
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
    if (!this.socketService || !this.sprite || !this.playerPosition) {
      return;
    }

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

      // Only log position sends occasionally to reduce console spam
      const logPosition = Math.random() < 0.01; // Log 1% of position sends
      if (logPosition) {
        console.log(
          `📡 Sending position for ${this.playerPosition}:`,
          playerData
        );
      }

      this.socketService.sendPlayerPosition({
        position: this.playerPosition,
        player: playerData,
      });
      this.lastPositionSend = now;
    }
  }

  getDirection() {
    if (this.sprite.body.velocity.x < -1) {
      return "left";
    } else if (this.sprite.body.velocity.x > 1) {
      return "right";
    } else {
      return "idle";
    }
  }

  updateCurrentAttributes() {
    this.currentAttributes.speed =
      this.attributes.speed *
      (this.activePowerups.SPEED
        ? GAME_CONFIG.POWERUPS.TYPES.SPEED.multiplier
        : 1);

    this.currentAttributes.jumpHeight =
      this.attributes.jumpHeight *
      (this.activePowerups.JUMP
        ? GAME_CONFIG.POWERUPS.TYPES.JUMP.multiplier
        : 1);

    this.currentAttributes.size = this.attributes.size;

    this.currentAttributes.kickPower =
      this.attributes.kickPower *
      (this.activePowerups.KICK
        ? GAME_CONFIG.POWERUPS.TYPES.KICK.multiplier
        : 1);

    this.currentAttributes.shootPower =
      this.attributes.shootPower *
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
    if (this.powerupIndicator) {
      this.powerupIndicator.destroy();
    }

    const activePowerups = Object.keys(this.activePowerups);
    if (activePowerups.length === 0) return;

    const powerupText = activePowerups
      .map((type) => GAME_CONFIG.POWERUPS.TYPES[type].icon)
      .join(" ");

    this.powerupIndicator = this.scene.add.text(
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
    this.powerupIndicator.setOrigin(0.5, 0.5);
    this.powerupIndicator.setDepth(1000);
  }

  updatePowerupIndicatorPosition() {
    if (this.powerupIndicator) {
      this.powerupIndicator.x = this.sprite.x;
      this.powerupIndicator.y = this.sprite.y - 80;
    }
  }

  updatePowerupTimers() {
    Object.keys(this.powerupTimers).forEach((type) => {
      this.powerupTimers[type] -= 16; // Assuming 60 FPS
      if (this.powerupTimers[type] <= 0) {
        this.removePowerup(type);
      }
    });
  }

  destroy() {
    try {
      console.log(`Destroying player ${this.playerKey}`);

      // Clean up powerup indicator
      if (this.powerupIndicator) {
        this.powerupIndicator.destroy();
        this.powerupIndicator = null;
      }

      // Clean up powerup timers
      if (this.powerupTimers) {
        Object.keys(this.powerupTimers).forEach((type) => {
          if (this.scene && this.scene.time) {
            // Clear any scene timers related to this player
            // Note: Phaser timers are automatically cleaned up when the scene is destroyed
          }
        });
        this.powerupTimers = {};
      }

      // Clear active powerups
      if (this.activePowerups) {
        this.activePowerups = {};
      }

      // Clean up sprite and physics body
      if (this.sprite && this.sprite.active) {
        this.sprite.destroy();
        this.sprite = null;
      }

      // Clear references
      this.scene = null;
      this.socketService = null;

      console.log(`Player ${this.playerKey} destroyed successfully`);
    } catch (error) {
      console.error(`Error destroying player ${this.playerKey}:`, error);
    }
  }
}