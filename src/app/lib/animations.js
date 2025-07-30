import { GAME_CONFIG } from '../components/config.js';
import { logger } from './logger.js';

/**
 * Enhanced Animation System for HeadBall Game
 * Provides smooth, performant animations and visual effects
 */
export class AnimationManager {
  constructor(scene) {
    this.scene = scene;
    this.activeAnimations = new Map();
    this.tweenChains = new Map();
    this.particleSystems = new Map();
    this.animationQueue = [];
    this.isProcessing = false;
    
    // Performance tracking
    this.frameCount = 0;
    this.lastPerformanceCheck = 0;
    this.animationBudget = 16; // ms per frame (60 FPS)
    
    logger.debug("Animation manager initialized");
  }

  /**
   * Create smooth player movement animation
   */
  animatePlayerMovement(player, targetX, targetY, duration = 200) {
    const animationId = `player_move_${player.playerKey}_${Date.now()}`;
    
    // Cancel existing movement animation for this player
    this.cancelAnimation(`player_move_${player.playerKey}`);
    
    const tween = this.scene.tweens.add({
      targets: player,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Power2.easeOut',
      onUpdate: () => {
        // Update physics body position
        if (player.body) {
          player.body.setPosition(player.x, player.y);
        }
      },
      onComplete: () => {
        this.activeAnimations.delete(animationId);
        logger.physics("Player movement animation completed", {
          player: player.playerKey,
          finalPosition: { x: player.x, y: player.y }
        });
      }
    });
    
    this.activeAnimations.set(animationId, tween);
    return tween;
  }

  /**
   * Animate player jump with arc trajectory
   */
  animatePlayerJump(player, jumpPower = 300, duration = 600) {
    const animationId = `player_jump_${player.playerKey}_${Date.now()}`;
    
    // Create jump arc animation
    const startY = player.y;
    const peakY = startY - jumpPower;
    
    const jumpTween = this.scene.tweens.chain({
      targets: player,
      tweens: [
        {
          y: peakY,
          duration: duration * 0.4,
          ease: 'Power2.easeOut'
        },
        {
          y: startY,
          duration: duration * 0.6,
          ease: 'Power2.easeIn'
        }
      ],
      onComplete: () => {
        this.activeAnimations.delete(animationId);
        // Add landing effect
        this.createLandingEffect(player.x, player.y);
      }
    });
    
    this.activeAnimations.set(animationId, jumpTween);
    return jumpTween;
  }

  /**
   * Animate ball with trail effect
   */
  animateBallMovement(ball, targetX, targetY, velocity, spin = 0) {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    // Create ball trail if speed is high enough
    if (speed > GAME_CONFIG.EFFECTS.BALL_TRAIL.MIN_SPEED && GAME_CONFIG.EFFECTS.BALL_TRAIL.ENABLED) {
      this.createBallTrail(ball, velocity, speed);
    }
    
    // Add spin rotation if ball has spin
    if (spin !== 0) {
      this.scene.tweens.add({
        targets: ball,
        rotation: ball.rotation + (spin * Math.PI * 2),
        duration: 1000,
        ease: 'None',
        repeat: -1
      });
    }
    
    // Smooth ball interpolation for network sync
    const duration = 100; // Short duration for responsiveness
    const ballTween = this.scene.tweens.add({
      targets: ball,
      x: targetX,
      y: targetY,
      duration: duration,
      ease: 'Power1.easeOut',
      onUpdate: () => {
        if (ball.body) {
          ball.body.setPosition(ball.x, ball.y);
        }
      }
    });
    
    return ballTween;
  }

  /**
   * Create goal celebration animation
   */
  animateGoal(scoringPlayer, goalSide) {
    logger.game("Creating goal celebration animation", { player: scoringPlayer, side: goalSide });
    
    // Screen shake effect
    this.createScreenShake(GAME_CONFIG.EFFECTS.SCREEN_SHAKE.GOAL_INTENSITY, 
                          GAME_CONFIG.EFFECTS.SCREEN_SHAKE.GOAL_DURATION);
    
    // Goal flash effect
    this.createGoalFlash();
    
    // Particle explosion
    const goalX = goalSide === 'left' ? 100 : GAME_CONFIG.CANVAS_WIDTH - 100;
    const goalY = GAME_CONFIG.FIELD.GROUND_Y - 200;
    this.createGoalExplosion(goalX, goalY);
    
    // Player celebration animation
    if (scoringPlayer) {
      this.animatePlayerCelebration(scoringPlayer);
    }
    
    // Goal text animation
    this.animateGoalText();
  }

  /**
   * Create player celebration animation
   */
  animatePlayerCelebration(player) {
    // Jump celebration
    const celebrationTween = this.scene.tweens.add({
      targets: player,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      ease: 'Back.easeOut',
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        player.setScale(1);
      }
    });
    
    // Add sparkle effect around player
    this.createSparkleEffect(player.x, player.y - 50);
    
