import { GAME_CONFIG } from "../config.js";
import { logger } from "../../lib/logger.js";

/**
 * EffectsManager - Manages all visual effects and animations
 */
export class EffectsManager {
  constructor(scene, animations) {
    this.scene = scene;
    this.animations = animations;
    
    // Effect pools for performance
    this.particlePools = new Map();
    this.textPools = new Map();
    this.effectGroups = new Map();
    
    // Active effects tracking
    this.activeEffects = [];
    this.maxActiveEffects = 50;
    
    // Screen effects
    this.screenShakeActive = false;
    this.backgroundEffects = [];
    
    // Performance settings
    this.qualityLevel = "high";
    this.particleCount = 1.0; // Multiplier
    
    logger.debug("EffectsManager initialized");
  }
  
  // Initialization
  initialize() {
    this.setupParticlePools();
    this.setupEffectGroups();
    this.determineQualityLevel();
    
    logger.debug("EffectsManager setup complete");
  }
  
  setupParticlePools() {
    // Create particle pools for different effect types
    this.createParticlePool("sparkle", 30);
    this.createParticlePool("explosion", 50);
    this.createParticlePool("trail", 100);
    this.createParticlePool("dust", 20);
    this.createParticlePool("glow", 10);
  }
  
  createParticlePool(type, size) {
    const pool = [];
    
    for (let i = 0; i < size; i++) {
      const particle = this.scene.add.circle(0, 0, 2, 0xffffff)
        .setVisible(false)
        .setDepth(1000);
      pool.push(particle);
    }
    
    this.particlePools.set(type, pool);
    logger.debug(`Created particle pool for ${type}`, { size });
  }
  
  setupEffectGroups() {
    this.effectGroups.set("particles", this.scene.add.group());
    this.effectGroups.set("ui", this.scene.add.group());
    this.effectGroups.set("background", this.scene.add.group());
    this.effectGroups.set("foreground", this.scene.add.group());
  }
  
  determineQualityLevel() {
    // Determine quality based on performance
    const fps = this.scene.game.loop?.actualFps || 60;
    
    if (fps >= 55) {
      this.qualityLevel = "high";
      this.particleCount = 1.0;
    } else if (fps >= 40) {
      this.qualityLevel = "medium";
      this.particleCount = 0.7;
    } else {
      this.qualityLevel = "low";
      this.particleCount = 0.4;
    }
    
    logger.debug("Quality level determined", { 
      level: this.qualityLevel, 
      particleCount: this.particleCount,
      fps 
    });
  }
  
  // Particle management
  getParticleFromPool(type) {
    const pool = this.particlePools.get(type);
    if (!pool) return null;
    
    // Find first inactive particle
    for (let particle of pool) {
      if (!particle.visible) {
        return particle;
      }
    }
    
    // If none available, reuse oldest
    return pool[0];
  }
  
  releaseParticle(particle) {
    if (particle && particle.active) {
      particle.setVisible(false);
      particle.setPosition(0, 0);
      particle.setAlpha(1);
      particle.setScale(1);
      
      // Stop any active tweens
      this.scene.tweens.killTweensOf(particle);
    }
  }
  
  // Goal effects
  showGoalEffects(scorer, data) {
    logger.debug("Showing goal effects", { scorer });
    
    if (data.ballPosition) {
      this.createGoalExplosion(data.ballPosition.x, data.ballPosition.y);
    }
    
    this.createScreenShake(8, 500);
    this.createGoalFlash();
    this.animateGoal(scorer);
    
    // Create floating text
    this.createFloatingText(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2 - 100,
      "GOAL!",
      {
        fontSize: 64,
        color: "#fde047",
        duration: 3000,
        bounce: true
      }
    );
  }
  
