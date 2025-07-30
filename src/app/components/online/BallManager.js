import { GAME_CONFIG } from "../config.js";
import { logger } from "../../lib/logger.js";

/**
 * BallManager - Manages ball physics, synchronization, and interactions
 */
export class BallManager {
  constructor(scene, gameState, effects, performance) {
    this.scene = scene;
    this.gameState = gameState;
    this.effects = effects;
    this.performance = performance;
    
    // Ball instance
    this.ball = null;
    
    // Network reference (set later)
    this.network = null;
    
    // Ball authority
    this.ballAuthority = false;
    
    // Ball state synchronization
    this.lastBallStateSend = 0;
    this.ballSyncThreshold = 33; // 30 FPS max
    
    // Ball prediction and smoothing
    this.ballHistory = [];
    this.maxBallHistory = 10;
    this.interpolationBuffer = [];
    
    // Collision detection
    this.collisionCooldown = 0;
    this.lastCollisionTime = 0;
    this.minCollisionDelay = 100; // ms
    
    // Trail system
    this.ballTrail = [];
    this.maxTrailPoints = 20;
    
    logger.debug("BallManager initialized");
  }
  
  setNetwork(network) {
    this.network = network;
  }
  
  // Ball creation
  createBall() {
    logger.debug("Creating ball");
    
    try {
      // Create ball sprite
      this.ball = this.scene.physics.add.sprite(
        GAME_CONFIG.BALL.STARTING_POSITION.x,
        GAME_CONFIG.BALL.STARTING_POSITION.y,
        "ball"
      );
      
      // Scale ball to match desired size
      const texture = this.scene.textures.get("ball").getSourceImage();
      const scaleX = GAME_CONFIG.BALL.SIZE / texture.width;
      const scaleY = GAME_CONFIG.BALL.SIZE / texture.height;
      this.ball.setScale(scaleX, scaleY);
      
      // Set physics properties
      this.configureBallPhysics();
      
      // Set ball authority based on player position
      this.ballAuthority = this.scene.playerPosition === "player1";
      
      logger.debug("Ball created successfully", {
        authority: this.ballAuthority,
        position: { x: this.ball.x, y: this.ball.y },
        size: GAME_CONFIG.BALL.SIZE
      });
      
    } catch (error) {
      logger.error("Failed to create ball", { error: error.message });
      throw error;
    }
  }
  
  configureBallPhysics() {
    // Basic physics properties
    this.ball.setBounce(GAME_CONFIG.BALL.BOUNCE);
    this.ball.setDragX(GAME_CONFIG.BALL.DRAG_X);
    this.ball.setDragY(GAME_CONFIG.BALL.DRAG_Y);
    this.ball.setMaxVelocity(
      GAME_CONFIG.BALL.MAX_VELOCITY,
      GAME_CONFIG.BALL.MAX_VELOCITY
    );
    
    // Enhanced physics for better realism
    if (GAME_CONFIG.BALL.MASS) {
      this.ball.body.mass = GAME_CONFIG.BALL.MASS;
    }
    
    // Set collision bounds
    this.ball.setCollideWorldBounds(true);
    
    // Custom bounds for ball area
    this.ball.body.customBoundsRectangle = new Phaser.Geom.Rectangle(
      0,
      0,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.FIELD.GROUND_Y + 20
    );
    
    // Set ball body to circle for better collision detection
    const radius = GAME_CONFIG.BALL.RADIUS || GAME_CONFIG.BALL.SIZE / 2;
    this.ball.body.setCircle(radius);
    
    logger.debug("Ball physics configured");
  }
  
  // Ball authority management
  isBallAuthority() {
    return this.ballAuthority;
  }
  
  setBallAuthority(authority) {
    this.ballAuthority = authority;
    logger.debug("Ball authority changed", { authority });
  }
  
  // Ball state management
  resetBall() {
    if (!this.ball) return;
    
    logger.debug("Resetting ball position");
    
    this.ball.setPosition(
      GAME_CONFIG.BALL.STARTING_POSITION.x,
      GAME_CONFIG.BALL.STARTING_POSITION.y
    );
    this.ball.body.setVelocity(0, 0);
    
    // Clear trail and history
    this.ballTrail = [];
    this.ballHistory = [];
    this.interpolationBuffer = [];
    
    // Reset collision state
    this.collisionCooldown = 0;
    this.lastCollisionTime = 0;
    
    logger.debug("Ball reset complete");
  }
  
