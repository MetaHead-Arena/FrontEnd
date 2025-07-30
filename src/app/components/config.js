// Enhanced Game Configuration and Constants
export const GAME_CONFIG = {
  // Canvas settings with responsive support
  CANVAS_WIDTH: 1536,
  CANVAS_HEIGHT: 1024,
  
  // Responsive breakpoints
  BREAKPOINTS: {
    MOBILE: 768,
    TABLET: 1024,
    DESKTOP: 1536,
  },

  // Game timing with improved precision
  GAME_DURATION: 60, // seconds
  GOAL_COOLDOWN: 120, // frames (2 seconds at 60 FPS)
  GOAL_PAUSE_DURATION: 1000, // milliseconds
  FRAME_RATE: 60, // Target FPS
  PHYSICS_TIMESTEP: 1/60, // Fixed timestep for physics

  // Enhanced Physics with more realistic values
  GRAVITY: 800, // Increased for more realistic feel
  AIR_RESISTANCE: 0.98, // Air resistance factor
  GROUND_FRICTION: 0.85, // Ground friction coefficient
  WALL_BOUNCE_DAMPING: 0.7, // Energy loss on wall collision
  
  // Collision detection improvements
  COLLISION: {
    ENABLED: true,
    CONTINUOUS: true, // Use continuous collision detection
    PRECISION: 4, // Collision detection steps per frame
    SEPARATION_ITERATIONS: 3, // Iterations for separation resolution
    VELOCITY_THRESHOLD: 10, // Minimum velocity for collision response
  },

  // Player settings with enhanced physics
  PLAYER: {
    WIDTH: 120,
    HEIGHT: 140,
    RADIUS: 60, // Collision radius (circular collision)
    BASE_SPEED: 200, // Increased for more responsive movement
    MAX_SPEED: 400, // Maximum horizontal speed
    BASE_JUMP_VELOCITY: -350, // Stronger jump
    DOUBLE_JUMP_VELOCITY: -250, // Double jump power
    BASE_KICK_POWER: 200,
    BASE_SHOOT_POWER: 400,
    BOUNCE: 0.1,
    DRAG_X: 1000, // Increased air drag
    GROUND_DRAG: 1200, // Ground drag when moving
    SHOOT_COOLDOWN: 500, // Reduced cooldown for faster gameplay
    
    // Movement physics
    ACCELERATION: 1500, // Horizontal acceleration
    DECELERATION: 1800, // Deceleration when not moving
    AIR_CONTROL: 0.6, // Air movement control factor
    COYOTE_TIME: 100, // Milliseconds of jump grace period
    JUMP_BUFFER: 150, // Milliseconds of jump input buffering
    
    STARTING_POSITIONS: {
      PLAYER1: { x: 300, y: 650 }, // Adjusted for better positioning
      PLAYER2: { x: 1200, y: 650 },
    },
    
    BG_IMAGES: {
      PLAYER1: "/head-1.png",
      PLAYER2: "/head-2.png",
    },
    
    ATTRIBUTES: {
      PLAYER1: {
        speed: 2.2, // Slightly increased
        jumpHeight: 1.4, // Better jump
        size: 1.0,
        kickPower: 1.2,
        shootPower: 1.1,
        name: "Player 1",
        color: 0x1976d2,
      },
      PLAYER2: {
        speed: 2.2,
        jumpHeight: 1.4,
        size: 1.0,
        kickPower: 1.2,
        shootPower: 1.1,
        name: "Player 2",
        color: 0xd32f2f,
      },
    },

    DEFAULT_ATTRIBUTES: {
      speed: 1.0,
      jumpHeight: 1.0,
      size: 1.0,
      kickPower: 1.0,
      shootPower: 1.0,
    },
  },

  // Enhanced Visual effects configuration
  EFFECTS: {
    BALL_TRAIL: {
      ENABLED: true, // Enable for better visual feedback
      MIN_SPEED: 150, // Lower threshold for trail
      TRAIL_LENGTH: 12, // Longer trail
      ALPHA_DECAY: 0.85,
      PARTICLE_SIZE: 8,
      COLOR_VARIATION: true, // Trail color based on speed
    },
    
    SCREEN_SHAKE: {
      GOAL_INTENSITY: 8, // Moderate shake on goal
      GOAL_DURATION: 300, // Shorter duration
      COLLISION_INTENSITY: 3, // Shake on strong collisions
      KICK_INTENSITY: 2, // Shake on kicks
    },
    
    GOAL_FLASH: {
      DURATION: 400, // Shorter flash
      COLOR: 0xffffff,
      ALPHA: 0.7,
    },
    
    PARTICLES: {
      ENABLED: true,
      GOAL_EXPLOSION: {
        COUNT: 30,
        SPEED: 200,
        LIFETIME: 1000,
        COLORS: [0xffff00, 0xff8800, 0xff0000],
      },
      COLLISION_SPARKS: {
        COUNT: 8,
        SPEED: 100,
        LIFETIME: 300,
        COLOR: 0xffffff,
      },
      POWERUP_GLOW: {
        ENABLED: true,
        INTENSITY: 0.8,
        PULSE_SPEED: 2,
      },
    },
    
    SHADOWS: {
      ENABLED: true,
      BLUR: 4,
      OFFSET_X: 2,
      OFFSET_Y: 4,
      ALPHA: 0.3,
    },
  },

  // Enhanced Audio/Console feedback
  FEEDBACK: {
    CONSOLE_LOGS: false, // Disabled for production
    AUDIO_ENABLED: true,
    HAPTIC_ENABLED: true, // For mobile devices
    
    GOAL_MESSAGES: [
      "GOOOOOAL! 🥅",
      "What a shot! ⚽",
      "Incredible goal! 🔥",
      "Amazing! 🎯",
      "Spectacular! ⭐",
      "Unstoppable! 💥",
    ],
    
    POWERUP_MESSAGES: [
      "Power-up collected! ⚡",
      "Boost activated! 🚀",
      "Enhanced abilities! 💪",
      "Super charged! ⚡",
      "Power surge! 🔥",
    ],
  },

  // Enhanced Ball settings with realistic physics
  BALL: {
    SIZE: 80,
    RADIUS: 40, // Collision radius
    MASS: 1.0, // Relative mass for physics calculations
    BOUNCE: 0.8, // More bouncy
    DRAG_X: 50, // Air resistance
    DRAG_Y: 20, // Vertical air resistance
    SPIN_FACTOR: 0.1, // Ball spin effect on trajectory
    MAX_VELOCITY: 600, // Higher max velocity
    
    STARTING_POSITION: { x: 768, y: 600 }, // Center of field
    
    // Kick physics
    KICK_FORCE: 180,
    KICK_UPWARD_FORCE: -25, // More upward force
    SEPARATION_FORCE: 30, // Stronger separation from players
    
    // Advanced ball physics
    MAGNUS_EFFECT: 0.05, // Curve effect from spin
    TRAJECTORY_SMOOTHING: 0.9, // Smooth trajectory interpolation
    COLLISION_ELASTICITY: 0.9, // Energy retention in collisions
  },

  // Enhanced Field settings
  FIELD: {
    GROUND_Y: 750, // Adjusted ground level
    GOAL_WIDTH: 220,
    GOAL_HEIGHT: 550,
    GOAL_AREA_WIDTH: 160,
    GOAL_AREA_HEIGHT: 180,
    CENTER_CIRCLE_RADIUS: 90,
    
    // Field boundaries with better collision
    WALL_THICKNESS: 20,
    CEILING_HEIGHT: 50,
    GOAL_POST_RADIUS: 15,
    
    // Field zones for AI and gameplay
    ZONES: {
      DEFENSIVE: 300, // Defensive zone width
      MIDFIELD: 200, // Midfield zone width
      OFFENSIVE: 300, // Offensive zone width
    },
  },

  // Enhanced Colors with accessibility
  COLORS: {
    FIELD_GREEN: 0x2e7d32,
    FIELD_SECONDARY: 0x388e3c, // For gradients
    PLAYER1_BLUE: 0x1976d2,
    PLAYER1_SECONDARY: 0x1565c0,
    PLAYER2_RED: 0xd32f2f,
    PLAYER2_SECONDARY: 0xc62828,
    WHITE: 0xffffff,
    BLACK: 0x000000,
    YELLOW: 0xffff00,
    TRANSPARENT: 0x000000,
    GREEN: 0x00ff00,
    TIMER_WARNING: 0xffa726,
    TIMER_CRITICAL: 0xef5350,
    
    // UI colors
    UI_PRIMARY: 0x1976d2,
    UI_SECONDARY: 0x424242,
    UI_SUCCESS: 0x4caf50,
    UI_WARNING: 0xff9800,
    UI_ERROR: 0xf44336,
    
    // Accessibility
    HIGH_CONTRAST: {
      ENABLED: false, // Can be toggled for accessibility
      PLAYER1: 0x000080,
      PLAYER2: 0x800000,
      BALL: 0xffff00,
    },
  },

  // Enhanced UI settings with responsive design
  UI: {
    TIMER_Y: 40,
    SCORE_Y: 90,
    CONTROLS_Y: 950,
    
    FONT_SIZES: {
      TIMER: "32px",
      SCORE: "24px",
      CONTROLS: "14px",
      GOAL_EFFECT: "72px",
      WIN_MESSAGE: "56px",
      RESTART_BUTTON: "24px",
      TITLE: "72px",
      SUBTITLE: "28px",
      START_BUTTON: "36px",
      INSTRUCTIONS: "28px",
      MENU_FOOTER: "18px",
    },
    
    // Responsive font scaling
    SCALE_FACTORS: {
      MOBILE: 0.7,
      TABLET: 0.85,
      DESKTOP: 1.0,
    },
    
    ANIMATIONS: {
      FADE_DURATION: 300,
      SLIDE_DURATION: 250,
      BOUNCE_DURATION: 400,
      ELASTIC_EASE: "elastic.out(1, 0.3)",
    },
  },

  // Timer warning thresholds with more granular warnings
  TIMER_THRESHOLDS: {
    WARNING: 30, // seconds
    CRITICAL: 10, // seconds
    URGENT: 5, // seconds - final countdown
  },

  // Enhanced Power-up system
  POWERUPS: {
    ENABLED: true,
    SPAWN_INTERVAL_MIN: 8000, // 8 seconds - more frequent
    SPAWN_INTERVAL_MAX: 12000, // 12 seconds
    DURATION: 6000, // 6 seconds effect duration
    LIFETIME: 12000, // 12 seconds before disappearing
    SIZE: 30, // Slightly larger
    BOUNCE_HEIGHT: 15,
    BOUNCE_SPEED: 2500,
    PARTICLE_COUNT: 20,
    PARTICLE_SPEED: 120,
    
    // Spawn zones to prevent unfair advantage
    SPAWN_ZONES: [
      { x: 400, y: 600, width: 200, height: 100 }, // Left midfield
      { x: 936, y: 600, width: 200, height: 100 }, // Right midfield
      { x: 668, y: 500, width: 200, height: 100 }, // Center elevated
    ],
    
    TYPES: {
      SPEED: {
        name: "Speed Boost",
        color: 0x00ff00,
        icon: "⚡",
        multiplier: 1.8, // Stronger effect
        rarity: 0.3, // 30% chance
      },
      JUMP: {
        name: "Jump Boost",
        color: 0x0099ff,
        icon: "↑",
        multiplier: 1.7,
        rarity: 0.3,
      },
      KICK: {
        name: "Kick Power",
        color: 0xff6600,
        icon: "💥",
        multiplier: 2.0, // Significant boost
        rarity: 0.25,
      },
      SHOOT: {
        name: "Shoot Power",
        color: 0xff0066,
        icon: "🎯",
        multiplier: 1.8,
        rarity: 0.15, // Rare but powerful
      },
    },
  },

  // Performance optimization settings
  PERFORMANCE: {
    // Rendering optimizations
    SPRITE_BATCHING: true,
    TEXTURE_CACHING: true,
    OBJECT_POOLING: true,
    CULLING_ENABLED: true,
    
    // Physics optimizations
    PHYSICS_ITERATIONS: 6, // Velocity iterations
    POSITION_ITERATIONS: 2, // Position iterations
    SLEEP_THRESHOLD: 0.4, // Put slow objects to sleep
    
    // Network optimizations
    POSITION_SYNC_RATE: 20, // Hz for position updates
    STATE_SYNC_RATE: 10, // Hz for game state updates
    INTERPOLATION_BUFFER: 100, // ms for smooth interpolation
    
    // Quality settings
    QUALITY_LEVELS: {
      LOW: {
        particles: false,
        shadows: false,
        trails: false,
        postProcessing: false,
      },
      MEDIUM: {
        particles: true,
        shadows: false,
        trails: true,
        postProcessing: false,
      },
      HIGH: {
        particles: true,
        shadows: true,
        trails: true,
        postProcessing: true,
      },
    },
  },

  // Accessibility features
  ACCESSIBILITY: {
    REDUCED_MOTION: false, // Can be set based on user preference
    HIGH_CONTRAST: false,
    LARGER_UI: false,
    SCREEN_READER_SUPPORT: true,
    KEYBOARD_NAVIGATION: true,
    COLOR_BLIND_SUPPORT: false,
  },

  // Debug settings (disabled in production)
  DEBUG: {
    ENABLED: process.env.NODE_ENV === 'development',
    SHOW_HITBOXES: false,
    SHOW_PHYSICS_DEBUG: false,
    SHOW_PERFORMANCE_METRICS: false,
    LOG_PHYSICS_EVENTS: false,
    SHOW_GRID: false,
  },
};

