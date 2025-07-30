import { GAME_CONFIG } from "../config.js";
import { logger } from "../../lib/logger.js";

/**
 * PerformanceManager - Monitors and optimizes game performance
 */
export class PerformanceManager {
  constructor(scene) {
    this.scene = scene;
    
    // Performance metrics
    this.fps = 60;
    this.avgFps = 60;
    this.frameTime = 16.67; // ms
    this.lastFrameTime = 0;
    
    // Performance history
    this.fpsHistory = [];
    this.maxFpsHistory = 60; // Keep 1 second of history at 60fps
    
    // Memory tracking
    this.memoryUsage = {
      initial: 0,
      current: 0,
      peak: 0
    };
    
    // Quality settings
    this.currentQuality = "high";
    this.qualitySettings = {
      high: {
        particleMultiplier: 1.0,
        shadowsEnabled: true,
        trailsEnabled: true,
        maxEffects: 50,
        updateInterval: 16
      },
      medium: {
        particleMultiplier: 0.7,
        shadowsEnabled: true,
        trailsEnabled: true,
        maxEffects: 30,
        updateInterval: 20
      },
      low: {
        particleMultiplier: 0.4,
        shadowsEnabled: false,
        trailsEnabled: false,
        maxEffects: 15,
        updateInterval: 33
      }
    };
    
    // Performance thresholds
    this.thresholds = {
      highQuality: 55,
      mediumQuality: 40,
      lowQuality: 25,
      critical: 15
    };
    
    // Update intervals
    this.updateCounter = 0;
    this.metricsUpdateInterval = 60; // Every second at 60fps
    this.qualityCheckInterval = 300; // Every 5 seconds
    
    // Performance flags
    this.performanceWarningIssued = false;
    this.adaptiveQuality = true;
    
    logger.debug("PerformanceManager initialized");
  }
  
  // Initialization
  initialize() {
    this.measureInitialMemory();
    this.determineInitialQuality();
    this.setupPerformanceMonitoring();
    
    logger.debug("PerformanceManager setup complete", {
      initialQuality: this.currentQuality,
      initialMemory: this.memoryUsage.initial
    });
  }
  
  measureInitialMemory() {
    if (typeof window !== "undefined" && window.performance && window.performance.memory) {
      this.memoryUsage.initial = window.performance.memory.usedJSHeapSize;
      this.memoryUsage.current = this.memoryUsage.initial;
      this.memoryUsage.peak = this.memoryUsage.initial;
    }
  }
  
  determineInitialQuality() {
    // Check device capabilities
    const isHighEnd = this.detectHighEndDevice();
    const isMobile = this.detectMobileDevice();
    
    if (isHighEnd && !isMobile) {
      this.currentQuality = "high";
    } else if (isMobile) {
      this.currentQuality = "medium";
    } else {
      this.currentQuality = "low";
    }
    
    this.applyQualitySettings();
  }
  
  detectHighEndDevice() {
    if (typeof navigator === "undefined") return false;
    
    // Check hardware concurrency (CPU cores)
    const cores = navigator.hardwareConcurrency || 2;
    
    // Check memory
    const memory = navigator.deviceMemory || 4;
    
    // Check GPU
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const renderer = gl ? gl.getParameter(gl.RENDERER) : '';
    
    const isHighEndGPU = renderer.includes('NVIDIA') || 
                        renderer.includes('AMD Radeon') || 
                        renderer.includes('Intel Iris');
    
    return cores >= 4 && memory >= 8 && isHighEndGPU;
  }
  
