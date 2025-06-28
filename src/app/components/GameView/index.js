"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import "../../../app/globals.css";
import GameMenu from "../../ui/GameMenu";
import Marketplace from "../../ui/Marketplace";
import { socketService } from "../../../services/socketService";
// Module-level flag to act as a singleton lock.
// This will not be reset by React's Strict Mode re-renders.
let gameInitialized = false;

export default function GameView() {
  const [gameMode, setGameMode] = useState(null); // null, '2player', 'vsAI', 'online'
  const [marketplaceMode, setMarketplaceMode] = useState(false);
  const [gameLoading, setGameLoading] = useState(false);
  const gameContainerRef = useRef(null);
  // const { isConnected } = useAccount();
  // const router = useRouter();

  // Callback function to return to menu
  const returnToMenu = useCallback(() => {
    setGameMode(null);
    setMarketplaceMode(false);
    setGameLoading(false);
    gameInitialized = false;
    // Clean up the game instance
    if (typeof window !== "undefined" && window.__HEADBALL_GAME) {
      window.__HEADBALL_GAME.destroy(true);
      window.__HEADBALL_GAME = null;
    }
  }, []);

  // Handle game mode selection with loading for online mode
  const handleGameModeSelect = useCallback((mode) => {
    if (mode === "online") {
      // For online mode, show loading screen first
      setGameLoading(true);
      // Start game initialization
      setTimeout(() => {
        setGameMode(mode);
      }, 100); // Small delay to ensure loading screen shows
    } else {
      // For offline modes, start immediately
      setGameMode(mode);
    }
  }, []);

  // Callback when game finishes loading (called from GameScene)
  const onGameLoaded = useCallback(() => {
    console.log("Game engine loaded, emitting player-ready");
    setGameLoading(false);

    // Emit player-ready only for online games
    if (gameMode === "online" && socketService.isRoomJoined()) {
      socketService.emitPlayerReady();
    }
  }, [gameMode]);

  if (gameMode && !gameInitialized && typeof window !== "undefined") {
    gameInitialized = true;
    (async () => {
      const { GameScene } = await import("../GameScene.js");
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
      // Store the game loaded callback globally so the game can notify when ready
      window.__HEADBALL_GAME_LOADED = onGameLoaded;
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
        {!gameMode && !marketplaceMode && !gameLoading && (
          <GameMenu
            onSelectMode={handleGameModeSelect}
            onMarketplace={() => setMarketplaceMode(true)}
          />
        )}
        {marketplaceMode && <Marketplace onBack={returnToMenu} />}

        {/* Game Loading Screen */}
        {gameLoading && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background:
                "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)",
              zIndex: 10000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                textAlign: "center",
                color: "#fff",
                fontFamily: '"Press Start 2P", monospace',
              }}
            >
              <div
                style={{
                  fontSize: "32px",
                  marginBottom: "30px",
                  color: "#fde047",
                  textShadow: "3px 3px 0 #000",
                  letterSpacing: "2px",
                }}
              >
                LOADING GAME ENGINE
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "30px",
                }}
              >
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    border: "6px solid #374151",
                    borderTop: "6px solid #fde047",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: "14px",
                  color: "#94a3b8",
                  marginBottom: "20px",
                  lineHeight: "1.6",
                }}
              >
                Initializing physics engine...
                <br />
                Loading game assets...
                <br />
                Preparing multiplayer systems...
              </div>

              {/* Progress bar animation */}
              <div
                style={{
                  width: "300px",
                  height: "8px",
                  background: "#374151",
                  borderRadius: "4px",
                  margin: "0 auto",
                  overflow: "hidden",
                  border: "2px solid #fde047",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "linear-gradient(90deg, #fde047, #facc15)",
                    animation: "loading-progress 3s ease-in-out infinite",
                    transform: "translateX(-100%)",
                  }}
                />
              </div>
            </div>
          </div>
        )}

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

        {/* CSS for animations */}
        <style jsx>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }

          @keyframes loading-progress {
            0% {
              transform: translateX(-100%);
            }
            50% {
              transform: translateX(0%);
            }
            100% {
              transform: translateX(100%);
            }
          }
        `}</style>
      </div>
    </div>
  );
}
