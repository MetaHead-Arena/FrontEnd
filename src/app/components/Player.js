import { BasePlayer } from "./BasePlayer.js";

export class Player extends BasePlayer {
  constructor(scene, x, y, playerKey, controls = "wasd", spriteKey = null) {
    super(scene, x, y, playerKey, spriteKey);
    this.controls = controls;

    // Online multiplayer properties
    this.isOnlinePlayer = false;
    this.playerPosition = null; // Will be set by OnlineGameScene
    this.socketService = null; // Will be set by OnlineGameScene
    this.lastPositionSend = null;

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

  update() {
    super.update();

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

  destroy() {
    super.destroy();
    this.socketService = null;
    console.log(`Player ${this.playerKey} destroyed successfully`);
  }
}