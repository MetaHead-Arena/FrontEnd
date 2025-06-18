import { GAME_CONFIG } from './config.js';
import { MenuScene } from './MenuScene.js';
import { GameScene } from './GameScene.js';

// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    width: GAME_CONFIG.CANVAS_WIDTH,
    height: GAME_CONFIG.CANVAS_HEIGHT,
    parent: 'game-container',
    backgroundColor: GAME_CONFIG.COLORS.FIELD_GREEN,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [MenuScene, GameScene]
};

// Initialize the game
const game = new Phaser.Game(config); 