    return celebrationTween;
  }

  /**
   * Create screen shake effect
   */
  createScreenShake(intensity = 5, duration = 300) {
    if (!GAME_CONFIG.ACCESSIBILITY.REDUCED_MOTION) {
      const camera = this.scene.cameras.main;
      
      this.scene.tweens.add({
        targets: camera,
        x: { from: 0, to: intensity },
        duration: 50,
        ease: 'Power2.easeInOut',
        yoyo: true,
        repeat: Math.floor(duration / 100),
        onComplete: () => {
          camera.setPosition(0, 0);
        }
      });
    }
  }

  /**
   * Create goal flash effect
   */
  createGoalFlash() {
    const flashRect = this.scene.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT,
      GAME_CONFIG.EFFECTS.GOAL_FLASH.COLOR,
      GAME_CONFIG.EFFECTS.GOAL_FLASH.ALPHA
    );
    
    flashRect.setDepth(1000); // Ensure it's on top
    
    this.scene.tweens.add({
      targets: flashRect,
      alpha: 0,
      duration: GAME_CONFIG.EFFECTS.GOAL_FLASH.DURATION,
      ease: 'Power2.easeOut',
      onComplete: () => {
        flashRect.destroy();
      }
    });
  }

  /**
   * Create goal explosion particle effect
   */
  createGoalExplosion(x, y) {
    if (!GAME_CONFIG.EFFECTS.PARTICLES.ENABLED) return;
    
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 100, max: 300 },
      scale: { start: 0.5, end: 0 },
      lifespan: 1000,
      quantity: GAME_CONFIG.EFFECTS.PARTICLES.GOAL_EXPLOSION.COUNT,
      tint: GAME_CONFIG.EFFECTS.PARTICLES.GOAL_EXPLOSION.COLORS,
      blendMode: 'ADD'
    });
    
    // Auto-destroy after animation
    this.scene.time.delayedCall(1500, () => {
      particles.destroy();
    });
    
    return particles;
  }

  /**
   * Create ball trail effect
   */
  createBallTrail(ball, velocity, speed) {
    const trailLength = Math.min(GAME_CONFIG.EFFECTS.BALL_TRAIL.TRAIL_LENGTH, speed / 20);
    const trailColor = GAME_CONFIG.EFFECTS.BALL_TRAIL.COLOR_VARIATION ? 
                      this.getSpeedBasedColor(speed) : 0xffffff;
    
    // Create trail particles
    for (let i = 0; i < trailLength; i++) {
      const delay = i * 16; // 60 FPS spacing
      const alpha = 1 - (i / trailLength);
      
      this.scene.time.delayedCall(delay, () => {
        const trailDot = this.scene.add.circle(
          ball.x - (velocity.x * i * 0.1),
          ball.y - (velocity.y * i * 0.1),
          GAME_CONFIG.EFFECTS.BALL_TRAIL.PARTICLE_SIZE,
          trailColor,
          alpha * GAME_CONFIG.EFFECTS.BALL_TRAIL.ALPHA_DECAY
        );
        
        // Fade out trail dot
        this.scene.tweens.add({
          targets: trailDot,
          alpha: 0,
          duration: 200,
          onComplete: () => trailDot.destroy()
        });
      });
    }
  }

  /**
   * Create sparkle effect for celebrations
   */
  createSparkleEffect(x, y) {
    if (!GAME_CONFIG.EFFECTS.PARTICLES.ENABLED) return;
    
    const sparkles = this.scene.add.particles(x, y, 'sparkle', {
      speed: { min: 50, max: 150 },
      scale: { start: 0.3, end: 0 },
      lifespan: 800,
      quantity: 15,
      tint: [0xffff00, 0xffffff, 0xff8800],
      blendMode: 'ADD',
      emitZone: { source: new Phaser.Geom.Circle(0, 0, 30) }
    });
    
    this.scene.time.delayedCall(1000, () => {
      sparkles.destroy();
    });
  }

  /**
   * Create landing effect when player hits ground
   */
  createLandingEffect(x, y) {
    if (!GAME_CONFIG.EFFECTS.PARTICLES.ENABLED) return;
    
    // Small dust cloud effect
    const dust = this.scene.add.particles(x, y, 'dust', {
      speed: { min: 20, max: 80 },
      scale: { start: 0.2, end: 0 },
      lifespan: 300,
      quantity: 8,
      tint: 0x8B4513, // Brown dust color
      gravityY: 50
    });
    
    this.scene.time.delayedCall(400, () => {
      dust.destroy();
    });
  }

  /**
   * Animate goal text display
   */
  animateGoalText() {
    const goalText = this.scene.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      'GOAL!',
      {
        fontSize: GAME_CONFIG.UI.FONT_SIZES.GOAL_EFFECT,
        fill: '#FFD700',
        stroke: '#000000',
        strokeThickness: 4,
        fontFamily: 'Arial Black'
      }
    ).setOrigin(0.5).setDepth(1000);
    
    // Animate text appearance
    goalText.setScale(0);
    
    this.scene.tweens.add({
      targets: goalText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hold for a moment then fade out
        this.scene.tweens.add({
          targets: goalText,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 500,
          delay: 1000,
          ease: 'Power2.easeIn',
          onComplete: () => {
            goalText.destroy();
          }
        });
      }
    });
  }

  /**
   * Animate power-up collection
   */
  animatePowerUpCollection(powerup, player) {
    // Power-up collect effect
    const collectTween = this.scene.tweens.add({
      targets: powerup,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 300,
      ease: 'Power2.easeOut',
      onComplete: () => {
        powerup.destroy();
      }
    });
    
    // Player power-up glow effect
    this.createPowerUpGlow(player);
    
    // Floating text showing power-up type
    this.createFloatingText(player.x, player.y - 100, powerup.type, {
      fontSize: '24px',
      fill: '#00FF00',
      duration: 2000
    });
    
    return collectTween;
  }

  /**
   * Create power-up glow effect on player
   */
  createPowerUpGlow(player) {
    if (!GAME_CONFIG.EFFECTS.PARTICLES.POWERUP_GLOW.ENABLED) return;
    
    const glow = this.scene.add.circle(
      player.x, 
      player.y, 
      player.width * 0.8, 
      0x00FF00, 
      0.3
    );
    
    glow.setDepth(player.depth - 1);
    
    // Pulsing glow animation
    this.scene.tweens.add({
      targets: glow,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0.6,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 11, // 6 seconds total
      onComplete: () => {
        glow.destroy();
      }
    });
    
    // Follow player
    const glowUpdate = () => {
      if (glow.active) {
        glow.setPosition(player.x, player.y);
      }
    };
    
    this.scene.events.on('update', glowUpdate);
    
    this.scene.time.delayedCall(6000, () => {
      this.scene.events.off('update', glowUpdate);
    });
  }

  /**
   * Create floating text animation
   */
  createFloatingText(x, y, text, options = {}) {
    const defaultOptions = {
      fontSize: '20px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2,
      duration: 1500,
      distance: 80
    };
    
    const config = { ...defaultOptions, ...options };
    
    const floatingText = this.scene.add.text(x, y, text, {
      fontSize: config.fontSize,
      fill: config.fill,
      stroke: config.stroke,
      strokeThickness: config.strokeThickness,
      fontFamily: 'Arial'
    }).setOrigin(0.5).setDepth(1000);
    
    // Animate upward float and fade
    this.scene.tweens.add({
      targets: floatingText,
      y: y - config.distance,
      alpha: 0,
      duration: config.duration,
      ease: 'Power2.easeOut',
      onComplete: () => {
        floatingText.destroy();
      }
    });
    
    return floatingText;
  }

  /**
   * Get color based on ball speed for trail effect
   */
  getSpeedBasedColor(speed) {
    const normalizedSpeed = Math.min(speed / GAME_CONFIG.BALL.MAX_VELOCITY, 1);
    
    if (normalizedSpeed < 0.3) return 0x88ff88; // Green for slow
    if (normalizedSpeed < 0.6) return 0xffff88; // Yellow for medium
    if (normalizedSpeed < 0.8) return 0xff8888; // Orange for fast
    return 0xff4444; // Red for very fast
  }

  /**
   * Cancel specific animation
   */
  cancelAnimation(animationId) {
    const animation = this.activeAnimations.get(animationId);
    if (animation) {
      animation.stop();
      this.activeAnimations.delete(animationId);
    }
  }

  /**
   * Cancel all animations for cleanup
   */
  cancelAllAnimations() {
    for (const [id, animation] of this.activeAnimations) {
      animation.stop();
    }
    this.activeAnimations.clear();
    
    // Clear particle systems
    for (const [id, particles] of this.particleSystems) {
      particles.destroy();
    }
    this.particleSystems.clear();
    
    logger.debug("All animations cancelled");
  }

  /**
   * Update animation performance tracking
   */
  updatePerformanceTracking() {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastPerformanceCheck > 1000) { // Check every second
      const fps = this.frameCount;
      this.frameCount = 0;
      this.lastPerformanceCheck = now;
      
      // Adjust quality based on performance
      if (fps < 45 && GAME_CONFIG.EFFECTS.PARTICLES.ENABLED) {
        logger.warn("Low FPS detected, reducing particle effects");
        GAME_CONFIG.EFFECTS.PARTICLES.ENABLED = false;
      } else if (fps > 55 && !GAME_CONFIG.EFFECTS.PARTICLES.ENABLED) {
        logger.info("Good FPS, re-enabling particle effects");
        GAME_CONFIG.EFFECTS.PARTICLES.ENABLED = true;
      }
    }
  }

  /**
   * Destroy animation manager
   */
  destroy() {
    this.cancelAllAnimations();
    this.scene = null;
    logger.debug("Animation manager destroyed");
  }
}

// Utility functions for easing and interpolation
export const AnimationUtils = {
  // Smooth interpolation between two values
  lerp: (start, end, factor) => {
    return start + (end - start) * factor;
  },
  
  // Smooth interpolation with easing
  smoothStep: (start, end, factor) => {
    const t = factor * factor * (3 - 2 * factor);
    return start + (end - start) * t;
  },
  
  // Bounce easing function
  easeOutBounce: (t) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  },
  
  // Elastic easing function
  easeOutElastic: (t) => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
  }
};