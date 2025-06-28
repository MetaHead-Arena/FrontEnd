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

    // Setup collisions
    this.setupCollisions();
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
  }

  handleArrowControls() {
    const cursors = this.scene.cursors;
    const rightShift = this.scene.rightShift;

    const currentSpeed = this.getCurrentSpeed();
    if (cursors.left.isDown) {
      this.sprite.setVelocityX(-currentSpeed);
    } else if (cursors.right.isDown) {
      this.sprite.setVelocityX(currentSpeed);
    }

    if (cursors.up.isDown && this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }

    if (rightShift && rightShift.isDown && this.canShoot()) {
      this.shoot();
    }
  }

  handleWASDControls() {
    const wasd = this.scene.wasd;
    const space = this.scene.space;

    const currentSpeed = this.getCurrentSpeed();
    if (wasd.A.isDown) {
      this.sprite.setVelocityX(-currentSpeed);
    } else if (wasd.D.isDown) {
      this.sprite.setVelocityX(currentSpeed);
    }

    if (wasd.W.isDown && this.isOnGround) {
      this.sprite.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }

    if (space && space.isDown && this.canShoot()) {
      this.shoot();
    }
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

  canShoot() {
    const currentTime = this.scene.time.now;
    return (
      currentTime - this.lastShootTime >= GAME_CONFIG.PLAYER.SHOOT_COOLDOWN
    );
  }

  shoot() {
    if (!this.canShoot()) return false;

    this.isShooting = true;
    this.lastShootTime = this.scene.time.now;

    this.scene.time.delayedCall(100, () => {
      this.isShooting = false;
    });

    return true;
  }

  isCurrentlyShooting() {
    return this.isShooting;
  }

  applyPowerup(type) {
    if (this.activePowerups[type]) {
      this.scene.time.removeEvent(this.activePowerups[type].timer);
    }

    this.activePowerups[type] = {
      timer: this.scene.time.delayedCall(GAME_CONFIG.POWERUPS.DURATION, () => {
        this.removePowerup(type);
      }),
    };

    this.updatePowerupIndicator();

    if (this.scene.updatePlayerStatsDisplay) {
      this.scene.updatePlayerStatsDisplay();
    }
  }

  removePowerup(type) {
    if (this.activePowerups[type]) {
      this.scene.time.removeEvent(this.activePowerups[type].timer);
      delete this.activePowerups[type];
      this.updatePowerupIndicator();

      if (this.scene.updatePlayerStatsDisplay) {
        this.scene.updatePlayerStatsDisplay();
      }
    }
  }

  updatePowerupIndicator() {
    if (this.basePowerupIndicator) {
      this.basePowerupIndicator.destroy();
      this.basePowerupIndicator = null;
    }

    const activePowerupTypes = Object.keys(this.activePowerups);
    if (activePowerupTypes.length > 0) {
      const offsetY = -40 * this.attributes.size;

      this.basePowerupIndicator = this.scene.add.circle(
        this.sprite.x,
        this.sprite.y + offsetY,
        30 * this.attributes.size,
        0xffffff,
        0.3
      );
      this.basePowerupIndicator.setDepth(500);

      this.scene.tweens.add({
        targets: this.basePowerupIndicator,
        alpha: 0.1,
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  updatePowerupIndicatorPosition() {
    if (this.basePowerupIndicator) {
      const offsetY = -40 * this.attributes.size;
      this.basePowerupIndicator.setPosition(
        this.sprite.x,
        this.sprite.y + offsetY
      );
    }
  }

  destroy() {
    Object.values(this.activePowerups).forEach((powerup) => {
      if (powerup.timer) {
        this.scene.time.removeEvent(powerup.timer);
      }
    });

    if (this.basePowerupIndicator) {
      this.basePowerupIndicator.destroy();
    }

    this.sprite.destroy();
  }
}