// Enhanced pixel sprite with better quality
export const PIXEL_SPRITE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

// Export utility functions for configuration
export const ConfigUtils = {
  // Get responsive font size based on screen width
  getResponsiveFontSize: (baseFontSize, screenWidth) => {
    const { MOBILE, TABLET } = GAME_CONFIG.BREAKPOINTS;
    const { MOBILE: mobileScale, TABLET: tabletScale } = GAME_CONFIG.UI.SCALE_FACTORS;
    
    if (screenWidth <= MOBILE) {
      return `${parseInt(baseFontSize) * mobileScale}px`;
    } else if (screenWidth <= TABLET) {
      return `${parseInt(baseFontSize) * tabletScale}px`;
    }
    return baseFontSize;
  },

  // Get quality level based on device performance
  getQualityLevel: (deviceInfo) => {
    // Simple heuristic based on device capabilities
    const { hardwareConcurrency = 4, memory = 4 } = navigator;
    
    if (hardwareConcurrency >= 8 && memory >= 8) {
      return GAME_CONFIG.PERFORMANCE.QUALITY_LEVELS.HIGH;
    } else if (hardwareConcurrency >= 4 && memory >= 4) {
      return GAME_CONFIG.PERFORMANCE.QUALITY_LEVELS.MEDIUM;
    } else {
      return GAME_CONFIG.PERFORMANCE.QUALITY_LEVELS.LOW;
    }
  },

  // Apply accessibility settings
  applyAccessibilitySettings: (settings) => {
    Object.assign(GAME_CONFIG.ACCESSIBILITY, settings);
    
    if (settings.HIGH_CONTRAST) {
      Object.assign(GAME_CONFIG.COLORS, GAME_CONFIG.COLORS.HIGH_CONTRAST);
    }
    
    if (settings.REDUCED_MOTION) {
      GAME_CONFIG.EFFECTS.SCREEN_SHAKE.GOAL_INTENSITY = 0;
      GAME_CONFIG.EFFECTS.PARTICLES.ENABLED = false;
    }
  },

  // Validate configuration integrity
  validateConfig: () => {
    const errors = [];
    
    // Check required values
    if (GAME_CONFIG.CANVAS_WIDTH <= 0 || GAME_CONFIG.CANVAS_HEIGHT <= 0) {
      errors.push("Invalid canvas dimensions");
    }
    
    if (GAME_CONFIG.FRAME_RATE <= 0 || GAME_CONFIG.FRAME_RATE > 120) {
      errors.push("Invalid frame rate");
    }
    
    // Validate physics values
    if (GAME_CONFIG.GRAVITY <= 0) {
      errors.push("Gravity must be positive");
    }
    
    if (errors.length > 0) {
      console.error("Configuration validation errors:", errors);
      return false;
    }
    
    return true;
  },
};