  createGoalExplosion(x, y) {
    const particleCount = Math.floor(20 * this.particleCount);
    const colors = [0xfde047, 0xfbbf24, 0xf59e0b, 0xd97706];
    
    for (let i = 0; i < particleCount; i++) {
      const particle = this.getParticleFromPool("explosion");
      if (!particle) continue;
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      const size = Phaser.Math.Between(3, 8);
      const angle = (i / particleCount) * Math.PI * 2;
      const speed = Phaser.Math.Between(100, 300);
      const distance = Phaser.Math.Between(50, 150);
      
      particle
        .setPosition(x, y)
        .setFillStyle(color)
        .setDisplaySize(size, size)
        .setVisible(true)
        .setAlpha(1)
        .setDepth(2000);
      
      // Animate explosion
      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: 800,
        ease: "Power2",
        onComplete: () => this.releaseParticle(particle)
      });
    }
    
    // Add sparkle effect
    this.createSparkleEffect(x, y, particleCount / 2);
  }
  
  createGoalFlash() {
    const flash = this.scene.add.rectangle(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      GAME_CONFIG.CANVAS_WIDTH,
      GAME_CONFIG.CANVAS_HEIGHT,
      0xffffff,
      0.6
    )
    .setDepth(5000);
    
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      ease: "Power2",
      onComplete: () => flash.destroy()
    });
  }
  
  animateGoal(scorer) {
    // Player celebration animation would go here
    logger.debug("Animating goal celebration", { scorer });
  }
  
  // Ball effects
  createBallTrail(ball, velocity, speed) {
    if (!GAME_CONFIG.BALL_TRAIL.ENABLED || this.qualityLevel === "low") return;
    
    const particle = this.getParticleFromPool("trail");
    if (!particle) return;
    
    const color = this.getSpeedBasedColor(speed);
    const size = Math.max(2, Math.min(6, speed / 100));
    
    particle
      .setPosition(ball.x, ball.y)
      .setFillStyle(color)
      .setDisplaySize(size, size)
      .setVisible(true)
      .setAlpha(0.8)
      .setDepth(500);
    
    // Animate trail fade
    this.scene.tweens.add({
      targets: particle,
      alpha: 0,
      scale: 0.3,
      duration: 300,
      ease: "Power2",
      onComplete: () => this.releaseParticle(particle)
    });
  }
  
  getSpeedBasedColor(speed) {
    if (speed > 400) return 0xff4444; // Red for very fast
    if (speed > 200) return 0xfde047; // Yellow for fast
    return 0xffffff; // White for normal
  }
  
  // Collision effects
  createCollisionEffect(x, y) {
    this.createSparkleEffect(x, y, 5);
    
    if (this.qualityLevel !== "low") {
      this.createImpactRipple(x, y);
    }
  }
  
  createImpactRipple(x, y) {
    const ripple = this.scene.add.circle(x, y, 5, 0xffffff, 0.3)
      .setStrokeStyle(2, 0xfde047)
      .setDepth(1500);
    
    this.scene.tweens.add({
      targets: ripple,
      radius: 40,
      alpha: 0,
      duration: 300,
      ease: "Power2",
      onComplete: () => ripple.destroy()
    });
  }
  
  // Sparkle effects
  createSparkleEffect(x, y, count = 8) {
    const sparkleCount = Math.floor(count * this.particleCount);
    
    for (let i = 0; i < sparkleCount; i++) {
      const particle = this.getParticleFromPool("sparkle");
      if (!particle) continue;
      
      const offsetX = Phaser.Math.Between(-20, 20);
      const offsetY = Phaser.Math.Between(-20, 20);
      const size = Phaser.Math.Between(2, 5);
      
      particle
        .setPosition(x + offsetX, y + offsetY)
        .setFillStyle(0xfde047)
        .setDisplaySize(size, size)
        .setVisible(true)
        .setAlpha(1)
        .setDepth(1800);
      
      // Animate sparkle
      this.scene.tweens.add({
        targets: particle,
        y: particle.y - 30,
        alpha: 0,
        scale: 0.2,
        duration: 600,
        ease: "Power2",
        onComplete: () => this.releaseParticle(particle)
      });
    }
  }
  
  // Landing effects
  createLandingEffect(x, y) {
    const dustCount = Math.floor(6 * this.particleCount);
    
    for (let i = 0; i < dustCount; i++) {
      const particle = this.getParticleFromPool("dust");
      if (!particle) continue;
      
      const offsetX = Phaser.Math.Between(-15, 15);
      const size = Phaser.Math.Between(1, 3);
      
      particle
        .setPosition(x + offsetX, y)
        .setFillStyle(0x8b7355)
        .setDisplaySize(size, size)
        .setVisible(true)
        .setAlpha(0.6)
        .setDepth(400);
      
      this.scene.tweens.add({
        targets: particle,
        y: particle.y + 10,
        x: particle.x + Phaser.Math.Between(-10, 10),
        alpha: 0,
        duration: 500,
        ease: "Power2",
        onComplete: () => this.releaseParticle(particle)
      });
    }
  }
  
  // Screen effects
  createScreenShake(intensity = 5, duration = 300) {
    if (this.screenShakeActive || !GAME_CONFIG.SCREEN_SHAKE.ENABLED) return;
    
    this.screenShakeActive = true;
    
    const camera = this.scene.cameras.main;
    const originalX = camera.scrollX;
    const originalY = camera.scrollY;
    
    // Create shake effect
    this.scene.tweens.add({
      targets: camera,
      scrollX: originalX + Phaser.Math.Between(-intensity, intensity),
      scrollY: originalY + Phaser.Math.Between(-intensity, intensity),
      duration: 50,
      yoyo: true,
      repeat: Math.floor(duration / 100),
      ease: "Power2",
      onComplete: () => {
        camera.setScroll(originalX, originalY);
        this.screenShakeActive = false;
      }
    });
  }
  
  // Text effects
  createFloatingText(x, y, text, options = {}) {
    const config = {
      fontSize: options.fontSize || 24,
      color: options.color || "#ffffff",
      duration: options.duration || 2000,
      distance: options.distance || 60,
      bounce: options.bounce || false,
      ...options
    };
    
    const textObj = this.scene.add.text(x, y, text, {
      fontFamily: '"Press Start 2P"',
      fontSize: config.fontSize + "px",
      fill: config.color,
      stroke: "#000000",
      strokeThickness: 3,
      align: "center"
    })
    .setOrigin(0.5)
    .setDepth(3000)
    .setAlpha(0);
    
    // Animate text in
    this.scene.tweens.add({
      targets: textObj,
      alpha: 1,
      y: y - config.distance,
      duration: config.duration,
      ease: config.bounce ? "Bounce.easeOut" : "Power2",
      onComplete: () => {
        // Fade out
        this.scene.tweens.add({
          targets: textObj,
          alpha: 0,
          duration: 500,
          onComplete: () => textObj.destroy()
        });
      }
    });
    
    return textObj;
  }
  
  // Timer warning effects
  showTimerWarning(message, color = "#ffaa00", duration = 1500) {
    const warningText = this.scene.add.text(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2 - 100,
      message,
      {
        fontFamily: '"Press Start 2P"',
        fontSize: "32px",
        fill: color,
        stroke: "#000000",
        strokeThickness: 4,
        align: "center"
      }
    )
    .setOrigin(0.5)
    .setDepth(5000);
    
    // Animate warning
    this.scene.tweens.add({
      targets: warningText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      yoyo: true,
      repeat: 2,
      ease: "Power2"
    });
    
    // Auto remove
    this.scene.time.delayedCall(duration, () => {
      this.scene.tweens.add({
        targets: warningText,
        alpha: 0,
        duration: 500,
        onComplete: () => warningText.destroy()
      });
    });
  }
  
  // Power-up effects
  createPowerUpGlow(player) {
    if (!player.sprite) return;
    
    const glow = this.scene.add.circle(
      player.sprite.x,
      player.sprite.y,
      40,
      0xfde047,
      0.3
    )
    .setDepth(player.sprite.depth - 1);
    
    // Follow player
    const followTween = this.scene.tweens.add({
      targets: glow,
      x: player.sprite.x,
      y: player.sprite.y,
      duration: 100,
      repeat: -1,
      onUpdate: () => {
        if (player.sprite) {
          glow.setPosition(player.sprite.x, player.sprite.y);
        }
      }
    });
    
    // Pulse effect
    this.scene.tweens.add({
      targets: glow,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    
    // Remove after power-up duration
    this.scene.time.delayedCall(GAME_CONFIG.POWERUPS.DURATION || 5000, () => {
      followTween.destroy();
      this.scene.tweens.add({
        targets: glow,
        alpha: 0,
        duration: 500,
        onComplete: () => glow.destroy()
      });
    });
  }
  
  // Game start effects
  startGameEffects() {
    logger.debug("Starting game effects");
    
    if (this.qualityLevel === "high") {
      this.createAmbientParticles();
    }
  }
  
  createAmbientParticles() {
    // Subtle background particles for atmosphere
    const particleCount = 10;
    
    for (let i = 0; i < particleCount; i++) {
      this.scene.time.delayedCall(i * 500, () => {
        this.createAmbientParticle();
      });
    }
    
    // Continue creating particles periodically
    this.ambientParticleTimer = this.scene.time.addEvent({
      delay: 3000,
      callback: this.createAmbientParticle,
      callbackScope: this,
      loop: true
    });
  }
  
  createAmbientParticle() {
    if (this.qualityLevel === "low") return;
    
    const x = Phaser.Math.Between(0, GAME_CONFIG.CANVAS_WIDTH);
    const y = Phaser.Math.Between(0, GAME_CONFIG.CANVAS_HEIGHT / 2);
    
    const particle = this.scene.add.circle(x, y, 1, 0xffffff, 0.3)
      .setDepth(50);
    
    this.scene.tweens.add({
      targets: particle,
      y: y + 200,
      alpha: 0,
      duration: 8000,
      ease: "Linear",
      onComplete: () => particle.destroy()
    });
  }
  
  // Effect management
  addActiveEffect(effect) {
    this.activeEffects.push(effect);
    
    // Limit active effects for performance
    if (this.activeEffects.length > this.maxActiveEffects) {
      const oldEffect = this.activeEffects.shift();
      if (oldEffect && oldEffect.destroy) {
        oldEffect.destroy();
      }
    }
  }
  
  cleanupEffects() {
    // Clean up old effects
    this.activeEffects = this.activeEffects.filter(effect => {
      if (!effect.active) {
        return false;
      }
      return true;
    });
  }
  
  // Quality adjustment
  adjustQuality(fps) {
    const oldLevel = this.qualityLevel;
    this.determineQualityLevel();
    
    if (oldLevel !== this.qualityLevel) {
      logger.info("Effect quality adjusted", {
        from: oldLevel,
        to: this.qualityLevel,
        fps
      });
    }
  }
  
  // Update loop
  update() {
    // Clean up old effects periodically
    if (this.scene.game.loop.frame % 120 === 0) { // Every 2 seconds at 60fps
      this.cleanupEffects();
    }
    
    // Adjust quality based on performance
    if (this.scene.game.loop.frame % 300 === 0) { // Every 5 seconds
      const fps = this.scene.game.loop.actualFps || 60;
      this.adjustQuality(fps);
    }
  }
  
  // Cleanup
  cleanup() {
    logger.debug("EffectsManager cleanup");
    
    // Clean up particle pools
    this.particlePools.forEach((pool, type) => {
      pool.forEach(particle => {
        if (particle.active) {
          particle.destroy();
        }
      });
    });
    this.particlePools.clear();
    
    // Clean up effect groups
    this.effectGroups.forEach((group, name) => {
      group.clear(true, true);
    });
    this.effectGroups.clear();
    
    // Clean up active effects
    this.activeEffects.forEach(effect => {
      if (effect.active) {
        effect.destroy();
      }
    });
    this.activeEffects = [];
    
    // Stop ambient particle timer
    if (this.ambientParticleTimer) {
      this.ambientParticleTimer.destroy();
      this.ambientParticleTimer = null;
    }
    
    // Reset state
    this.screenShakeActive = false;
    this.backgroundEffects = [];
    
    logger.debug("EffectsManager cleanup complete");
  }
}