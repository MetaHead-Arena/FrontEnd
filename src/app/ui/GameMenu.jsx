import { useState, useEffect } from "react";
// import GameBackGround from "../assets/GameBackGround.png"; // Not needed in Next.js
import PixelButton from "./PixelButton";
import PlayerSelect from "./PlayerSelect";
import MetaheadTitle from "./MetaheadTitle";
import ChestRedeemModal from "./ChestRedeemModal";
import LevelProgressBar from "./LevelProgressBar";
import CoinDisplay from "./CoinDisplay";
import CoinModal from "./CoinModal";
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
  const [showCoinTransferModal, setShowCoinTransferModal] = useState(false);

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
    };

    const handlePlayerJoinedRoom = (data) => {
      console.log("Player joined room in GameMenu:", data);
      // Use players array length from backend data
      const currentPlayers = data.players
        ? data.players.length
        : socketService.getPlayersInRoom();
      setPlayersInRoom(currentPlayers);

      // If we have 2 players, start the game (loading screen will handle player-ready)
      if (currentPlayers >= 2) {
        setTimeout(() => {
          setWaitingForPlayers(false);
          onSelectMode("online"); // This will trigger the loading screen
        }, 1000);
      }
    };

    const handlePlayerReady = (data) => {
      console.log("Player ready in GameMenu:", data);
      // Both players are ready, game should be running now
      // Reset states since game has started
      setRoomJoined(false);
      setWaitingForPlayers(false);
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
  }, [isAuthenticated, onSelectMode]);

  // Reset player created state when user disconnects
  useEffect(() => {
    if (!isAuthenticated) {
      setPlayerCreated(false);
      setIsMatchmaking(false);
      setRoomJoined(false);
      setPlayersInRoom(0);
      setWaitingForPlayers(false);
    }
  }, [isAuthenticated]);

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
        <div>
          <div className={`${isConnected ? "hidden" : "block"} `}>
            <CustomConnectButton />
          </div>
          <span className={"address" + (isConnected ? " block" : " hidden")}>
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </span>
        </div>
        <div>
          <div className={`${isConnected ? "block" : "hidden"} `}>
            <CustomConnectButton />
          </div>
        </div>
      </div>
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
            onClick={() => onSelectMode("2player")}
          >
            OFFLINE
          </PixelButton>
          <PixelButton
            variant="menu"
            size="half-custom"
            onClick={() => onSelectMode("vsAI")}
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
      {(isMatchmaking || roomJoined || waitingForPlayers) && (
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
              {roomJoined && !waitingForPlayers && "ROOM JOINED!"}
              {waitingForPlayers && "WAITING FOR PLAYERS"}
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
                  {playersInRoom >= 2 && (
                    <div style={{ fontSize: "12px", color: "#10b981" }}>
                      All players ready! Starting game...
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Loading animation */}
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