  // Player collision handling
  setupPlayerCollisions(localPlayer, remotePlayer) {
    if (!this.ball || !localPlayer || !remotePlayer) {
      logger.warn("Cannot setup ball collisions - missing dependencies");
      return;
    }
    
    // Ball-local player collision
    this.scene.physics.add.collider(
      localPlayer.sprite,
      this.ball,
      (player, ball) => {
        this.handlePlayerCollision(localPlayer, ball, true);
      }
    );
    
    // Ball-remote player collision
    this.scene.physics.add.collider(
      remotePlayer.sprite,
      this.ball,
      (player, ball) => {
        this.handlePlayerCollision(remotePlayer, ball, false);
      }
    );
    
    logger.debug("Ball-player collisions configured");
  }
  
  handlePlayerCollision(player, ball, isLocal) {
    const now = Date.now();
    
    // Prevent rapid collisions
    if (now - this.lastCollisionTime < this.minCollisionDelay) {
      return;
    }
    
    this.lastCollisionTime = now;
    
    logger.debug("Ball-player collision", {
      player: player.name || "unknown",
      isLocal,
      authority: this.ballAuthority
    });
    
    // Update ball toucher
    this.gameState.setBallToucher(player);
    
    // Only ball authority handles physics
    if (this.ballAuthority) {
      this.processBallCollision(player, ball);
    }
    
    // Create visual effects
    this.effects?.createCollisionEffect(ball.x, ball.y);
    
    // Play collision sound
    this.playCollisionSound();
  }
  
  processBallCollision(player, ball) {
    if (!player.sprite || !ball.body) return;
    
    // Calculate collision direction
    const dx = ball.x - player.sprite.x;
    const dy = ball.y - player.sprite.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return;
    
    const normalX = dx / distance;
    const normalY = dy / distance;
    
    // Get player velocity for momentum transfer
    const playerVelX = player.sprite.body.velocity.x;
    const playerVelY = player.sprite.body.velocity.y;
    const playerSpeed = Math.sqrt(playerVelX * playerVelX + playerVelY * playerVelY);
    
    // Calculate kick power
    let kickPower = 300; // Base power
    
    // Add momentum from player movement
    kickPower += playerSpeed * 1.5;
    
    // Check if player is actively kicking
    if (player.isKicking) {
      kickPower *= 1.8; // Increase power for intentional kicks
      player.isKicking = false; // Reset kick state
    }
    
    // Apply enhanced physics
    this.applyEnhancedBallPhysics(ball, normalX, normalY, kickPower, playerVelX, playerVelY);
    
    // Separate ball from player
    const separationDistance = 35;
    ball.x += normalX * separationDistance;
    ball.y += normalY * separationDistance;
    
    logger.debug("Ball collision processed", {
      kickPower,
      direction: { x: normalX, y: normalY },
      playerVelocity: { x: playerVelX, y: playerVelY }
    });
  }
  
  applyEnhancedBallPhysics(ball, normalX, normalY, kickPower, playerVelX, playerVelY) {
    // Calculate base velocity
    let kickVelX = normalX * kickPower + playerVelX * 0.4;
    let kickVelY = normalY * kickPower + playerVelY * 0.4;
    
    // Add upward bias for more interesting gameplay
    if (kickVelY > -50) {
      kickVelY -= 150;
    }
    
    // Apply Magnus effect if configured
    if (GAME_CONFIG.BALL.MAGNUS_EFFECT) {
      const spin = this.calculateBallSpin(kickVelX, kickVelY);
      kickVelX += spin.x * GAME_CONFIG.BALL.MAGNUS_EFFECT;
      kickVelY += spin.y * GAME_CONFIG.BALL.MAGNUS_EFFECT;
    }
    
    // Apply velocity with limits
    const maxVel = GAME_CONFIG.BALL.MAX_VELOCITY;
    kickVelX = Math.max(-maxVel, Math.min(maxVel, kickVelX));
    kickVelY = Math.max(-maxVel, Math.min(maxVel, kickVelY));
    
    ball.body.setVelocity(kickVelX, kickVelY);
    
    // Store ball state for trail
    this.updateBallTrail(ball, kickVelX, kickVelY);
  }
  
  calculateBallSpin(velX, velY) {
    // Simple spin calculation based on velocity
    const speed = Math.sqrt(velX * velX + velY * velY);
    const spinFactor = GAME_CONFIG.BALL.SPIN_FACTOR || 0.1;
    
    return {
      x: -velY * spinFactor / speed,
      y: velX * spinFactor / speed
    };
  }
  
  // Player kick handling
  handlePlayerKick(player, ball) {
    if (!player.sprite || !ball) return;
    
    const distance = Phaser.Math.Distance.Between(
      player.sprite.x,
      player.sprite.y,
      ball.x,
      ball.y
    );
    
    if (distance < 120) {
      // Mark player as kicking for enhanced collision
      player.isKicking = true;
      
      // If close enough, trigger immediate collision
      if (distance < 60) {
        this.handlePlayerCollision(player, ball, player === this.scene.playerManager?.getLocalPlayer());
      }
      
      logger.debug("Player kick initiated", {
        player: player.name || "unknown",
        distance
      });
    }
  }
  