  detectMobileDevice() {
    if (typeof navigator === "undefined") return false;
    
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  setupPerformanceMonitoring() {
    // Set up frame rate monitoring
    this.lastFrameTime = performance.now();
    
    // Set up performance observer if available
    if (typeof PerformanceObserver !== "undefined") {
      try {
        this.setupPerformanceObserver();
      } catch (error) {
        logger.warn("Performance Observer not available", { error: error.message });
      }
    }
  }
  
  setupPerformanceObserver() {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          this.handlePerformanceMeasure(entry);
        }
      }
    });
    
    observer.observe({ entryTypes: ['measure'] });
    this.performanceObserver = observer;
  }
  
  handlePerformanceMeasure(entry) {
    if (entry.duration > 16.67) { // Longer than 60fps frame
      logger.debug("Long frame detected", {
        name: entry.name,
        duration: entry.duration
      });
    }
  }
  
  // Performance measurement
  measureFrameRate() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    this.frameTime = deltaTime;
    this.fps = 1000 / deltaTime;
    
    // Add to history
    this.fpsHistory.push(this.fps);
    if (this.fpsHistory.length > this.maxFpsHistory) {
      this.fpsHistory.shift();
    }
    
    // Calculate average FPS
    this.avgFps = this.fpsHistory.reduce((sum, fps) => sum + fps, 0) / this.fpsHistory.length;
    
    this.lastFrameTime = currentTime;
  }
  
  measureMemoryUsage() {
    if (typeof window !== "undefined" && window.performance && window.performance.memory) {
      const memory = window.performance.memory;
      this.memoryUsage.current = memory.usedJSHeapSize;
      
      if (this.memoryUsage.current > this.memoryUsage.peak) {
        this.memoryUsage.peak = this.memoryUsage.current;
      }
    }
  }
  
  // Quality management
  checkAndAdjustQuality() {
    if (!this.adaptiveQuality) return;
    
    const oldQuality = this.currentQuality;
    let newQuality = this.currentQuality;
    
    // Determine quality based on average FPS
    if (this.avgFps >= this.thresholds.highQuality) {
      newQuality = "high";
    } else if (this.avgFps >= this.thresholds.mediumQuality) {
      newQuality = "medium";
    } else if (this.avgFps >= this.thresholds.lowQuality) {
      newQuality = "low";
    } else {
      // Critical performance - emergency measures
      this.handleCriticalPerformance();
      return;
    }
    
    // Only change if quality is different and change is significant
    if (newQuality !== oldQuality) {
      const shouldChange = this.shouldChangeQuality(oldQuality, newQuality);
      
      if (shouldChange) {
        this.setQuality(newQuality);
        logger.info("Quality adjusted automatically", {
          from: oldQuality,
          to: newQuality,
          avgFps: this.avgFps.toFixed(1)
        });
      }
    }
  }
  
  shouldChangeQuality(oldQuality, newQuality) {
    // Prevent rapid quality changes
    const now = Date.now();
    if (this.lastQualityChange && now - this.lastQualityChange < 5000) {
      return false;
    }
    
    // Require consistent performance for quality increases
    if (this.getQualityLevel(newQuality) > this.getQualityLevel(oldQuality)) {
      // Need 3+ seconds of good performance
      const goodFrameCount = this.fpsHistory.filter(fps => 
        fps >= this.thresholds[newQuality + "Quality"]
      ).length;
      
      return goodFrameCount >= 180; // 3 seconds at 60fps
    }
    
    // Quality decreases happen immediately
    return true;
  }
  
  getQualityLevel(quality) {
    const levels = { low: 0, medium: 1, high: 2 };
    return levels[quality] || 0;
  }
  
  setQuality(quality) {
    this.currentQuality = quality;
    this.lastQualityChange = Date.now();
    this.applyQualitySettings();
    
    // Notify other systems
    this.notifyQualityChange(quality);
  }
  
  applyQualitySettings() {
    const settings = this.qualitySettings[this.currentQuality];
    
    // Apply to game config
    if (GAME_CONFIG.PERFORMANCE) {
      GAME_CONFIG.PERFORMANCE.CURRENT_QUALITY = this.currentQuality;
      GAME_CONFIG.PERFORMANCE.PARTICLE_MULTIPLIER = settings.particleMultiplier;
      GAME_CONFIG.PERFORMANCE.MAX_EFFECTS = settings.maxEffects;
    }
    
    // Apply physics settings
    if (this.scene.physics && this.scene.physics.world) {
      const world = this.scene.physics.world;
      
      if (this.currentQuality === "low") {
        world.fps = 45; // Reduce physics FPS
      } else {
        world.fps = 60;
      }
    }
    
    logger.debug("Quality settings applied", {
      quality: this.currentQuality,
      settings
    });
  }
  
  notifyQualityChange(quality) {
    // Notify effects manager
    if (this.scene.effects && this.scene.effects.adjustQuality) {
      this.scene.effects.adjustQuality(this.avgFps);
    }
    
    // Notify other managers as needed
    if (this.scene.ballManager && this.scene.ballManager.adjustQuality) {
      this.scene.ballManager.adjustQuality(quality);
    }
  }
  
  handleCriticalPerformance() {
    if (this.performanceWarningIssued) return;
    
    this.performanceWarningIssued = true;
    
    logger.warn("Critical performance detected", {
      avgFps: this.avgFps.toFixed(1),
      currentQuality: this.currentQuality
    });
    
    // Emergency measures
    this.setQuality("low");
    this.disableNonEssentialFeatures();
    
    // Show warning to user
    if (this.scene.ui && this.scene.ui.showMessage) {
      this.scene.ui.showMessage(
        "Performance issues detected. Reducing quality to maintain smooth gameplay.",
        5000,
        "#ffaa00"
      );
    }
  }
  
  disableNonEssentialFeatures() {
    // Disable trails
    if (GAME_CONFIG.BALL_TRAIL) {
      GAME_CONFIG.BALL_TRAIL.ENABLED = false;
    }
    
    // Disable screen shake
    if (GAME_CONFIG.SCREEN_SHAKE) {
      GAME_CONFIG.SCREEN_SHAKE.ENABLED = false;
    }
    
    // Reduce particle effects
    if (GAME_CONFIG.PARTICLES) {
      Object.values(GAME_CONFIG.PARTICLES).forEach(particle => {
        if (particle.enabled !== undefined) {
          particle.enabled = false;
        }
      });
    }
    
    logger.info("Non-essential features disabled for performance");
  }
  
  // Performance optimization
  optimizeObjectPools() {
    // Cleanup unused objects in pools
    const objectPools = [
      this.scene.particlePool,
      this.scene.effectPool,
      this.scene.textPool
    ];
    
    objectPools.forEach(pool => {
      if (pool && pool.cleanup) {
        pool.cleanup();
      }
    });
  }
  
  optimizeTextures() {
    // Clear unused textures from memory
    if (this.scene.textures) {
      const textureManager = this.scene.textures;
      
      // Get list of unused textures
      const unusedTextures = this.findUnusedTextures();
      
      unusedTextures.forEach(key => {
        if (textureManager.exists(key)) {
          textureManager.remove(key);
          logger.debug("Removed unused texture", { key });
        }
      });
    }
  }
  
  findUnusedTextures() {
    // This would need to be implemented based on actual texture usage
    // For now, return empty array
    return [];
  }
  
  optimizeAudio() {
    // Stop and cleanup audio that's not being used
    if (this.scene.sound) {
      const soundManager = this.scene.sound;
      
      soundManager.getAllPlaying().forEach(sound => {
        if (sound.duration > 0 && sound.seek >= sound.duration - 0.1) {
          sound.destroy();
        }
      });
    }
  }
  
  // Memory management
  forceGarbageCollection() {
    // Request garbage collection if available
    if (typeof window !== "undefined" && window.gc) {
      try {
        window.gc();
        logger.debug("Manual garbage collection triggered");
      } catch (error) {
        // GC not available
      }
    }
  }
  
  checkMemoryUsage() {
    this.measureMemoryUsage();
    
    const memoryIncrease = this.memoryUsage.current - this.memoryUsage.initial;
    const memoryIncreasePercent = (memoryIncrease / this.memoryUsage.initial) * 100;
    
    // If memory usage has increased significantly, try to clean up
    if (memoryIncreasePercent > 50) {
      logger.warn("High memory usage detected", {
        initial: this.formatBytes(this.memoryUsage.initial),
        current: this.formatBytes(this.memoryUsage.current),
        increase: memoryIncreasePercent.toFixed(1) + "%"
      });
      
      this.performMemoryCleanup();
    }
  }
  
  performMemoryCleanup() {
    this.optimizeObjectPools();
    this.optimizeTextures();
    this.optimizeAudio();
    this.forceGarbageCollection();
    
    // Re-measure after cleanup
    setTimeout(() => {
      this.measureMemoryUsage();
      logger.info("Memory cleanup completed", {
        current: this.formatBytes(this.memoryUsage.current)
      });
    }, 1000);
  }
  
  formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
  
  // Performance monitoring
  startPerformanceMeasure(name) {
    if (typeof performance !== "undefined" && performance.mark) {
      performance.mark(`${name}-start`);
    }
  }
  
  endPerformanceMeasure(name) {
    if (typeof performance !== "undefined" && performance.mark && performance.measure) {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    }
  }
  
  // Update loop
  update() {
    this.updateCounter++;
    
    // Measure frame rate every frame
    this.measureFrameRate();
    
    // Update metrics periodically
    if (this.updateCounter % this.metricsUpdateInterval === 0) {
      this.measureMemoryUsage();
    }
    
    // Check quality periodically
    if (this.updateCounter % this.qualityCheckInterval === 0) {
      this.checkAndAdjustQuality();
      this.checkMemoryUsage();
    }
    
    // Reset counter to prevent overflow
    if (this.updateCounter >= 18000) { // 5 minutes at 60fps
      this.updateCounter = 0;
    }
  }
  
  // Debug and reporting
  getPerformanceReport() {
    return {
      fps: {
        current: this.fps.toFixed(1),
        average: this.avgFps.toFixed(1),
        min: Math.min(...this.fpsHistory).toFixed(1),
        max: Math.max(...this.fpsHistory).toFixed(1)
      },
      memory: {
        initial: this.formatBytes(this.memoryUsage.initial),
        current: this.formatBytes(this.memoryUsage.current),
        peak: this.formatBytes(this.memoryUsage.peak),
        increase: this.formatBytes(this.memoryUsage.current - this.memoryUsage.initial)
      },
      quality: {
        current: this.currentQuality,
        adaptive: this.adaptiveQuality,
        lastChange: this.lastQualityChange ? new Date(this.lastQualityChange).toISOString() : "none"
      },
      thresholds: this.thresholds
    };
  }
  
  // Settings
  setAdaptiveQuality(enabled) {
    this.adaptiveQuality = enabled;
    logger.info("Adaptive quality " + (enabled ? "enabled" : "disabled"));
  }
  
  forceQuality(quality) {
    if (this.qualitySettings[quality]) {
      this.setAdaptiveQuality(false);
      this.setQuality(quality);
      logger.info("Quality forced to " + quality);
    }
  }
  
  resetPerformanceWarning() {
    this.performanceWarningIssued = false;
  }
  
  // Cleanup
  cleanup() {
    logger.debug("PerformanceManager cleanup");
    
    // Stop performance observer
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
      this.performanceObserver = null;
    }
    
    // Clear histories
    this.fpsHistory = [];
    
    // Reset state
    this.updateCounter = 0;
    this.performanceWarningIssued = false;
    this.lastQualityChange = null;
    
    logger.debug("PerformanceManager cleanup complete");
  }
}