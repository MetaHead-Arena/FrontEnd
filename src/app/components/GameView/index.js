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
  const handleGameModeSelect = useCallback(
    (mode) => {
      if (mode === "online") {
        // For online mode, show loading screen first
        setGameLoading(true);

        // Set up global variables for the game
        if (typeof window !== "undefined") {
          window.__HEADBALL_GAME_MODE = mode;
          window.__HEADBALL_RETURN_TO_MENU = returnToMenu;

          // Determine player position based on room data
          const roomInfo = socketService.getRoomInfo();
          const socketId = socketService.getSocket()?.id;

          console.log("Room info for position assignment:", roomInfo);
          console.log("Current socket ID:", socketId);

          // Get player position from room data if available
          let playerPosition = null;

          // First check if we already have a position assigned (most reliable)
          if (
            typeof window !== "undefined" &&
            window.__HEADBALL_PLAYER_POSITION
          ) {
            playerPosition = window.__HEADBALL_PLAYER_POSITION;
            console.log("Using existing player position:", playerPosition);
          }
          // Try to get position from stored room data if no existing position
          else if (
            typeof window !== "undefined" &&
            window.__HEADBALL_ROOM_DATA
          ) {
            const roomData = window.__HEADBALL_ROOM_DATA;
            console.log(
              "Using stored room data for position assignment:",
              roomData
            );

            // Use the same logic as GameMenu for consistency
            if (
              roomData.players &&
              Array.isArray(roomData.players) &&
              socketId
            ) {
              const playerIndex = roomData.players.findIndex(
                (player) =>
                  player.socketId === socketId ||
                  player.id === socketId ||
                  player.playerId === socketId
              );

              if (playerIndex !== -1) {
                // First player (index 0) = player1, Second player (index 1) = player2
                playerPosition = playerIndex === 0 ? "player1" : "player2";
                console.log(
                  `Player found at index ${playerIndex}, assigned position: ${playerPosition}`
                );
              } else {
                // Fallback: if we're the first connection, assign player1
                playerPosition =
                  roomData.players.length === 1 ? "player1" : "player2";
                console.log(
                  `Player not found, using array length fallback: ${playerPosition}`
                );
              }
            } else {
              // Fallback based on join order - if we have room info and it's the first player
              if (roomInfo && roomInfo.playersInRoom === 1) {
                playerPosition = "player1";
              } else {
                // For safety, default to player1 if we can't determine reliably
                playerPosition = "player1";
              }
              console.log(`Using room info fallback: ${playerPosition}`);
            }
          } else {
            // Final fallback - assign based on connection timing
            // This should rarely be reached now that we preserve positions
            playerPosition = "player1";
            console.log("No room data available, defaulting to player1");
          }

          window.__HEADBALL_PLAYER_POSITION = playerPosition;

          console.log(
            "Final player position assignment:",
            window.__HEADBALL_PLAYER_POSITION
          );
        }

        // Start game initialization
        setTimeout(() => {
          setGameMode(mode);
        }, 100); // Small delay to ensure loading screen shows
      } else {
        // For offline modes, start immediately
        if (typeof window !== "undefined") {
          window.__HEADBALL_GAME_MODE = mode;
          window.__HEADBALL_RETURN_TO_MENU = returnToMenu;
        }
        setGameMode(mode);
      }
    },
    [returnToMenu]
  );

  // Initialize game when gameMode changes
  useEffect(() => {
    if (!gameMode || gameInitialized) return;

    const initializeGame = async () => {
      try {
        // Import Phaser dynamically to avoid SSR issues
        const Phaser = await import("phaser");

        // Import game components - use different scene for online vs offline
        let GameSceneClass;
        if (gameMode === "online") {
          const { OnlineGameScene } = await import("../OnlineGameScene.js");
          GameSceneClass = OnlineGameScene;
          console.log("Using OnlineGameScene for online multiplayer");
        } else {
          const { GameScene } = await import("../GameScene.js");
          GameSceneClass = GameScene;
          console.log("Using GameScene for offline/AI mode");
        }

        const { GAME_CONFIG } = await import("../config.js");

        // Create game configuration
        const config = {
          type: Phaser.AUTO,
          width: GAME_CONFIG.CANVAS_WIDTH,
          height: GAME_CONFIG.CANVAS_HEIGHT,
          parent: gameContainerRef.current,
          backgroundColor: "#000000",
          physics: {
            default: "arcade",
            arcade: {
              gravity: { y: GAME_CONFIG.GRAVITY },
              debug: false,
            },
          },
          scene: GameSceneClass,
          scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
        };

        // Create and start the game
        const game = new Phaser.Game(config);

        // Store game instance globally for cleanup
        if (typeof window !== "undefined") {
          window.__HEADBALL_GAME = game;
          // Store the callback function directly to avoid dependency issues
          window.__HEADBALL_GAME_LOADED = () => {
            console.log(
              "Game engine loaded, checking if ready to emit player-ready"
            );
            setGameLoading(false);

            // Emit player-ready only for online games with proper checks
            if (gameMode === "online") {
              // Add a small delay to ensure everything is properly initialized
              setTimeout(() => {
                if (
                  socketService.isSocketConnected() &&
                  socketService.isRoomJoined()
                ) {
                  console.log(
                    "Socket connected and room joined, emitting player-ready"
                  );
                  socketService.emitPlayerReady();
                } else {
                  console.warn(
                    "Cannot emit player-ready: socket not connected or room not joined"
                  );
                  console.log(
                    "Socket connected:",
                    socketService.isSocketConnected()
                  );
                  console.log("Room joined:", socketService.isRoomJoined());
                }
              }, 500);
            }
          };
        }

        gameInitialized = true;
        console.log(
          `Game initialized successfully with ${
            gameMode === "online" ? "OnlineGameScene" : "GameScene"
          }`
        );
      } catch (error) {
        console.error("Failed to initialize game:", error);
        setGameLoading(false);
      }
    };

    initializeGame();

    // Cleanup function
    return () => {
      if (typeof window !== "undefined" && window.__HEADBALL_GAME) {
        window.__HEADBALL_GAME.destroy(true);
        window.__HEADBALL_GAME = null;
      }
      gameInitialized = false;
    };
  }, [gameMode]);

  // Handle marketplace mode
  const handleMarketplace = useCallback(() => {
    setMarketplaceMode(true);
  }, []);

  // Handle return from marketplace
  const handleReturnFromMarketplace = useCallback(() => {
    setMarketplaceMode(false);
  }, []);

  if (marketplaceMode) {
    return <Marketplace onReturn={handleReturnFromMarketplace} />;
  }

  if (gameMode) {
    return (
      <div className="game-container">
        {/* Loading overlay for online games */}
        {gameLoading && gameMode === "online" && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10000,
            }}
          >
            <div
              style={{
                background: "#1e293b",
                border: "4px solid #ffd600",
                borderRadius: "8px",
                padding: "32px",
                textAlign: "center",
                maxWidth: "500px",
                width: "90%",
              }}
            >
              <h2
                style={{
                  color: "#fde047",
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "24px",
                  marginBottom: "20px",
                  textShadow: "2px 2px 0 #000",
                }}
              >
                LOADING GAME...
              </h2>
              <div
                style={{
                  color: "#fff",
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "16px",
                  marginBottom: "20px",
                  lineHeight: "1.5",
                }}
              >
                <div style={{ marginBottom: "10px" }}>
                  🎮 Initializing game engine...
                </div>
                <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                  Please wait while we set up your match
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    border: "4px solid #374151",
                    borderTop: "4px solid #fde047",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Game container */}
        <div
          ref={gameContainerRef}
          style={{
            width: "100%",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />

        {/* CSS for loading animation */}
        <style jsx>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <GameMenu
      onSelectMode={handleGameModeSelect}
      onMarketplace={handleMarketplace}
    />
  );
}