  // Goal handling
  handleGoal(scorer, goalZone) {
    if (!this.ballAuthority || this.gameState.goalCooldown > 0) return;
    
    logger.game("Goal detected", { scorer });
    
    // Send goal to server
    if (this.network) {
      this.network.scoreGoal(scorer);
    }
    
    // Update game state
    this.gameState.addGoal(scorer);
    
    // Create goal effects
    this.effects?.showGoalEffects(scorer, {
      ballPosition: { x: this.ball.x, y: this.ball.y },
      goalZone: goalZone
    });
    
    // Handle goal sequence
    this.handleGoalSequence({ scorer });
  }
  
  handleGoalSequence(data) {
    logger.debug("Handling goal sequence", data);
    
    // Pause ball physics temporarily
    if (this.ball && this.ball.body) {
      this.ball.body.setVelocity(0, 0);
    }
    
    // Goal celebration will be handled by effects manager
    this.effects?.animateGoal(data.scorer);
    
    // Reset after delay
    this.scene.time.delayedCall(3000, () => {
      this.resetBall();
    });
  }
  
  // Ball state synchronization
  sendBallState() {
    if (!this.ballAuthority || !this.network || !this.ball) return;
    
    const now = Date.now();
    if (now - this.lastBallStateSend < this.ballSyncThreshold) return;
    
    const ballData = {
      ball: {
        x: this.ball.x,
        y: this.ball.y,
        velocityX: this.ball.body ? this.ball.body.velocity.x : 0,
        velocityY: this.ball.body ? this.ball.body.velocity.y : 0,
        rotation: this.ball.rotation,
        timestamp: now
      }
    };
    
    this.network.sendBallState(ballData);
    this.lastBallStateSend = now;
    
    // Store in history for prediction
    this.storeBallState(ballData.ball);
  }
  
  handleRemoteBallState(data) {
    if (this.ballAuthority || !this.ball || !data.ball) return;
    
    logger.debug("Received remote ball state");
    
    // Use interpolation for smooth movement
    this.interpolateBallState(data.ball);
  }
  
  syncBallState(ballState) {
    if (this.ballAuthority || !this.ball) return;
    
    // Direct sync for comprehensive state updates
    this.ball.x = ballState.x;
    this.ball.y = ballState.y;
    
    if (this.ball.body) {
      this.ball.body.setVelocity(
        ballState.velocityX || 0,
        ballState.velocityY || 0
      );
    }
    
    if (ballState.rotation !== undefined) {
      this.ball.rotation = ballState.rotation;
    }
  }
  
  interpolateBallState(targetState) {
    // Calculate position difference for teleport detection
    const positionDiff = Math.sqrt(
      Math.pow(targetState.x - this.ball.x, 2) +
      Math.pow(targetState.y - this.ball.y, 2)
    );
    
    // If large difference, snap to position
    if (positionDiff > 150) {
      logger.debug("Large ball position difference - snapping", { diff: positionDiff });
      this.syncBallState(targetState);
      return;
    }
    
    // Smooth interpolation
    const lerpFactor = GAME_CONFIG.BALL.TRAJECTORY_SMOOTHING || 0.3;
    
    this.ball.x = Phaser.Math.Linear(this.ball.x, targetState.x, lerpFactor);
    this.ball.y = Phaser.Math.Linear(this.ball.y, targetState.y, lerpFactor);
    
    if (this.ball.body) {
      const currentVelX = this.ball.body.velocity.x;
      const currentVelY = this.ball.body.velocity.y;
      const newVelX = Phaser.Math.Linear(currentVelX, targetState.velocityX, lerpFactor);
      const newVelY = Phaser.Math.Linear(currentVelY, targetState.velocityY, lerpFactor);
      
      this.ball.body.setVelocity(newVelX, newVelY);
    }
  }
  
  storeBallState(ballState) {
    this.ballHistory.push({
      ...ballState,
      timestamp: Date.now()
    });
    
    // Limit history size
    if (this.ballHistory.length > this.maxBallHistory) {
      this.ballHistory.shift();
    }
  }
  
  // Ball trail system
  updateBallTrail(ball, velX, velY) {
    if (!GAME_CONFIG.BALL_TRAIL.ENABLED) return;
    
    const speed = Math.sqrt(velX * velX + velY * velY);
    
    // Only add trail points when moving fast enough
    if (speed > 100) {
      this.ballTrail.push({
        x: ball.x,
        y: ball.y,
        speed: speed,
        timestamp: Date.now()
      });
      
      // Limit trail length
      if (this.ballTrail.length > this.maxTrailPoints) {
        this.ballTrail.shift();
      }
      
      // Create visual trail
      this.effects?.createBallTrail(ball, { x: velX, y: velY }, speed);
    }
  }
  
