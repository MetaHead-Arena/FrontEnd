"use client";

import { useState, useRef, useCallback } from "react";
import "../../../app/globals.css";
import GameMenu from "../../ui/GameMenu";
import Marketplace from "../../ui/Marketplace";
import { GAME_CONFIG } from "../config.js";
// Module-level flag to act as a singleton lock.
// This will not be reset by React's Strict Mode re-renders.
let gameInitialized = false;

export default function GameView() {
  const [gameMode, setGameMode] = useState(null); // null, '2player', or 'vsAI'
  const [marketplaceMode, setMarketplaceMode] = useState(false);
  const gameContainerRef = useRef(null);
  // const { isConnected } = useAccount();
  // const router = useRouter();

  // Callback function to return to menu
  const returnToMenu = useCallback(() => {
    setGameMode(null);
    setMarketplaceMode(false);
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
      const { GameScene } = await import("../GameScene.js");
      const { GAME_CONFIG } = await import("../config.js");
      const config = {
        type: Phaser.AUTO,
        width: 1536,
        height: 1024,
        parent: gameContainerRef.current,
        backgroundColor: "#000000",
        physics: {
          default: "arcade",
          arcade: { debug: false },
        },
        scene: [GameScene],
        scale: {
          mode: window.Phaser ? window.Phaser.Scale.FIT : undefined,
          autoCenter: window.Phaser
            ? window.Phaser.Scale.CENTER_BOTH
            : undefined,
          width: 1536,
          height: 1024,
        },
      };
      window.__HEADBALL_GAME_MODE = gameMode;
      window.__HEADBALL_GAME = new window.Phaser.Game(config);
      // Store the return to menu function globally so the game can access it
      window.__HEADBALL_RETURN_TO_MENU = returnToMenu;
    })();
  }

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
      {gameMode && (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            background: "#a86c2c",
            position: "fixed",
            top: 0,
            left: 0,
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          zIndex: 1,
        }}
      >
        {!gameMode && !marketplaceMode && (
          <GameMenu
            onSelectMode={(mode) => setGameMode(mode)}
            onMarketplace={() => setMarketplaceMode(true)}
          />
        )}
        {marketplaceMode && <Marketplace onBack={returnToMenu} />}
        {gameMode && (
          <div
            id="game-container"
            ref={gameContainerRef}
            style={{
              width: "100vw",
              height: "100vh",
              position: "fixed",
              top: 0,
              left: 0,
              zIndex: 1000,
              background: "#000",
            }}
          />
        )}
      </div>
    </div>
  );
}
