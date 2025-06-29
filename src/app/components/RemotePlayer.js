import { GAME_CONFIG } from "./config.js";

export class RemotePlayer {
  constructor(scene, x, y, playerKey, spriteKey = "player2") {
    this.scene = scene;
    this.playerKey = playerKey;
    this.attributes = GAME_CONFIG.PLAYER.ATTRIBUTES[playerKey] || {
      ...GAME_CONFIG.PLAYER.DEFAULT_ATTRIBUTES,
      name: `Remote ${playerKey}`,
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

    // Shooting properties (for compatibility with Player class)
    this.isShooting = false;
    this.shootCooldown = 0;
    this.lastShootTime = 0;

    // Online multiplayer state
    this.isOnlinePlayer = scene.gameMode === "online";
    this.socketService = null;
    this.remotePlayerPosition = null;

    // Position interpolation for smooth movement
    this.targetX = x;
    this.targetY = y;
    this.targetVelocityX = 0;
    this.targetVelocityY = 0;
    this.interpolationFactor = 0.7; // How much to interpolate towards target

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

      // Determine remote player position (opposite of local player)
      if (typeof window !== "undefined" && window.__HEADBALL_PLAYER_POSITION) {
        const localPosition = window.__HEADBALL_PLAYER_POSITION;
        this.remotePlayerPosition =
          localPosition === "player1" ? "player2" : "player1";
      }

      console.log(
        "Remote player socket service initialized for position:",
        this.remotePlayerPosition
      );
    } catch (error) {
      console.error(
        "Failed to initialize socket service for remote player:",
        error
      );
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
    // Interpolate position for smooth movement
    this.interpolatePosition();

    // Update ground state
    this.isOnGround =
      this.sprite.body.touching.down || this.sprite.body.onFloor();
  }

  interpolatePosition() {
    // Smoothly interpolate towards target position
    const currentX = this.sprite.x;
    const currentY = this.sprite.y;
    const currentVelocityX = this.sprite.body.velocity.x;
    const currentVelocityY = this.sprite.body.velocity.y;

    // Calculate position difference to determine interpolation strategy
    const positionDiffX = Math.abs(this.targetX - currentX);
    const positionDiffY = Math.abs(this.targetY - currentY);
    const totalPositionDiff = Math.sqrt(
      positionDiffX * positionDiffX + positionDiffY * positionDiffY
    );

    // Adaptive interpolation factor based on distance
    let interpolationFactor = this.interpolationFactor;

    // If the player is far away, snap more aggressively
    if (totalPositionDiff > 50) {
      interpolationFactor = 0.9; // Fast correction for large differences
    } else if (totalPositionDiff > 20) {
      interpolationFactor = 0.8; // Medium correction for medium differences
    } else {
      interpolationFactor = 0.6; // Smooth interpolation for small differences
    }

    // Interpolate position
    const newX = currentX + (this.targetX - currentX) * interpolationFactor;
    const newY = currentY + (this.targetY - currentY) * interpolationFactor;

    // Interpolate velocity
    const newVelocityX =
      currentVelocityX +
      (this.targetVelocityX - currentVelocityX) * interpolationFactor;
    const newVelocityY =
      currentVelocityY +
      (this.targetVelocityY - currentVelocityY) * interpolationFactor;

    // Apply interpolated values
    this.sprite.x = newX;
    this.sprite.y = newY;
    this.sprite.body.setVelocity(newVelocityX, newVelocityY);

    // Update direction based on velocity
    if (newVelocityX < -1) {
      this.direction = "left";
    } else if (newVelocityX > 1) {
      this.direction = "right";
    } else {
      this.direction = "idle";
    }
  }

  // Handle remote input from server
  handleRemoteInput(inputData) {
    if (!this.isOnlinePlayer || !inputData.action) return;

    const currentSpeed =
      GAME_CONFIG.PLAYER.BASE_SPEED * this.attributes.speed * 2.0; // Match OnlineGameScene speed
    const currentJumpVelocity = Math.abs(
      GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY * this.attributes.jumpHeight
    );

    switch (inputData.action) {
      case "move-left":
        if (inputData.pressed) {
          this.targetVelocityX = -currentSpeed;
          this.direction = "left";
        } else {
          // Apply friction when stopping movement
          this.targetVelocityX *= 0.8;
        }
        break;
      case "move-right":
        if (inputData.pressed) {
          this.targetVelocityX = currentSpeed;
          this.direction = "right";
        } else {
          // Apply friction when stopping movement
          this.targetVelocityX *= 0.8;
        }
        break;
      case "jump":
        if (inputData.pressed && this.isOnGround) {
          this.targetVelocityY = -currentJumpVelocity;
          this.isOnGround = false;
          console.log(
            `Remote player jumped with power: ${currentJumpVelocity}`
          );
        }
        break;
      case "kick":
        if (inputData.pressed) {
          // Visual feedback for kick action
          this.showKickEffect();
        }
        break;
      case "stop":
        // Handle stop movement
        this.targetVelocityX = 0;
        this.direction = "idle";
        break;
    }
  }

  // Handle position update from server
  handlePositionUpdate(positionData) {
    if (!this.isOnlinePlayer || !positionData) return;

    // Calculate time since last update to determine if we need immediate correction
    const now = Date.now();
    if (!this.lastPositionUpdate) {
      this.lastPositionUpdate = now;
    }

    const timeSinceLastUpdate = now - this.lastPositionUpdate;
    this.lastPositionUpdate = now;

    // Update target position for interpolation
    this.targetX = positionData.x || this.sprite.x;
    this.targetY = positionData.y || this.sprite.y;
    this.targetVelocityX = positionData.velocityX || 0;
    this.targetVelocityY = positionData.velocityY || 0;

    // Update direction and ground state
    this.direction = positionData.direction || "idle";
    this.isOnGround =
      positionData.isOnGround !== undefined
        ? positionData.isOnGround
        : this.isOnGround;

    // If too much time has passed since last update, snap to position immediately
    if (timeSinceLastUpdate > 200) {
      console.log(
        "Long time since last position update, snapping to server position"
      );
      this.sprite.x = this.targetX;
      this.sprite.y = this.targetY;
      this.sprite.body.setVelocity(this.targetVelocityX, this.targetVelocityY);
    }
  }

  showKickEffect() {
    // Create a visual effect when remote player kicks
    const kickEffect = this.scene.add.circle(
      this.sprite.x,
      this.sprite.y,
      20,
      0xffff00,
      0.7
    );
    this.scene.tweens.add({
      targets: kickEffect,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        kickEffect.destroy();
      },
    });
  }

