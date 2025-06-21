"use client";

import { useState, useRef, useCallback } from "react";
import "../app/globals.css";
import GameMenu from "../src/ui/GameMenu";

// Module-level flag to act as a singleton lock.
// This will not be reset by React's Strict Mode re-renders.
let gameInitialized = false;

export default function Home() {
  const [gameMode, setGameMode] = useState(null); // null, '2player', or 'vsAI'
  const gameContainerRef = useRef(null);

  // Callback function to return to menu
  const returnToMenu = useCallback(() => {
    setGameMode(null);
    gameInitialized = false;
    // Clean up the game instance
    if (typeof window !== "undefined" && window.__HEADBALL_GAME) {
      window.__HEADBALL_GAME.destroy(true);
      window.__HEADBALL_GAME = null;
    }
  }, []);

  if (gameMode && !gameInitialized && typeof window !== "undefined") {
    gameInitialized = true;
    (async () => {
      const { GameScene } = await import("../src/GameScene.js");
      const { GAME_CONFIG } = await import("../src/config.js");
      const config = {
        type: Phaser.AUTO,
        width: GAME_CONFIG.CANVAS_WIDTH,
        height: GAME_CONFIG.CANVAS_HEIGHT,
        parent: gameContainerRef.current,
        backgroundColor: GAME_CONFIG.COLORS.FIELD_GREEN,
        physics: {
          default: "arcade",
          arcade: { debug: false },
        },
        scene: [GameScene],
      };
      window.__HEADBALL_GAME_MODE = gameMode;
      window.__HEADBALL_GAME = new Phaser.Game(config);
      // Store the return to menu function globally so the game can access it
      window.__HEADBALL_RETURN_TO_MENU = returnToMenu;
    })();
  }

  return (
    <>
      {!gameMode && <GameMenu onSelectMode={(mode) => setGameMode(mode)} />}
      <div
        id="game-container"
        ref={gameContainerRef}
        style={{ width: "100vw", height: "100vh" }}
      />
    </>
  );
}
