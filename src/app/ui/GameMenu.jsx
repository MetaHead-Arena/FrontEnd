import { useState, useEffect, useRef } from "react";
// import GameBackGround from "../assets/GameBackGround.png"; // Not needed in Next.js
import PixelButton from "./PixelButton";
import PlayerSelect from "./PlayerSelect";
import MetaheadTitle from "./MetaheadTitle";
import ChestRedeemModal from "./ChestRedeemModal";
import LevelProgressBar from "./LevelProgressBar";
import CoinDisplay from "./CoinDisplay";
import CoinModal from "./CoinModal";
import NetworkSwitcher from "./NetworkSwitcher";
import { useReadContract } from "wagmi";

import { useAccount } from "wagmi";
import CustomConnectButton from "./CustomConnectButton";
import { useAuth } from "@/contexts/AuthContext";
import { socketService } from "@/services/socketService";

const GameBackGround = "/GameBackGround.png";

const GameMenu = ({ onSelectMode, onMarketplace }) => {
  const { address, isConnected } = useAccount();
  const { isAuthenticated } = useAuth();
  const [selectedPlayer, setSelectedPlayer] = useState(1);
  const [showChestModal, setShowChestModal] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [playerCreated, setPlayerCreated] = useState(false);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const [roomJoined, setRoomJoined] = useState(false);
  const [playersInRoom, setPlayersInRoom] = useState(0);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [bothPlayersReady, setBothPlayersReady] = useState(false);
  const [showCoinTransferModal, setShowCoinTransferModal] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState(null);
  const [gameLoading, setGameLoading] = useState(false);
  const readyPlayersRef = useRef(new Set());

  // Store onSelectMode in a ref to avoid dependency issues
  const onSelectModeRef = useRef(onSelectMode);
  onSelectModeRef.current = onSelectMode;

  // Listen for player-created event and check initial state
  useEffect(() => {
    // Check if player is already created when component mounts
    if (isAuthenticated && socketService.isSocketConnected()) {
      setPlayerCreated(socketService.isPlayerCreated());
      setIsMatchmaking(socketService.isInMatchmaking());
      setRoomJoined(socketService.isRoomJoined());
      setPlayersInRoom(socketService.getPlayersInRoom());
    }

    // Event handlers
    const handlePlayerCreated = (data) => {
      console.log("Player created in GameMenu:", data);
      setPlayerCreated(true);
    };

    const handleRoomJoined = (data) => {
      console.log("Room joined in GameMenu:", data);
      setRoomJoined(true);
      // Use players array length from backend data
      const currentPlayers = data.players ? data.players.length : 1;
      setPlayersInRoom(currentPlayers);
      setWaitingForPlayers(currentPlayers < 2);
      setIsMatchmaking(false);

      // Store room data for position assignment
      if (typeof window !== "undefined") {
        window.__HEADBALL_ROOM_DATA = data;
        console.log("Stored room data for position assignment:", data);

        // Determine player position from server data
        const socketId = socketService.getSocket()?.id;
        if (data.players && Array.isArray(data.players) && socketId) {
          const thisPlayer = data.players.find(
            (player) =>
              player.socketId === socketId ||
              player.id === socketId ||
              player.playerId === socketId
          );

          if (thisPlayer) {
            window.__HEADBALL_PLAYER_POSITION = thisPlayer.position;
            console.log("Player position from server:", thisPlayer.position);
          }
        }
      }
    };

    const handlePlayerJoinedRoom = (data) => {
      console.log("Player joined room in GameMenu:", data);
      // Use players array length from backend data
      const currentPlayers = data.players
        ? data.players.length
        : socketService.getPlayersInRoom();
      setPlayersInRoom(currentPlayers);

      // Update stored room data
      if (typeof window !== "undefined") {
        window.__HEADBALL_ROOM_DATA = data;
        console.log("Updated room data:", data);

        // Update player position from server data
        const socketId = socketService.getSocket()?.id;
        if (data.players && Array.isArray(data.players) && socketId) {
          const thisPlayer = data.players.find(
            (player) =>
              player.socketId === socketId ||
              player.id === socketId ||
              player.playerId === socketId
          );

          if (thisPlayer) {
            window.__HEADBALL_PLAYER_POSITION = thisPlayer.position;
            console.log(
              "Updated player position from server:",
              thisPlayer.position
            );
          }
        }
      }

      // If we have 2 players, show ready button instead of auto-starting
      if (currentPlayers >= 2) {
        console.log("Two players in room, showing ready button...");
        setWaitingForPlayers(false);
        // Don't auto-start, let players click ready
      }
    };

    const handlePlayerReady = (data) => {
      console.log("Player ready in GameMenu:", data);

      // Check if this is the local player or remote player
      const socketId = socketService.getSocket()?.id;
      const playerId = data.socketId || data.playerId;

      if (playerId === socketId) {
        // Local player is ready
        readyPlayersRef.current.add(playerId);
        console.log("Local player marked as ready");
      } else {
        // Remote player is ready
        readyPlayersRef.current.add(playerId);
        console.log("Remote player marked as ready");
      }

      // Check if both players are ready
      // Use the data from the server if available, otherwise check our tracking
      if (data.allPlayersReady || readyPlayersRef.current.size >= 2) {
        setBothPlayersReady(true);
        console.log("Both players are ready, starting game...");

        // Start the game after a short delay
        setTimeout(() => {
          setRoomJoined(false);
          setWaitingForPlayers(false);
          onSelectModeRef.current("online"); // This will trigger the loading screen
        }, 1000);
      }
    };

    // Register event listeners
    socketService.on("player-created", handlePlayerCreated);
    socketService.on("room-joined", handleRoomJoined);
    socketService.on("player-joined-room", handlePlayerJoinedRoom);
    socketService.on("player-ready", handlePlayerReady);

    // Cleanup listeners on unmount
    return () => {
      socketService.off("player-created", handlePlayerCreated);
      socketService.off("room-joined", handleRoomJoined);
      socketService.off("player-joined-room", handlePlayerJoinedRoom);
      socketService.off("player-ready", handlePlayerReady);
    };
  }, [isAuthenticated]);

  // Reset player created state when user disconnects
  useEffect(() => {
    if (!isAuthenticated) {
      setPlayerCreated(false);
      setIsMatchmaking(false);
      setRoomJoined(false);
      setPlayersInRoom(0);
      setWaitingForPlayers(false);
      setBothPlayersReady(false);
      readyPlayersRef.current.clear();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    function onError(data) {
      if (
        data.type === "GAME_ERROR" &&
        data.message === "Player already in a room"
      ) {
        // Reset and retry
        socketService.forceReconnect().then(() => {
          // You may want to pass player info here if needed
          socketService.findMatch({ selectedPlayer });
        });
      }
    }
    socketService.on("error", onError);
    return () => socketService.off("error", onError);
  }, [selectedPlayer]);

  useEffect(() => {
    function onRoomJoined(data) {
      setGameLoading(false); // Hide the loading overlay
      // Reset ready state when joining a new room
      setBothPlayersReady(false);
      readyPlayersRef.current.clear();
    }
    socketService.on("room-joined", onRoomJoined);
    return () => socketService.off("room-joined", onRoomJoined);
  }, []);

  useEffect(() => {
    function onLeftRoom(data) {
      // Reset ready state when leaving room
      setBothPlayersReady(false);
      readyPlayersRef.current.clear();
    }
    socketService.on("left-room", onLeftRoom);
    return () => socketService.off("left-room", onLeftRoom);
  }, []);

  const handlePlayerChange = (direction) => {
    if (direction === "next") {
      setSelectedPlayer((prev) => (prev === 4 ? 1 : prev + 1));
    } else {
      setSelectedPlayer((prev) => (prev === 1 ? 4 : prev - 1));
    }
  };

  const handleOnlineClick = () => {
    // Prevent multiple clicks
    if (isMatchmaking || roomJoined) {
      console.log("Matchmaking already in progress, ignoring click");
      return;
    }

    // Reset ready state for new match
    setBothPlayersReady(false);
    readyPlayersRef.current.clear();

    if (socketService.isSocketConnected() && playerCreated) {
      console.log("Starting matchmaking...");
      setIsMatchmaking(true);
      socketService.findMatch({
        playerId: socketService.getSocket()?.id,
        selectedPlayer: selectedPlayer,
      });
    } else {
      console.error(
        "Cannot start matchmaking: socket not connected or player not created"
      );
    }
  };

  const handleCancelMatchmaking = () => {
    setIsMatchmaking(false);
    socketService.cancelMatchmaking();
  };

  const handleReadyClick = () => {
    console.log("Player clicked ready");

    // Use Phaser's handleReady function
    if (typeof window !== "undefined" && window.__HEADBALL_HANDLE_READY) {
      window.__HEADBALL_HANDLE_READY();
    } else {
      console.warn("Phaser handleReady function not available");
    }
  };

  const handleResetConnection = async () => {
    try {
      console.log("User requested connection reset");
      await socketService.forceReconnect();
      setConnectionHealth(socketService.getConnectionHealth());
      console.log("Connection reset successful");
    } catch (error) {
      console.error("Connection reset failed:", error);
    }
  };

  const handleShowDebugInfo = () => {
    setConnectionHealth(socketService.getConnectionHealth());
    setShowDebugPanel(!showDebugPanel);
  };

  return (
    <div
      style={{
        height: "100vh",
        position: "relative",
        backgroundImage: `url(${GameBackGround})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        overflow: "hidden",
      }}
    >
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center">
          <div className={`${isConnected ? "hidden" : "block"} `}>
            <CustomConnectButton />
          </div>
          <div
            className={`${
              isConnected ? "flex items-center font-pixel" : "hidden"
            }`}
          >
            <span className="wallet-address text-white  font-pixel  text-sm ">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <NetworkSwitcher />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`${isConnected ? "block" : "hidden"} `}>
            <CustomConnectButton />
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      {isConnected && (
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={handleShowDebugInfo}
            className="bg-gray-800 text-white px-2 py-1 text-xs rounded"
            title="Debug Info"
          >
            🐛
          </button>
        </div>
      )}

      {showDebugPanel && connectionHealth && (
        <div className="absolute top-12 right-2 z-20 bg-gray-900 border border-gray-600 p-4 rounded text-xs text-white max-w-xs">
          <h3 className="font-bold mb-2">Connection Debug</h3>
          <div className="space-y-1">
            <div>Connected: {connectionHealth.connected ? "✅" : "❌"}</div>
            <div>
              Player Created: {connectionHealth.playerCreated ? "✅" : "❌"}
            </div>
            <div>Room Joined: {connectionHealth.roomJoined ? "✅" : "❌"}</div>
            <div>
              Matchmaking: {connectionHealth.inMatchmaking ? "✅" : "❌"}
            </div>
            <div>
              Duration: {connectionHealth.connectionDuration.toFixed(1)}s
            </div>
            <div>Socket ID: {connectionHealth.socketId?.slice(0, 8)}...</div>
          </div>
          <button
            onClick={handleResetConnection}
            className="mt-3 bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700"
          >
            Reset Connection
          </button>
          <button
            onClick={() => setShowDebugPanel(false)}
            className="mt-2 ml-2 bg-gray-600 text-white px-3 py-1 rounded text-xs hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      )}

      {/* Title overlay */}
      <div
        style={{
          position: "absolute",
          top: 32,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <MetaheadTitle />
      </div>

      {/* Player Selector - Positioned on the left */}
      <div
        style={{
          position: "absolute",
          left: 32,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
        }}
      >
        {/* Level and Coin UI */}
        <div className={`${isConnected ? "block" : "hidden"} mb-4`}>
          <div style={{ marginBottom: 24 }}>
            <LevelProgressBar level={1} xp={0} />
            <CoinDisplay />
          </div>
          <PlayerSelect
            selectedPlayer={selectedPlayer}
            onPlayerChange={handlePlayerChange}
          />
          {/* Redeem Chests Section */}
          <div style={{ marginTop: 32, width: "100%" }}>
            <PixelButton
              variant="menu"
              size="large"
              onClick={() => setShowChestModal(true)}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "flex-start",
              }}
            >
              <img
                src="/chest.png"
                alt="Chest"
                style={{ height: 56, marginRight: 24, marginLeft: 8 }}
              />
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  lineHeight: 1,
                }}
              >
                <span style={{ fontSize: "1.1em", fontWeight: "bold" }}>
                  REDEEM
                </span>
                <span style={{ fontSize: "1.1em", fontWeight: "bold" }}>
                  CHESTS
                </span>
              </span>
            </PixelButton>
            <PixelButton
              variant="menu"
              size="large"
              onClick={() => setShowCoinTransferModal(true)}
            >
              COIN TRANSFER
            </PixelButton>
          </div>
        </div>
      </div>

      {/* Game Buttons - Positioned on the right */}
      <div
        style={{
          position: "absolute",
          right: 32,
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
          width: 320,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          className={`${
            isConnected && playerCreated && !isMatchmaking && !roomJoined
              ? "block"
              : "hidden"
          } mb-4`}
        >
          <PixelButton
            variant="menu"
            size="hald-custom"
            onClick={handleOnlineClick}
            disabled={isMatchmaking || roomJoined}
          >
            <span className="flex flex-col items-center w-full leading-tight">
              <span>ENTER GAME</span>
              <span className="text-xs mt-0.5" style={{ fontWeight: 400 }}>
                ONLINE 1VS1
              </span>
            </span>
          </PixelButton>
        </div>

        {/* Show waiting message when authenticated but player not created yet */}
        <div
          className={`${
            isConnected && isAuthenticated && !playerCreated
              ? "block"
              : "hidden"
          } mb-4`}
        >
          <div className="pixel-card rounded-none p-4 text-center bg-blue-900 border-2 border-yellow-400">
            <span className="text-white font-mono text-sm">
              Connecting to game server...
            </span>
          </div>
        </div>
        <div className="button-row-custom">
          <PixelButton
            variant="menu"
            size="half-custom"
            onClick={() => onSelectModeRef.current("2player")}
          >
            OFFLINE
          </PixelButton>
          <PixelButton
            variant="menu"
            size="half-custom"
            onClick={() => onSelectModeRef.current("vsAI")}
          >
            1 VS AI
          </PixelButton>
        </div>
        <PixelButton variant="menu" size="large" onClick={onMarketplace}>
          MARKETPLACE
        </PixelButton>
      </div>

      <CoinModal
        open={showCoinTransferModal}
        onClose={() => setShowCoinTransferModal(false)}
      >
        <span
          style={{
            color: "#fde047",
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 20,
            marginBottom: 24,
            textAlign: "center",
          }}
        >
          Cross-chain coin transfer coming soon!
        </span>
        <PixelButton
          variant="menu"
          size="half-custom"
          onClick={() => setShowCoinTransferModal(false)}
        >
          CLOSE
        </PixelButton>
      </CoinModal>

      {showChestModal && (
        <ChestRedeemModal onClose={() => setShowChestModal(false)} />
      )}

      {/* Matchmaking Modal */}
      {(isMatchmaking ||
        roomJoined ||
        waitingForPlayers ||
        bothPlayersReady) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
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
              {isMatchmaking && "FINDING MATCH..."}
              {roomJoined &&
                !waitingForPlayers &&
                playersInRoom < 2 &&
                "ROOM JOINED!"}
              {roomJoined &&
                playersInRoom >= 2 &&
                !bothPlayersReady &&
                "READY UP!"}
              {waitingForPlayers && "WAITING FOR PLAYERS"}
              {bothPlayersReady && "STARTING GAME..."}
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
              {isMatchmaking && (
                <>
                  <div style={{ marginBottom: "10px" }}>
                    🔍 Searching for opponents...
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Please wait while we find a match
                  </div>
                </>
              )}

              {roomJoined && (
                <>
                  <div style={{ marginBottom: "10px" }}>
                    🎮 Players in room: {playersInRoom}/2
                  </div>
                  {waitingForPlayers && playersInRoom < 2 && (
                    <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Waiting for another player to join...
                    </div>
                  )}
                  {playersInRoom >= 2 && !bothPlayersReady && (
                    <>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#10b981",
                          marginBottom: "10px",
                        }}
                      >
                        Both players joined! Click READY to start.
                      </div>
                    </>
                  )}
                  {bothPlayersReady && (
                    <div style={{ fontSize: "12px", color: "#10b981" }}>
                      Both players ready! Starting game...
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Loading animation - only show during matchmaking or when both players are ready */}
            {(isMatchmaking || bothPlayersReady) && (
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
            )}

            {/* Ready button - show when both players are in room but not ready */}
            {roomJoined &&
              playersInRoom >= 2 &&
              !bothPlayersReady && (
                <PixelButton
                  variant="menu"
                  size="large"
                  onClick={handleReadyClick}
                  style={{
                    backgroundColor: "#059669",
                    borderColor: "#047857",
                  }}
                >
                  READY UP!
                </PixelButton>
              )}

            {/* Cancel button - only show during matchmaking */}
            {isMatchmaking && (
              <PixelButton
                variant="menu"
                size="large"
                onClick={handleCancelMatchmaking}
                style={{
                  backgroundColor: "#dc2626",
                  borderColor: "#991b1b",
                }}
              >
                CANCEL
              </PixelButton>
            )}
          </div>
        </div>
      )}

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
};

export default GameMenu;