  // Shooting methods (for compatibility with Player class)
  isCurrentlyShooting() {
    return this.isShooting;
  }

  canShoot() {
    const now = Date.now();
    return now - this.lastShootTime >= this.shootCooldown;
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

  // Get current position data for synchronization
  getPositionData() {
    return {
      x: this.sprite.x,
      y: this.sprite.y,
      velocityX: this.sprite.body.velocity.x,
      velocityY: this.sprite.body.velocity.y,
      direction: this.direction,
      isOnGround: this.isOnGround,
    };
  }

  // Reset player to starting position
  resetToPosition(x, y) {
    this.sprite.x = x;
    this.sprite.y = y;
    this.sprite.body.setVelocity(0, 0);
    this.targetX = x;
    this.targetY = y;
    this.targetVelocityX = 0;
    this.targetVelocityY = 0;
    this.direction = "idle";
    this.isOnGround = true;
  }

  destroy() {
    if (this.sprite) {
      this.sprite.destroy();
    }
  }

  // Add missing methods to match Player class interface
  getKickPower() {
    return GAME_CONFIG.PLAYER.BASE_KICK_POWER * this.attributes.kickPower;
  }

  getCurrentSpeed() {
    return GAME_CONFIG.PLAYER.BASE_SPEED * this.attributes.speed;
  }

  getCurrentJumpVelocity() {
    return GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY * this.attributes.jumpHeight;
  }

  getShootPower() {
    return GAME_CONFIG.PLAYER.BASE_SHOOT_POWER * this.attributes.shootPower;
  }

  getDirection() {
    return this.direction;
  }

  // Power-up related methods (stubs for compatibility)
  applyPowerup(type) {
    // Remote players don't apply power-ups locally
    console.log(`Remote player power-up applied: ${type}`);
  }

  removePowerup(type) {
    // Remote players don't remove power-ups locally
    console.log(`Remote player power-up removed: ${type}`);
  }

  updatePowerupIndicator() {
    // Remote players don't show power-up indicators locally
  }

  updatePowerupIndicatorPosition() {
    // Remote players don't show power-up indicators locally
  }
}
