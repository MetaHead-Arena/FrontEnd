import { BasePlayer } from "./BasePlayer.js";
import { GAME_CONFIG } from "./config.js";

export class RemotePlayer extends BasePlayer {
  constructor(scene, x, y, playerKey, spriteKey = "player2") {
    super(scene, x, y, playerKey, spriteKey);

    this.isOnlinePlayer = scene.gameMode === "online";
    this.socketService = null;
    this.remotePlayerPosition = null;

    this.targetX = x;
    this.targetY = y;
    this.targetVelocityX = 0;
    this.targetVelocityY = 0;
    this.interpolationFactor = 0.7;
    this.positionBuffer = [];

    if (this.isOnlinePlayer) {
      this.initializeSocketService();
    }
  }

  async initializeSocketService() {
    try {
      const { socketService } = await import("../../services/socketService");
      this.socketService = socketService;

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

  update() {
    super.update();
    this.interpolatePosition();
  }

  interpolatePosition() {
    const now = Date.now();
    const renderTimestamp = now - 100; //- (1000 / this.scene.game.config.fps);

    const buffer = this.positionBuffer;
    while (buffer.length >= 2 && buffer[1].timestamp <= renderTimestamp) {
      buffer.shift();
    }

    if (buffer.length >= 2 && buffer[0].timestamp <= renderTimestamp) {
      const x0 = buffer[0].x;
      const x1 = buffer[1].x;
      const y0 = buffer[0].y;
      const y1 = buffer[1].y;
      const t0 = buffer[0].timestamp;
      const t1 = buffer[1].timestamp;

      const interFactor = (renderTimestamp - t0) / (t1 - t0);
      const newX = x0 + (x1 - x0) * interFactor;
      const newY = y0 + (y1 - y0) * interFactor;

      this.sprite.x = newX;
      this.sprite.y = newY;
    }

    if (newVelocityX < -1) {
      this.direction = "left";
    } else if (newVelocityX > 1) {
      this.direction = "right";
    } else {
      this.direction = "idle";
    }
  }

  handleRemoteInput(inputData) {
    if (!this.isOnlinePlayer || !inputData.action) return;

    const currentSpeed =
      GAME_CONFIG.PLAYER.BASE_SPEED * this.attributes.speed * 2.0;
    const currentJumpVelocity = Math.abs(
      GAME_CONFIG.PLAYER.BASE_JUMP_VELOCITY * this.attributes.jumpHeight
    );

    switch (inputData.action) {
      case "move-left":
        if (inputData.pressed) {
          this.targetVelocityX = -currentSpeed;
          this.direction = "left";
        } else {
          this.targetVelocityX *= 0.8;
        }
        break;
      case "move-right":
        if (inputData.pressed) {
          this.targetVelocityX = currentSpeed;
          this.direction = "right";
        } else {
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
          this.showKickEffect();
        }
        break;
      case "stop":
        this.targetVelocityX = 0;
        this.direction = "idle";
        break;
    }
  }

  handlePositionUpdate(positionData) {
    if (!this.isOnlinePlayer || !positionData) return;

    this.positionBuffer.push({
      timestamp: Date.now(),
      x: positionData.x,
      y: positionData.y,
    });
  }

  showKickEffect() {
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
    super.destroy();
    this.socketService = null;
    console.log(`Remote player ${this.playerKey} destroyed successfully`);
  }

  getDirection() {
    return this.direction;
  }

  applyPowerup(type) {
    console.log(`Remote player power-up applied: ${type}`);
  }

  removePowerup(type) {
    console.log(`Remote player power-up removed: ${type}`);
  }

  updatePowerupIndicator() {}

  updatePowerupIndicatorPosition() {}
}
