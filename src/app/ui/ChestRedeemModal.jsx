import React, { useState } from "react";
import {
  MYSTERY_BOX_ADDRESS,
  MYSTERY_BOX_ABI,
} from "../lib/contracts/mysteryBox";
import { GAME_TOKEN_ADDRESS, GAME_TOKEN_ABI } from "../lib/contracts/gameToken";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useConfig,
} from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";

const chestTypes = [
  { label: "Common", cost: 10, img: "/common-chest.png" },
  { label: "Rare", cost: 50, img: "/rare-chest.png" },
  { label: "Legendary", cost: 100, img: "/legendary-chest.png" },
];

const ChestRedeemModal = ({ onClose }) => {
  const { address } = useAccount();
  const config = useConfig();
  const [isBusy, setIsBusy] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [pendingTx, setPendingTx] = useState(null);
  const [pendingOpenTx, setPendingOpenTx] = useState(null);

  const { data, refetch } = useReadContract({
    address: MYSTERY_BOX_ADDRESS,
    abi: MYSTERY_BOX_ABI,
    functionName: "getNumOfBox",
    args: [address],
    watch: true,
  });

  // Wait for buy confirmation
  useWaitForTransactionReceipt({
    hash: pendingTx,
    enabled: !!pendingTx,
    onSuccess: () => {
      refetch();
      setPendingTx(null);
      setCurrentStep("");
      setIsBusy(false);
      alert("Box purchased successfully!");
    },
    onError: (err) => {
      console.error("Purchase failed:", err);
      setPendingTx(null);
      setCurrentStep("");
      setIsBusy(false);
      alert("Purchase failed. Try again.");
    },
  });

  // Wait for open confirmation
  useWaitForTransactionReceipt({
    hash: pendingOpenTx,
    enabled: !!pendingOpenTx,
    onSuccess: () => {
      refetch();
      setPendingOpenTx(null);
      setCurrentStep("");
      setIsBusy(false);
      alert("Box opened successfully!");
    },
    onError: (err) => {
      console.error("Open failed:", err);
      setPendingOpenTx(null);
      setCurrentStep("");
      setIsBusy(false);
      alert("Open failed. Try again.");
    },
  });

  const getBoxPrice = (boxType) => {
    const costs = [10, 50, 100];
    return BigInt(costs[boxType] * 10 ** 18);
  };

  const handleBuyBox = async (boxType) => {
    if (!address) return alert("Connect your wallet first.");
    try {
      setIsBusy(true);
      setCurrentStep("Approving tokens...");

      const boxPrice = getBoxPrice(boxType);

      const approveTx = await writeContract(config, {
        address: GAME_TOKEN_ADDRESS,
        abi: GAME_TOKEN_ABI,
        functionName: "approve",
        args: [MYSTERY_BOX_ADDRESS, boxPrice],
      });

      setCurrentStep("Waiting for approval...");
      await waitForTransactionReceipt(config, { hash: approveTx.hash });

      setCurrentStep("Buying box...");
      const buyTx = await writeContract(config, {
        address: MYSTERY_BOX_ADDRESS,
        abi: MYSTERY_BOX_ABI,
        functionName: "buyBox",
        args: [boxType],
      });

      setPendingTx(buyTx.hash); // ✅ only pass the hash
      setCurrentStep("Waiting for purchase confirmation...");
    } catch (err) {
      console.error("Buy error:", err);
      alert("Buy failed. Try again.");
      setIsBusy(false);
      setCurrentStep("");
    }
  };

  const handleOpenBox = async (boxType) => {
    if (!address) return alert("Connect your wallet first.");
    if (!data || !data[boxType] || data[boxType] === 0n)
      return alert("You don't have any boxes of this type!");

    try {
      setIsBusy(true);
      setCurrentStep("Opening box...");

      const openTx = await writeContract(config, {
        address: MYSTERY_BOX_ADDRESS,
        abi: MYSTERY_BOX_ABI,
        functionName: "openBox",
        args: [boxType],
      });

      setPendingOpenTx(openTx.hash); // ✅ only pass the hash
      setCurrentStep("Waiting for open confirmation...");
    } catch (err) {
      console.error("Open error:", err);
      alert("Open failed. Try again.");
      setIsBusy(false);
      setCurrentStep("");
    }
  };

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
                  x {data ? data[i]?.toString() : 0}
                </span>
              </div>
              <div
                style={{ fontWeight: "bold", fontSize: 20, marginBottom: 8 }}
              >
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
                  onClick={() => handleBuyBox(i)}
                  disabled={isBusy || !address}
                  style={{
                    background: isBusy ? "#ccc" : "#ffe066",
                    border: "3px solid #e0b800",
                    borderRadius: 6,
                    fontWeight: "bold",
                    fontSize: 16,
                    padding: "12px 18px",
                    cursor: isBusy || !address ? "not-allowed" : "pointer",
                    boxShadow: "2px 2px #bfa000",
                    opacity: isBusy || !address ? 0.6 : 1,
                    minHeight: "48px",
                  }}
                >
                  {isBusy && currentStep
                    ? currentStep
                    : `BUY (${chest.cost} COINS)`}
                </button>
                <button
                  onClick={() => handleOpenBox(i)}
                  disabled={isBusy || !address || !data || data[i] === 0n}
                  style={{
                    background: isBusy ? "#ccc" : "#fff",
                    border: "3px solid #e0b800",
                    borderRadius: 6,
                    fontWeight: "bold",
                    fontSize: 18,
                    padding: "12px 18px",
                    cursor:
                      isBusy || !address || !data || data[i] === 0n
                        ? "not-allowed"
                        : "pointer",
                    boxShadow: "2px 2px #bfa000",
                    opacity:
                      isBusy || !address || !data || data[i] === 0n ? 0.6 : 1,
                  }}
                >
                  {isBusy && currentStep.startsWith("Opening")
                    ? "OPENING..."
                    : "OPEN"}
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