  // Ball bounds checking
  checkBallBounds() {
    if (!this.ball) return;
    
    const bounds = {
      left: -100,
      right: GAME_CONFIG.CANVAS_WIDTH + 100,
      top: -50,
      bottom: GAME_CONFIG.CANVAS_HEIGHT + 100
    };
    
    // Check if ball is out of bounds
    if (this.ball.x < bounds.left || 
        this.ball.x > bounds.right || 
        this.ball.y > bounds.bottom) {
      
      logger.warn("Ball out of bounds - resetting", {
        position: { x: this.ball.x, y: this.ball.y },
        bounds
      });
      
      this.resetBall();
    }
  }
  
  // Ball prediction for AI and effects
  predictBallPosition(timeAhead) {
    if (!this.ball || !this.ball.body) return { x: this.ball.x, y: this.ball.y };
    
    const gravity = GAME_CONFIG.GRAVITY / 60; // Per frame
    const dragX = GAME_CONFIG.BALL.DRAG_X || 0.98;
    const dragY = GAME_CONFIG.BALL.DRAG_Y || 0.99;
    
    let x = this.ball.x;
    let y = this.ball.y;
    let vx = this.ball.body.velocity.x;
    let vy = this.ball.body.velocity.y;
    
    const frames = timeAhead * 60; // Convert to frames
    
    for (let i = 0; i < frames; i++) {
      x += vx / 60;
      y += vy / 60;
      
      vx *= dragX;
      vy = vy * dragY + gravity;
      
      // Simple boundary bounce prediction
      if (y > GAME_CONFIG.FIELD.GROUND_Y) {
        y = GAME_CONFIG.FIELD.GROUND_Y;
        vy = -vy * (GAME_CONFIG.BALL.BOUNCE || 0.7);
      }
      
      if (x < 0 || x > GAME_CONFIG.CANVAS_WIDTH) {
        vx = -vx * (GAME_CONFIG.BALL.BOUNCE || 0.7);
      }
    }
    
    return { x, y };
  }
  
  // Sound effects
  playCollisionSound() {
    // Play collision sound if available
    if (this.scene.sound && this.scene.sound.get) {
      try {
        // Attempt to play ball hit sound
        this.scene.sound.play('ballHit', { volume: 0.3 });
      } catch (error) {
        // Sound not available, continue silently
      }
    }
  }
  
  // Update loop
  update() {
    if (!this.ball) return;
    
    // Update ball trail
    if (this.ball.body) {
      this.updateBallTrail(
        this.ball,
        this.ball.body.velocity.x,
        this.ball.body.velocity.y
      );
    }
    
    // Send ball state if authority
    if (this.ballAuthority) {
      this.sendBallState();
    }
    
    // Check bounds
    this.checkBallBounds();
    
    // Decrease collision cooldown
    if (this.collisionCooldown > 0) {
      this.collisionCooldown--;
    }
    
    // Clean up old trail points
    this.cleanupBallTrail();
  }
  
  cleanupBallTrail() {
    const now = Date.now();
    const maxAge = 2000; // 2 seconds
    
    this.ballTrail = this.ballTrail.filter(point => 
      now - point.timestamp < maxAge
    );
  }
  
  // Debug methods
  getDebugInfo() {
    return {
      ballExists: !!this.ball,
      ballAuthority: this.ballAuthority,
      ballPosition: this.ball ? { x: this.ball.x, y: this.ball.y } : null,
      ballVelocity: this.ball?.body ? {
        x: this.ball.body.velocity.x,
        y: this.ball.body.velocity.y
      } : null,
      trailLength: this.ballTrail.length,
      historyLength: this.ballHistory.length,
      collisionCooldown: this.collisionCooldown,
      lastStateSend: this.lastBallStateSend
    };
  }
  
  // Cleanup
  cleanup() {
    logger.debug("BallManager cleanup");
    
    // Destroy ball
    if (this.ball) {
      this.ball.destroy();
      this.ball = null;
    }
    
    // Clear arrays
    this.ballTrail = [];
    this.ballHistory = [];
    this.interpolationBuffer = [];
    
    // Reset state
    this.network = null;
    this.ballAuthority = false;
    this.lastBallStateSend = 0;
    this.collisionCooldown = 0;
    this.lastCollisionTime = 0;
    
    logger.debug("BallManager cleanup complete");
  }
}