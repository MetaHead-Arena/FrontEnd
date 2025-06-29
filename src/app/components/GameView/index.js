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

          // Try to get position from stored room data first
          if (typeof window !== "undefined" && window.__HEADBALL_ROOM_DATA) {
            const roomData = window.__HEADBALL_ROOM_DATA;
            console.log(
              "Using stored room data for position assignment:",
              roomData
            );

            // Check if we have player information in the room data
            if (roomData.players && Array.isArray(roomData.players)) {
              console.log("Room players:", roomData.players);

              // Find our player in the room data using socket ID or player ID
              const thisPlayer = roomData.players.find(
                (player) =>
                  player.socketId === socketId ||
                  player.id === socketId ||
                  player.playerId === socketId
              );

              if (thisPlayer) {
                // Use the position from the server - this is the key fix!
                playerPosition = thisPlayer.position;
                console.log(
                  "Found player in room data:",
                  thisPlayer,
                  "Position:",
                  playerPosition
                );
              } else {
                // Fallback: use array index based on join order
                const playerIndex = roomData.players.findIndex(
                  (player) =>
                    player.socketId === socketId ||
                    player.id === socketId ||
                    player.playerId === socketId
                );
                if (playerIndex !== -1) {
                  playerPosition = playerIndex === 0 ? "player1" : "player2";
                  console.log(
                    "Using array index for position:",
                    playerIndex,
                    "Position:",
                    playerPosition
                  );
                } else {
                  // If we can't find our socket ID, use join order
                  console.log(
                    "Socket ID not found in players array, using join order"
                  );
                  playerPosition =
                    roomData.players.length === 1 ? "player1" : "player2";
                  console.log("Using join order position:", playerPosition);
                }
              }
            } else {
              // Fallback: use players count
              if (roomData.players && roomData.players.length === 1) {
                playerPosition = "player1";
              } else if (roomData.players && roomData.players.length === 2) {
                playerPosition = "player2";
              }
            }
          }

          // If we still don't have a position, try room state
          if (!playerPosition && roomInfo.roomId) {
            const roomState = socketService.getCurrentRoomState();
            console.log("Using room state for position assignment:", roomState);

            if (roomState.playersInRoom === 1) {
              playerPosition = "player1";
            } else if (roomState.playersInRoom === 2) {
              playerPosition = "player2";
            }
          }

          // Final fallback: use socket ID hash for consistent assignment
          if (!playerPosition) {
            const socketHash = socketId
              ? socketId.split("").reduce((a, b) => {
                  a = (a << 5) - a + b.charCodeAt(0);
                  return a & a;
                }, 0)
              : 0;
            playerPosition = socketHash % 2 === 0 ? "player1" : "player2";
            console.log(
              "Using socket hash fallback position assignment:",
              playerPosition,
              "Hash:",
              socketHash
            );
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

        // Import game components
        const { GameScene } = await import("../GameScene.js");
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
          scene: GameScene,
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
        console.log("Game initialized successfully");
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
