import { GAME_CONFIG } from "./config.js";

export class Player {
  constructor(scene, x, y, playerKey, controls) {
    this.scene = scene;
    this.controls = controls;
    this.playerKey = playerKey;

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

    // Create rectangular player sprite with correct pixel size
    this.sprite = scene.physics.add.sprite(x, y, "pixel");
    this.sprite.setTint(this.attributes.color);
    this.sprite.setScale(
      GAME_CONFIG.PLAYER.WIDTH * this.attributes.size, 
      GAME_CONFIG.PLAYER.HEIGHT * this.attributes.size
    );
    this.sprite.setOrigin(0.5, 1); // Bottom center origin
    this.sprite.refreshBody();

    // Physics properties
    this.sprite.setBounce(GAME_CONFIG.PLAYER.BOUNCE);
    this.sprite.setCollideWorldBounds(true);
    this.sprite.setDragX(GAME_CONFIG.PLAYER.DRAG_X);

    // Movement properties
    this.isOnGround = false;

    // Power-up system
    this.activePowerups = {};
    this.basePowerupIndicator = null;

    // Shooting system
    this.isShooting = false;
    this.shootCooldown = 0;
    this.lastShootTime = 0;

    // Setup collisions
    this.setupCollisions();
  }

  setupCollisions() {
    // Collision with ground
    this.scene.physics.add.collider(this.sprite, this.scene.ground, () => {
      this.isOnGround = true;
    });

    // Collision with walls
    this.scene.physics.add.collider(this.sprite, this.scene.leftWall);
    this.scene.physics.add.collider(this.sprite, this.scene.rightWall);
    this.scene.physics.add.collider(this.sprite, this.scene.topWall);
  }

  update() {
    // Check if player is on ground (for jump mechanics) - improved detection
    const wasOnGround = this.isOnGround;
    
    // More reliable ground detection using multiple checks
    this.isOnGround = (
      this.sprite.body.touching.down || 
      this.sprite.body.onFloor() ||
      (this.sprite.body.velocity.y >= 0 && this.sprite.body.touching.down)
    );
    
    // Prevent jump spam by ensuring we're actually on ground
    if (this.isOnGround && !wasOnGround) {
      // Just landed, allow jumping again
    }

    // Update power-up indicator position
    this.updatePowerupIndicatorPosition();

    // Handle movement based on control scheme
    if (this.controls === "arrows") {
      this.handleArrowControls();
    } else if (this.controls === "wasd") {
      this.handleWASDControls();
    }
  }

  handleArrowControls() {
    const cursors = this.scene.cursors;
    const rightShift = this.scene.rightShift;

    // Horizontal movement with speed attribute and power-ups
    const currentSpeed = this.getCurrentSpeed();
    if (cursors.left.isDown) {
      this.sprite.setVelocityX(-currentSpeed);
    } else if (cursors.right.isDown) {
      this.sprite.setVelocityX(currentSpeed);
    }

    // Jump with jump height attribute and power-ups - improved handling
    if (cursors.up.isDown && this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }

    // Shooting control (Right Shift)
    if (rightShift && rightShift.isDown && this.canShoot()) {
      this.shoot();
    }
  }

  handleWASDControls() {
    const wasd = this.scene.wasd;
    const space = this.scene.space;

    // Horizontal movement with speed attribute and power-ups
    const currentSpeed = this.getCurrentSpeed();
    if (wasd.A.isDown) {
      this.sprite.setVelocityX(-currentSpeed);
    } else if (wasd.D.isDown) {
      this.sprite.setVelocityX(currentSpeed);
    }

    // Jump with jump height attribute and power-ups - improved handling
    if (wasd.W.isDown && this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }

    // Shooting control (Space)
    if (space && space.isDown && this.canShoot()) {
      this.shoot();
    }
  }

  // Update current attributes based on active power-ups
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

    this.currentAttributes.size = this.baseAttributes.size; // Size doesn't change with power-ups

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

