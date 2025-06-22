import { useState } from "react";
// import GameBackGround from "../assets/GameBackGround.png"; // Not needed in Next.js
import PixelButton from "./PixelButton";
import PlayerSelect from "./PlayerSelect";
import MetaheadTitle from "./MetaheadTitle";
import ChestRedeemModal from "./ChestRedeemModal";
import LevelProgressBar from "./LevelProgressBar";
import CoinDisplay from "./CoinDisplay";
import { useReadContract } from "wagmi";

import { useAccount } from "wagmi";
import CustomConnectButton from "./CustomConnectButton";

const GameBackGround = "/GameBackGround.png";

const GameMenu = ({ onSelectMode }) => {
  const { address, isConnected } = useAccount();
  const [selectedPlayer, setSelectedPlayer] = useState(1);
  const [showChestModal, setShowChestModal] = useState(false);

  const handlePlayerChange = (direction) => {
    if (direction === "next") {
      setSelectedPlayer((prev) => (prev === 4 ? 1 : prev + 1));
    } else {
      setSelectedPlayer((prev) => (prev === 1 ? 4 : prev - 1));
    }
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
              className="w-full h-[72px] text-[2rem] flex items-center justify-center"
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
        <div className={`${isConnected ? "block" : "hidden"} mb-4`}>
          <PixelButton className="w-full h-[72px] text-[2rem] leading-none px-0 py-0 flex flex-col items-center justify-center">
            ENTER GAME
            <span className="text-[1.1rem] mt-1">ONLINE 1VS1</span>
          </PixelButton>
        </div>
        <div className="button-row-custom">
          <PixelButton
            className="button-half-custom"
            onClick={() => onSelectMode("2player")}
          >
            OFFLINE
          </PixelButton>
          <PixelButton
            className="button-half-custom"
            onClick={() => onSelectMode("vsAI")}
          >
            1 VS AI
          </PixelButton>
        </div>
        <PixelButton className="w-full h-[60px] text-[2rem] flex items-center justify-center">
          MARKETPLACE
        </PixelButton>
      </div>

      {showChestModal && (
        <ChestRedeemModal onClose={() => setShowChestModal(false)} />
      )}
    </div>
  );
};

export default GameMenu;
