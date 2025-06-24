import { Player } from "./Player.js";
import { GAME_CONFIG } from "./config.js";

export class AIPlayer extends Player {
  constructor(scene, x, y, playerKey) {
    super(scene, x, y, playerKey, "ai");

    // AI-specific properties
    this.reactionTime = 100; // milliseconds
    this.lastDecisionTime = 0;
    this.targetPosition = { x: x, y: y };
    this.isChasingBall = false;
    this.lastBallPosition = { x: 0, y: 0 };

    // AI difficulty settings
    this.difficulty = "medium"; // easy, medium, hard
    this.predictionAccuracy = 0.7; // 0-1, how well AI predicts ball movement
    this.shootChance = 0.3; // 0-1, chance to shoot when near ball
  }

  update() {
    // Call parent update for basic physics
    super.update();

    // AI decision making - make it more responsive
    const currentTime = this.scene.time.now;
    if (currentTime - this.lastDecisionTime >= this.reactionTime) {
      this.executeAIAction();
      this.lastDecisionTime = currentTime;
    }

    // Also make continuous movement adjustments for smoother AI
    this.makeContinuousAdjustments();
  }

  executeAIAction() {
    if (!this.scene.ball || this.scene.gameOver || this.scene.pausedForGoal) {
      return;
    }

    const ball = this.scene.ball;
    const player = this.sprite;

    // Update last ball position
    this.lastBallPosition = { x: ball.x, y: ball.y };

    // Calculate distance to ball
    const distanceToBall = Phaser.Math.Distance.Between(
      player.x,
      player.y,
      ball.x,
      ball.y
    );

    // Determine if AI should chase ball or return to position
    if (distanceToBall < 150 || this.isChasingBall) {
      this.isChasingBall = true;
      this.chaseBall(ball);
    } else {
      this.isChasingBall = false;
      this.returnToPosition();
    }

    // Enhanced shooting logic
    this.handleShooting(ball, distanceToBall);
  }

  handleShooting(ball, distanceToBall) {
    // Check if AI should shoot based on multiple factors
    let shouldShoot = false;

    // Shoot if very close to ball
    if (distanceToBall < 60) {
      shouldShoot = Math.random() < this.shootChance;
    }

    // Shoot if ball is moving toward opponent's goal (left side)
    if (ball.body.velocity.x < -50 && ball.x < GAME_CONFIG.CANVAS_WIDTH / 2) {
      shouldShoot = Math.random() < this.shootChance * 0.5;
    }

    // Shoot if AI is in a good position (right side of field)
    if (this.sprite.x > GAME_CONFIG.CANVAS_WIDTH / 2 && distanceToBall < 100) {
      shouldShoot = Math.random() < this.shootChance * 0.7;
    }

    // Random aggressive shooting sometimes
    if (distanceToBall < 120 && Math.random() < 0.05) {
      shouldShoot = true;
    }

    if (shouldShoot) {
      this.shoot();
    }
  }

  chaseBall(ball) {
    const player = this.sprite;
    const currentSpeed = this.getCurrentSpeed();

    // Predict ball position based on velocity with some randomness
    const predictionFactor =
      0.1 + (Math.random() - 0.5) * 0.1 * (1 - this.predictionAccuracy);
    const predictedX = ball.x + ball.body.velocity.x * predictionFactor;
    // const predictedY = ball.y + ball.body.velocity.y * predictionFactor;

    // Move towards predicted ball position
    if (player.x < predictedX - 15) {
      player.setVelocityX(currentSpeed);
    } else if (player.x > predictedX + 15) {
      player.setVelocityX(-currentSpeed);
    } else {
      player.setVelocityX(0);
    }

    // Jump if ball is above and AI is on ground
    if (ball.y < player.y - 40 && this.isOnGround) {
      player.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }

    // Random jump sometimes when chasing (makes AI more unpredictable)
    if (this.isOnGround && Math.random() < 0.1) {
      player.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }
  }

  returnToPosition() {
    const player = this.sprite;
    const currentSpeed = this.getCurrentSpeed();

    // Return to default position (right side of field) with some randomness
    const targetX =
      GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.x +
      (Math.random() - 0.5) * 50;
    const targetY = GAME_CONFIG.PLAYER.STARTING_POSITIONS.PLAYER2.y;

    if (player.x < targetX - 25) {
      player.setVelocityX(currentSpeed);
    } else if (player.x > targetX + 25) {
      player.setVelocityX(-currentSpeed);
    } else {
      player.setVelocityX(0);
    }

    // Jump if needed to reach target position
    if (player.y > targetY + 15 && this.isOnGround) {
      player.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }
  }

  // Override handleWASDControls to prevent AI from responding to WASD keys

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

  // Override handleArrowControls to prevent AI from responding to arrow keys
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
  // Method to set AI difficulty
  setDifficulty(difficulty) {
    this.difficulty = difficulty;

    switch (difficulty) {
      case "easy":
        this.reactionTime = 150;
        this.predictionAccuracy = 0.6;
        this.shootChance = 0.25;
        break;
      case "medium":
        this.reactionTime = 80;
        this.predictionAccuracy = 0.75;
        this.shootChance = 0.35;
        break;
      case "hard":
        this.reactionTime = 40;
        this.predictionAccuracy = 0.9;
        this.shootChance = 0.5;
        break;
    }
  }

  // Clean up method
  destroy() {
    super.destroy();
  }

  makeContinuousAdjustments() {
    if (!this.scene.ball || this.scene.gameOver || this.scene.pausedForGoal) {
      return;
    }

    const ball = this.scene.ball;
    const player = this.sprite;
    const currentSpeed = this.getCurrentSpeed();

    // Quick position adjustments
    if (this.isChasingBall) {
      // Fine-tune movement toward ball
      const distanceToBall = Phaser.Math.Distance.Between(
        player.x,
        player.y,
        ball.x,
        ball.y
      );
      if (distanceToBall > 50) {
        if (player.x < ball.x - 5) {
          player.setVelocityX(currentSpeed * 0.8);
        } else if (player.x > ball.x + 5) {
          player.setVelocityX(-currentSpeed * 0.8);
        }
      }
    }
  }
}
