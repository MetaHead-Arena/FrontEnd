import { GAME_CONFIG } from "./config.js";

export class BasePlayer {
  constructor(scene, x, y, playerKey, spriteKey) {
    this.scene = scene;
    this.playerKey = playerKey;

    this.attributes = GAME_CONFIG.PLAYER.ATTRIBUTES[playerKey] || {
      ...GAME_CONFIG.PLAYER.DEFAULT_ATTRIBUTES,
      name: playerKey,
      color: 0xffffff,
    };

    const textureKey = spriteKey || playerKey.toLowerCase();
    this.sprite = scene.physics.add.sprite(x, y, textureKey);
    this.sprite.setOrigin(0.5, 1);

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

    this.isOnGround = false;
    this.direction = "idle";
    this.currentSpeed = 0;

    this.isShooting = false;
    this.shootCooldown = GAME_CONFIG.PLAYER.SHOOT_COOLDOWN;
    this.lastShootTime = 0;

    this.activePowerups = {};
    this.powerupTimers = {};
    this.powerupIndicator = null;

    this.currentAttributes = { ...this.attributes };

    this.setupCollisions();
  }

  setupCollisions() {
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
    this.isOnGround =
      this.sprite.body.touching.down || this.sprite.body.onFloor();

    this.currentSpeed = Math.sqrt(
      this.sprite.body.velocity.x ** 2 + this.sprite.body.velocity.y ** 2
    );

    this.updatePowerupTimers();
    this.updatePowerupIndicatorPosition();
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
    if (this.powerupIndicator) {
      this.powerupIndicator.destroy();
      this.powerupIndicator = null;
    }

    if (this.sprite && this.sprite.active) {
      this.sprite.destroy();
      this.sprite = null;
    }

    this.scene = null;
  }
}
