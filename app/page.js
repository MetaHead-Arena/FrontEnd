'use client';

import { useState, useRef } from 'react';
import '../app/globals.css';
import GameMenu from '../src/ui/GameMenu';

// Module-level flag to act as a singleton lock.
// This will not be reset by React's Strict Mode re-renders.
let gameInitialized = false;

export default function Home() {
  const [gameMode, setGameMode] = useState(null); // null, '2player', or 'vsAI'
  const gameContainerRef = useRef(null);

  if (gameMode && !gameInitialized && typeof window !== 'undefined') {
    gameInitialized = true;
    (async () => {
      const { GameScene } = await import('../src/GameScene.js');
      const { GAME_CONFIG } = await import('../src/config.js');
      const config = {
        type: Phaser.AUTO,
        width: GAME_CONFIG.CANVAS_WIDTH,
        height: GAME_CONFIG.CANVAS_HEIGHT,
        parent: gameContainerRef.current,
        backgroundColor: GAME_CONFIG.COLORS.FIELD_GREEN,
        physics: {
          default: 'arcade',
          arcade: { debug: false }
        },
        scene: [GameScene],
      };
      window.__HEADBALL_GAME_MODE = gameMode;
      new Phaser.Game(config);
    })();
  }

  return (
    <>
      {!gameMode && (
        <GameMenu
          onSelectMode={(mode) => setGameMode(mode)}
        />
      )}
      <div id="game-container" ref={gameContainerRef} style={{ width: '100vw', height: '100vh' }} />
    </>
  );
} 