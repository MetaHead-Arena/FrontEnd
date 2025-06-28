import { Player } from "./Player.js";
import { GAME_CONFIG } from "./config.js";

export class AIPlayer extends Player {
  constructor(scene, x, y, playerKey) {
    // Use "ai-head" as the sprite key for the AI image
    super(scene, x, y, playerKey, "ai", "ai-head");

    // AI-specific properties
    this.reactionTime = 100;
    this.lastDecisionTime = 0;
    this.targetPosition = { x: x, y: y };
    this.isChasingBall = false;
    this.lastBallPosition = { x: 0, y: 0 };

    // AI difficulty settings
    this.difficulty = "medium";
    this.predictionAccuracy = 0.7;
    this.shootChance = 0.3;
  }

  update() {
    super.update();

    const currentTime = this.scene.time.now;
    if (currentTime - this.lastDecisionTime >= this.reactionTime) {
      this.executeAIAction();
      this.lastDecisionTime = currentTime;
    }
    this.makeContinuousAdjustments();
  }

  executeAIAction() {
    if (!this.scene.ball || this.scene.gameOver || this.scene.pausedForGoal)
      return;

    const ball = this.scene.ball;
    const player = this.sprite;

    this.lastBallPosition = { x: ball.x, y: ball.y };

    const distanceToBall = Phaser.Math.Distance.Between(
      player.x,
      player.y,
      ball.x,
      ball.y
    );

    if (distanceToBall < 150 || this.isChasingBall) {
      this.isChasingBall = true;
      this.chaseBall(ball);
    } else {
      this.isChasingBall = false;
      this.returnToPosition();
    }

    this.handleShooting(ball, distanceToBall);
  }

  handleShooting(ball, distanceToBall) {
    let shouldShoot = false;
    if (distanceToBall < 60) shouldShoot = Math.random() < this.shootChance;
    if (ball.body.velocity.x < -50 && ball.x < GAME_CONFIG.CANVAS_WIDTH / 2)
      shouldShoot = Math.random() < this.shootChance * 0.5;
    if (this.sprite.x > GAME_CONFIG.CANVAS_WIDTH / 2 && distanceToBall < 100)
      shouldShoot = Math.random() < this.shootChance * 0.7;
    if (distanceToBall < 120 && Math.random() < 0.05) shouldShoot = true;

    if (shouldShoot) this.shoot();
  }

  chaseBall(ball) {
    const player = this.sprite;
    const currentSpeed = this.getCurrentSpeed();

    const predictionFactor =
      0.1 + (Math.random() - 0.5) * 0.1 * (1 - this.predictionAccuracy);
    const predictedX = ball.x + ball.body.velocity.x * predictionFactor;

    if (player.x < predictedX - 15) {
      player.setVelocityX(currentSpeed);
    } else if (player.x > predictedX + 15) {
      player.setVelocityX(-currentSpeed);
    } else {
      player.setVelocityX(0);
    }

    if (ball.y < player.y - 40 && this.isOnGround) {
      player.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }
    if (this.isOnGround && Math.random() < 0.1) {
      player.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }
  }

  returnToPosition() {
    const player = this.sprite;
    const currentSpeed = this.getCurrentSpeed();

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

    if (player.y > targetY + 15 && this.isOnGround) {
      player.setVelocityY(this.getCurrentJumpVelocity());
      this.isOnGround = false;
    }
  }

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

  destroy() {
    super.destroy();
  }

  makeContinuousAdjustments() {
    if (!this.scene.ball || this.scene.gameOver || this.scene.pausedForGoal)
      return;

    const ball = this.scene.ball;
    const player = this.sprite;
    const currentSpeed = this.getCurrentSpeed();

    if (this.isChasingBall) {
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
