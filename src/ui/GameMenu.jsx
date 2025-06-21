import React, { useState } from "react";
// import GameBackGround from "../assets/GameBackGround.png"; // Not needed in Next.js
import PixelButton from "./PixelButton";
import PlayerSelect from "./PlayerSelect";
import MetaheadTitle from "./MetaheadTitle";

const GameBackGround = "/GameBackGround.png";

const GameMenu = ({ onSelectMode }) => {
  const [selectedPlayer, setSelectedPlayer] = useState(1);

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
        width: "100vw",
        height: "100vh",
        minHeight: "100vh",
        minWidth: "100vw",
        position: "relative",
        backgroundImage: `url(${GameBackGround})`,
        backgroundSize: "cover",
        backgroundPosition: "center bottom",
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        overflow: "hidden",
      }}
    >
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
        <PlayerSelect
          selectedPlayer={selectedPlayer}
          onPlayerChange={handlePlayerChange}
        />
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
        <PixelButton className="w-full h-[72px] text-[2rem] leading-none px-0 py-0 flex flex-col items-center justify-center">
          ENTER GAME
          <span className="text-[1.1rem] mt-1">ONLINE 1VS1</span>
        </PixelButton>
        <div className="button-row-custom">
          <PixelButton className="button-half-custom" onClick={() => onSelectMode('2player')}>OFFLINE</PixelButton>
          <PixelButton className="button-half-custom" onClick={() => onSelectMode('vsAI')}>1 VS AI</PixelButton>
        </div>
        <PixelButton className="w-full h-[60px] text-[2rem] flex items-center justify-center">
          MARKETPLACE
        </PixelButton>
      </div>
    </div>
  );
};

export default GameMenu;
