import PixelButton from "./PixelButton";

const MatchmakingModal = ({
  isMatchmaking,
  roomJoined,
  waitingForPlayers,
  bothPlayersReady,
  playersInRoom,
  onCancel,
}) => {
  if (!isMatchmaking && !roomJoined && !waitingForPlayers && !bothPlayersReady) {
    return null;
  }

  const getTitle = () => {
    if (isMatchmaking) return "FINDING MATCH...";
    if (roomJoined && !waitingForPlayers && playersInRoom < 2) return "ROOM JOINED!";
    if (roomJoined && playersInRoom >= 2 && !bothPlayersReady) return "LOADING GAME...";
    if (waitingForPlayers) return "WAITING FOR PLAYERS";
    if (bothPlayersReady) return "STARTING GAME...";
    return "";
  };

  const getMessage = () => {
    if (isMatchmaking) {
      return (
        <>
          <div style={{ marginBottom: "10px" }}>
            🔍 Searching for opponents...
          </div>
          <div style={{ fontSize: "12px", color: "#94a3b8" }}>
            Please wait while we find a match
          </div>
        </>
      );
    }
    if (roomJoined) {
      return (
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
                Both players joined! Loading game...
              </div>
            </>
          )}
          {bothPlayersReady && (
            <div style={{ fontSize: "12px", color: "#10b981" }}>
              Both players ready! Starting game...
            </div>
          )}
        </>
      );
    }
    return null;
  };

  return (
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
          {getTitle()}
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
          {getMessage()}
        </div>

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

        {isMatchmaking && (
          <PixelButton
            variant="menu"
            size="large"
            onClick={onCancel}
            style={{
              backgroundColor: "#dc2626",
              borderColor: "#991b1b",
            }}
          >
            CANCEL
          </PixelButton>
        )}
      </div>
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

export default MatchmakingModal;
