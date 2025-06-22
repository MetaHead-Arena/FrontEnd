import React, { useEffect, useState, memo } from "react";
import { formatUnits } from "viem"; // ✅ Built-in in wagmi/viem
import { useAccount, useReadContract } from "wagmi";
import { GAME_TOKEN_ADDRESS, GAME_TOKEN_ABI } from "../lib/contracts/gameToken";

// Animated coin sprite frames
const coinFrames = [
  "/coin1.png",
  "/coin2.png",
  "/coin3.png",
  "/coin4.png",
  "/coin5.png",
  "/coin6.png",
  "/coin7.png",
];

const AnimatedCoin = memo(() => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % coinFrames.length);
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <img
      src={coinFrames[frame]}
      alt="Coin"
      style={{ width: 36, height: 36, marginRight: 12 }}
    />
  );
});
AnimatedCoin.displayName = "AnimatedCoin";

const CoinDisplay = () => {
  const { address } = useAccount();
  const [displayBalance, setDisplayBalance] = useState("0");

  const { data } = useReadContract({
    address: GAME_TOKEN_ADDRESS,
    abi: GAME_TOKEN_ABI,
    functionName: "balanceOf",
    args: [address],
    watch: true, // ✅ keep updated on block changes
  });

  useEffect(() => {
    if (data) {
      try {
        const humanReadable = formatUnits(data, 18); // ⬅️ assumes 18 decimals
        // console.log("Human readable balance", humanReadable);

        setDisplayBalance(humanReadable);
      } catch (err) {
        console.error("Error formatting balance:", err);
        setDisplayBalance("0");
      }
    }
  }, [data]);

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <AnimatedCoin />
      <span
        style={{
          fontFamily: "monospace",
          fontWeight: "bold",
          fontSize: 22,
          color: "#FFD700",
          textShadow: "2px 2px #bfa000",
          letterSpacing: 2,
        }}
      >
        {displayBalance}
      </span>
    </div>
  );
};

export default CoinDisplay;
