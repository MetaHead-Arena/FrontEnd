import React from "react";
import {
  MYSTERY_BOX_ADDRESS,
  MYSTERY_BOX_ABI,
} from "../lib/contracts/mysteryBox";
import { useAccount, useReadContract } from "wagmi";

const commonChestImg = "/common-chest.png";
const rareChestImg = "/rare-chest.png";
const legendaryChestImg = "/legendary-chest.png";

const chestTypes = [
  { label: "Common", cost: 5, img: commonChestImg },
  { label: "Rare", cost: 10, img: rareChestImg },
  { label: "Legendary", cost: 25, img: legendaryChestImg },
];

const ChestRedeemModal = ({ onClose }) => {
  const { address } = useAccount();

  const { data, refetch } = useReadContract({
    address: MYSTERY_BOX_ADDRESS,
    abi: MYSTERY_BOX_ABI,
    functionName: "getNumOfBox",
    args: [address],
    watch: true, // optional: auto-update on block changes
  });

  // console.log("ChestRedeemModal data:", data); // Array of counts like [0n, 1n, 2n]

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "66vw",
          maxWidth: 700,
          minHeight: 400,
          background: "#ffe066",
          border: "6px solid #e0b800",
          borderRadius: 12,
          boxShadow: "0 0 24px #0008",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: 32,
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 24,
            background: "none",
            border: "none",
            fontSize: 32,
            fontWeight: "bold",
            color: "#333",
            cursor: "pointer",
            zIndex: 10,
          }}
          aria-label="Close"
        >
          ×
        </button>
        <h2
          style={{
            fontFamily: "inherit",
            fontSize: 32,
            marginBottom: 24,
            letterSpacing: 2,
            textShadow: "2px 2px #fff",
          }}
        >
          REDEEM CHESTS
        </h2>

        <div
          style={{
            display: "flex",
            gap: 40,
            justifyContent: "center",
            width: "100%",
          }}
        >
          {chestTypes.map((chest, i) => (
            <div
              key={chest.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: 140,
              }}
            >
              <div style={{ position: "relative", marginBottom: 8 }}>
                <img
                  src={chest.img}
                  alt={chest.label}
                  style={{ width: 100, height: 100 }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 6,
                    right: 10,
                    background: "#222",
                    color: "#ffe066",
                    fontWeight: "bold",
                    fontFamily: "monospace",
                    fontSize: 18,
                    borderRadius: 8,
                    padding: "2px 10px",
                    border: "2px solid #e0b800",
                    boxShadow: "1px 1px #bfa000",
                  }}
                >
                  x {data ? data[i]?.toString() : null}
                </span>
              </div>
              <div style={{ fontWeight: "bold", fontSize: 20, marginBottom: 8 }}>
                {chest.label}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  width: "100%",
                }}
              >
                <button
                  style={{
                    background: "#ffe066",
                    border: "3px solid #e0b800",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    fontWeight: "bold",
                    fontSize: 18,
                    padding: "12px 18px",
                    cursor: "pointer",
                    boxShadow: "2px 2px #bfa000",
                  }}
                >
                  BUY ({chest.cost} COINS)
                </button>
                <button
                  style={{
                    background: "#fff",
                    border: "3px solid #e0b800",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    fontWeight: "bold",
                    fontSize: 18,
                    padding: "12px 18px",
                    cursor: "pointer",
                    boxShadow: "2px 2px #bfa000",
                  }}
                >
                  OPEN
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChestRedeemModal;
