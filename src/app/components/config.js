// Game Configuration and Constants
export const GAME_CONFIG = {
  // Canvas settings
  CANVAS_WIDTH: 1536,
  CANVAS_HEIGHT: 1024,

  // Game timing
  GAME_DURATION: 60, // seconds
  GOAL_COOLDOWN: 120, // frames (2 seconds at 60 FPS)
  GOAL_PAUSE_DURATION: 1000, // milliseconds

  // Physics
  GRAVITY: 500,

  // Player settings
  PLAYER: {
    WIDTH: 120,
    HEIGHT: 140,
    BASE_SPEED: 180,
    BASE_JUMP_VELOCITY: -300,
    BASE_KICK_POWER: 150,
    BASE_SHOOT_POWER: 300,
    BOUNCE: 0.1,
    DRAG_X: 800,
    SHOOT_COOLDOWN: 1000,
    STARTING_POSITIONS: {
      PLAYER1: { x: 300, y: 700 },
      PLAYER2: { x: 1200, y: 700 },
    },
    BG_IMAGES: {
      PLAYER1: "/head-1.png", // Path to Player 1 background image
      PLAYER2: "/head-2.png", // Path to Player 2 background image
    },
    ATTRIBUTES: {
      PLAYER1: {
        speed: 2.0,
        jumpHeight: 1.3,
        size: 1.0,
        kickPower: 1.0,
        shootPower: 1.0,
        name: "Player 1",
        color: 0x1976d2,
      },
      PLAYER2: {
        speed: 2.0,
        jumpHeight: 1.3,
        size: 1.0,
        kickPower: 1.0,
        shootPower: 1.0,
        name: "Player 2",
        color: 0xd32f2f,
      },
    },

    // Default base attributes for any player (can be customized per player)
    DEFAULT_ATTRIBUTES: {
      speed: 1.0,
      jumpHeight: 1.0,
      size: 1.0,
      kickPower: 1.0,
      shootPower: 1.0,
    },
  },

  // Visual effects configuration
  EFFECTS: {
    BALL_TRAIL: {
      ENABLED: false,
      MIN_SPEED: 200,
      TRAIL_LENGTH: 8,
      ALPHA_DECAY: 0.8,
    },
    SCREEN_SHAKE: {
      GOAL_INTENSITY: 0,
      GOAL_DURATION: 0,
    },
    GOAL_FLASH: {
      DURATION: 500,
      COLOR: 0xffffff,
      ALPHA: 0.6,
    },
  },

  // Audio/Console feedback
  FEEDBACK: {
    CONSOLE_LOGS: true,
    GOAL_MESSAGES: [
      "GOOOOOAL! 🥅",
      "What a shot! ⚽",
      "Incredible goal! 🔥",
      "Amazing! 🎯",
    ],
    POWERUP_MESSAGES: [
      "Power-up collected! ⚡",
      "Boost activated! 🚀",
      "Enhanced abilities! 💪",
    ],
  },

  // Ball settings
  BALL: {
    SIZE: 80,
    BOUNCE: 0.3,
    DRAG_X: 40,
    DRAG_Y: 8,
    MAX_VELOCITY: 500,
    STARTING_POSITION: { x: 765, y: 650 },
    KICK_FORCE: 150,
    KICK_UPWARD_FORCE: -15,
    SEPARATION_FORCE: 20,
  },

  // Field settings
  FIELD: {
    GROUND_Y: 730,
    GOAL_WIDTH: 215,
    GOAL_HEIGHT: 550,
    GOAL_AREA_WIDTH: 150,
    GOAL_AREA_HEIGHT: 160,
    CENTER_CIRCLE_RADIUS: 80,
  },

  // Colors
  COLORS: {
    FIELD_GREEN: 0x2e7d32,
    PLAYER1_BLUE: 0x1976d2,
    PLAYER2_RED: 0xd32f2f,
    WHITE: 0xffffff,
    BLACK: 0x000000,
    YELLOW: 0xffff00,
    TRANSPARENT: 0x000000,
    GREEN: 0x00ff00,
    TIMER_WARNING: 0xffff00,
    TIMER_CRITICAL: 0xff0000,
  },

  // UI settings
  UI: {
    TIMER_Y: 30,
    SCORE_Y: 80,
    CONTROLS_Y: 920,
    FONT_SIZES: {
      TIMER: "28px",
      SCORE: "20px",
      CONTROLS: "12px",
      GOAL_EFFECT: "64px",
      WIN_MESSAGE: "48px",
      RESTART_BUTTON: "20px",
      TITLE: "64px",
      SUBTITLE: "24px",
      START_BUTTON: "32px",
      INSTRUCTIONS: "24px",
      MENU_FOOTER: "16px",
    },
  },

  // Timer warning thresholds
  TIMER_THRESHOLDS: {
    WARNING: 30, // seconds
    CRITICAL: 10, // seconds
  },

  // Power-up system
  POWERUPS: {
    SPAWN_INTERVAL_MIN: 10000, // 10 seconds
    SPAWN_INTERVAL_MAX: 15000, // 15 seconds
    DURATION: 5000, // 5 seconds effect duration
    LIFETIME: 10000, // 10 seconds before disappearing
    SIZE: 25,
    BOUNCE_HEIGHT: 10,
    BOUNCE_SPEED: 2000,
    PARTICLE_COUNT: 15,
    PARTICLE_SPEED: 100,
    TYPES: {
      SPEED: {
        name: "Speed Boost",
        color: 0x00ff00,
        icon: "⚡",
        multiplier: 1.5,
      },
      JUMP: {
        name: "Jump Boost",
        color: 0x0099ff,
        icon: "↑",
        multiplier: 1.5,
      },
      KICK: {
        name: "Kick Power",
        color: 0xff6600,
        icon: "💥",
        multiplier: 1.5,
      },
      SHOOT: {
        name: "Shoot Power",
        color: 0xff0066,
        icon: "🎯",
        multiplier: 1.5,
      },
    },
  },
};

// Pixel sprite data URL
export const PIXEL_SPRITE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
