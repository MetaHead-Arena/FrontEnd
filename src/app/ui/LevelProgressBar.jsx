import React, { useEffect, useMemo } from "react";
import { useAccount, useReadContract } from "wagmi";
import {
  GAME_ENGINE_ADDRESS,
  GAME_ENGINE_ABI,
} from "../lib/contracts/gameEngine";
import "./PixelUI.css";

const BAR_HEIGHT = 40;
const CIRCLE_SIZE = BAR_HEIGHT;
const BAR_WIDTH = 200;

// Level and XP utility functions
function getXPForLevel(level) {
  if (level < 1) return 0;
  if (level == 1) return 100;
  return Math.floor((100 * level * (100 + level)) / 100);
}

function getLevelFromXP(totalXP) {
  if (totalXP < 100) return 0;
  if (totalXP == 100) return 1;

  let left = 1;
  let right = 255;

  while (left < right) {
    const mid = Math.floor((left + right + 1) / 2);
    const requiredXP = getXPForLevel(mid);

    if (totalXP >= requiredXP) {
      left = mid;
    } else {
      right = mid - 1;
    }
  }

  return left;
}

const LevelProgressBar = () => {
  const [XPData, setXPData] = React.useState(null);
  const { address } = useAccount();

  const { data: xp } = useReadContract({
    address: GAME_ENGINE_ADDRESS,
    abi: GAME_ENGINE_ABI,
    functionName: "getPlayerXP",
    args: [address],
    watch: false,
  });

  useEffect(() => {
    if (xp !== undefined) {
      // console.log("XP data received:", xp);
      setXPData(xp);
    } else {
      // console.log("No XP data available yet");
      setXPData(null);
    }
  }, [xp]);

  const totalXP = xp ? Number(xp) : 0;

  const currentLevel = useMemo(() => getLevelFromXP(totalXP), [totalXP]);
  const currentLevelXP = useMemo(
    () => getXPForLevel(currentLevel),
    [currentLevel]
  );
  const nextLevelXP = useMemo(
    () => getXPForLevel(currentLevel + 1),
    [currentLevel]
  );

  const progressXP = totalXP - currentLevelXP;
  const xpForNext = nextLevelXP - currentLevelXP;
  const percent = xpForNext > 0 ? Math.min(progressXP / xpForNext, 1) : 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        background: "#181c2c",
        border: "4px solid #ffe066",
        boxShadow: "2px 2px #bfa000",
        overflow: "hidden",
        width: CIRCLE_SIZE + BAR_WIDTH,
        minWidth: 180,
        marginBottom: 16,
        imageRendering: "pixelated",
      }}
    >
      {/* Level Circle */}
      <div
        className="font-pixel"
        style={{
          width: CIRCLE_SIZE,
          height: CIRCLE_SIZE,
          background: "#222",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: 18,
          color: "#ffe066",
          textShadow: "2px 2px #222",
          borderRadius: "50%",
          borderRight: "2px solid #ffe066",
          flexShrink: 0,
        }}
      >
        <span className="font-pixel">{currentLevel}</span>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          position: "relative",
          width: BAR_WIDTH,
          height: BAR_HEIGHT,
          display: "flex",
          alignItems: "center",
          background: "transparent",
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${percent * 100}%`,
            background: "#6aff3d",
            borderTopRightRadius: BAR_HEIGHT / 2,
            borderBottomRightRadius: BAR_HEIGHT / 2,
            transition: "width 0.3s ease-in-out",
            zIndex: 1,
          }}
        />

        {/* Text */}
        <span
          className="font-pixel"
          style={{
            position: "relative",
            width: "100%",
            textAlign: "center",
            color: "#fff",
            fontWeight: "bold",
            fontFamily: "monospace",
            fontSize: 16,
            textShadow: "2px 2px #000",
            letterSpacing: 1,
            zIndex: 2,
          }}
        >
          <span className="font-pixel">
            {progressXP}/{xpForNext} XP
          </span>
        </span>
      </div>
    </div>
  );
};

export default LevelProgressBar;