  // Method to get kick power for ball interactions
  getKickPower() {
    this.updateCurrentAttributes();
    return (
      GAME_CONFIG.PLAYER.BASE_KICK_POWER * this.currentAttributes.kickPower
    );
  }

  // Method to get current speed with power-ups
  getCurrentSpeed() {
    this.updateCurrentAttributes();
    return GAME_CONFIG.PLAYER.BASE_SPEED * this.currentAttributes.speed;
  }

  // Method to get current jump velocity with power-ups
  getCurrentJumpVelocity() {
    this.updateCurrentAttributes();
    return (
      GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY * this.currentAttributes.jumpHeight
    );
  }

  // Method to get shoot power for ball interactions
  getShootPower() {
    this.updateCurrentAttributes();
    return (
      GAME_CONFIG.PLAYER.BASE_SHOOT_POWER * this.currentAttributes.shootPower
    );
  }

  // Check if player can shoot (cooldown check)
  canShoot() {
    const currentTime = this.scene.time.now;
    return currentTime - this.lastShootTime >= GAME_CONFIG.PLAYER.SHOOT_COOLDOWN;
  }

  // Method to shoot (called when shoot button is pressed)
  shoot() {
    if (!this.canShoot()) return false;
    
    this.isShooting = true;
    this.lastShootTime = this.scene.time.now;
    
    // Reset shooting state after a short delay
    this.scene.time.delayedCall(100, () => {
      this.isShooting = false;
    });
    
    return true;
  }

  // Check if player is currently shooting
  isCurrentlyShooting() {
    return this.isShooting;
  }

  // Apply power-up to player
  applyPowerup(type) {
    // Remove existing power-up of same type if any
    if (this.activePowerups[type]) {
      this.scene.time.removeEvent(this.activePowerups[type].timer);
    }

    // Add new power-up
    this.activePowerups[type] = {
      timer: this.scene.time.delayedCall(GAME_CONFIG.POWERUPS.DURATION, () => {
        this.removePowerup(type);
      }),
    };

    this.updatePowerupIndicator();

    // Notify scene to update stats display
    if (this.scene.updatePlayerStatsDisplay) {
      this.scene.updatePlayerStatsDisplay();
    }
  }

  // Remove power-up from player
  removePowerup(type) {
    if (this.activePowerups[type]) {
      this.scene.time.removeEvent(this.activePowerups[type].timer);
      delete this.activePowerups[type];
      this.updatePowerupIndicator();

      // Notify scene to update stats display
      if (this.scene.updatePlayerStatsDisplay) {
        this.scene.updatePlayerStatsDisplay();
      }
    }
  }

  // Update visual power-up indicator
  updatePowerupIndicator() {
    // Remove existing indicator
    if (this.basePowerupIndicator) {
      this.basePowerupIndicator.destroy();
      this.basePowerupIndicator = null;
    }

    // Create new indicator if player has active power-ups
    const activePowerupTypes = Object.keys(this.activePowerups);
    if (activePowerupTypes.length > 0) {
      const offsetY = -40 * this.attributes.size;

      // Create glowing effect around player
      this.basePowerupIndicator = this.scene.add.circle(
        this.sprite.x,
        this.sprite.y + offsetY,
        30 * this.attributes.size,
        0xffffff,
        0.3
      );
      this.basePowerupIndicator.setDepth(500);

      // Add pulsing animation
      this.scene.tweens.add({
        targets: this.basePowerupIndicator,
        alpha: 0.1,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // Update power-up indicator position
  updatePowerupIndicatorPosition() {
    if (this.basePowerupIndicator) {
      const offsetY = -40 * this.attributes.size;
      this.basePowerupIndicator.setPosition(
        this.sprite.x,
        this.sprite.y + offsetY
      );
    }
  }

  // Clean up method
  destroy() {
    // Clean up power-up timers
    Object.values(this.activePowerups).forEach((powerup) => {
      if (powerup.timer) {
        this.scene.time.removeEvent(powerup.timer);
      }
    });

    // Clean up power-up indicator
    if (this.basePowerupIndicator) {
      this.basePowerupIndicator.destroy();
    }

    this.sprite.destroy();
  }
}
