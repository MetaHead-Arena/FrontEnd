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
  useChainId,
} from "wagmi";
import { writeContract, waitForTransactionReceipt } from "wagmi/actions";

const commonChestImg = "/common-chest.png";
const rareChestImg = "/rare-chest.png";
const legendaryChestImg = "/legendary-chest.png";

const chestTypes = [
  { label: "Common", cost: 10, img: commonChestImg },
  { label: "Rare", cost: 50, img: rareChestImg },
  { label: "Legendary", cost: 100, img: legendaryChestImg },
];

const ChestRedeemModal = ({ onClose }) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const [buyingBoxType, setBuyingBoxType] = useState(null); // Track which box is being bought
  const [openingBoxType, setOpeningBoxType] = useState(null); // Track which box is being opened
  const [pendingTx, setPendingTx] = useState(null); // Track pending transaction
  const [pendingOpenTx, setPendingOpenTx] = useState(null); // Track pending open transaction
  const [currentStep, setCurrentStep] = useState(""); // Track current step

  const { data, refetch } = useReadContract({
    address: MYSTERY_BOX_ADDRESS[chainId],
    abi: MYSTERY_BOX_ABI,
    functionName: "getNumOfBox",
    args: [address],
    watch: true, // optional: auto-update on block changes
  });

  // Hook for waiting for transaction confirmation (only for the final buy transaction)
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: pendingTx,
    enabled: !!pendingTx,
    onSuccess: () => {
      // Refresh the box counts when transaction is confirmed
      refetch();
      setPendingTx(null);
      setBuyingBoxType(null);
      setCurrentStep("");
      alert("Box purchased successfully!");
    },
    onError: (error) => {
      console.error("Purchase transaction failed:", error);
      setPendingTx(null);
      setBuyingBoxType(null);
      setCurrentStep("");
      alert("Purchase transaction failed. Please try again.");
    },
  });

  // Hook for waiting for open transaction confirmation
  const { isLoading: isOpenConfirming } = useWaitForTransactionReceipt({
    hash: pendingOpenTx,
    enabled: !!pendingOpenTx,
    onSuccess: (receipt) => {
      // Refresh the box counts when transaction is confirmed
      refetch();
      setPendingOpenTx(null);
      setOpeningBoxType(null);
      alert("Box opened successfully!");
    },
    onError: (error) => {
      console.error("Open transaction failed:", error);
      setPendingOpenTx(null);
      setOpeningBoxType(null);
      alert("Open transaction failed. Please try again.");
    },
  });

  // Function to get box price for a specific box type
  const getBoxPrice = (boxType) => {
    const costs = [10, 50, 100]; // Common, Rare, Legendary costs in tokens
    return BigInt(costs[boxType] * 10 ** 18); // Convert to wei (18 decimals)
  };

  // Function to handle opening a box
  const handleOpenBox = async (boxType) => {
    if (!address) {
      alert("Please connect your wallet first!");
      return;
    }
    // Check if user has boxes to open
    if (!data || !data[boxType] || data[boxType] === 0n) {
      alert("You don't have any boxes of this type to open!");
      return;
    }

    try {
      setOpeningBoxType(boxType);

      const openResult = await writeContract(config, {
        address: MYSTERY_BOX_ADDRESS[chainId],
        abi: MYSTERY_BOX_ABI,
        functionName: "openBox",
        args: [boxType],
      });

      setPendingOpenTx(openResult);
    } catch (error) {
      console.error("Error opening box:", error);
      alert("Failed to open box. Please try again.");
      setOpeningBoxType(null);
    }
  };

  // Function to handle the full buy process (approve + buy)
  const handleBuyBox = async (boxType) => {
    if (!address) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      setBuyingBoxType(boxType);
      const boxPrice = getBoxPrice(boxType);

      // Set a timeout to reset states if process takes too long (5 minutes)
      const timeoutId = setTimeout(() => {
        setBuyingBoxType(null);
        setCurrentStep("");
        alert("Transaction timeout. Please try again.");
      }, 5 * 60 * 1000); // 5 minutes

      // Step 1: Approve tokens
      setCurrentStep("Approving tokens...");

      const approveHash = await writeContract(config, {
        address: GAME_TOKEN_ADDRESS[chainId],
        abi: GAME_TOKEN_ABI,
        functionName: "approve",
        args: [MYSTERY_BOX_ADDRESS[chainId], boxPrice],
      });

      setCurrentStep("Waiting for approval confirmation...");

      // Wait for approval transaction to be confirmed
      await waitForTransactionReceipt(config, {
        hash: approveHash,
        timeout: 60000, // 60 seconds timeout
      });

      setCurrentStep("Buying box...");

      // Step 2: Buy the box (after approval is confirmed)
      const buyResult = await writeContract(config, {
        address: MYSTERY_BOX_ADDRESS[chainId],
        abi: MYSTERY_BOX_ABI,
        functionName: "buyBox",
        args: [boxType],
      });

      setPendingTx(buyResult);
      setCurrentStep("Waiting for purchase confirmation...");

      // Clear timeout since we successfully submitted the buy transaction
      clearTimeout(timeoutId);
    } catch (error) {
      console.error("Error in buy process:", error);
      alert("Failed to complete purchase. Please try again.");
      setBuyingBoxType(null);
      setCurrentStep("");
    }
  };

  // Check if a specific box type is being bought
  const isBoxBeingBought = (boxType) => {
    return buyingBoxType === boxType;
  };

  // Check if a specific box type is being opened
  const isBoxBeingOpened = (boxType) => {
    return openingBoxType === boxType;
  };

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
                  disabled={isBoxBeingBought(i) || !address}
                  style={{
                    background: isBoxBeingBought(i) ? "#ccc" : "#ffe066",
                    border: "3px solid #e0b800",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    fontWeight: "bold",
                    fontSize: 16,
                    padding: "12px 18px",
                    cursor:
                      isBoxBeingBought(i) || !address
                        ? "not-allowed"
                        : "pointer",
                    boxShadow: "2px 2px #bfa000",
                    opacity: isBoxBeingBought(i) || !address ? 0.6 : 1,
                    minHeight: "48px",
                  }}
                >
                  {isBoxBeingBought(i)
                    ? currentStep || "PROCESSING..."
                    : `BUY (${chest.cost} COINS)`}
                </button>
                <button
                  onClick={() => handleOpenBox(i)}
                  disabled={
                    isBoxBeingOpened(i) ||
                    !address ||
                    !data ||
                    !data[i] ||
                    data[i] === 0n
                  }
                  style={{
                    background: isBoxBeingOpened(i) ? "#ccc" : "#fff",
                    border: "3px solid #e0b800",
                    borderRadius: 6,
                    fontFamily: "inherit",
                    fontWeight: "bold",
                    fontSize: 18,
                    padding: "12px 18px",
                    cursor:
                      isBoxBeingOpened(i) ||
                      !address ||
                      !data ||
                      !data[i] ||
                      data[i] === 0n
                        ? "not-allowed"
                        : "pointer",
                    boxShadow: "2px 2px #bfa000",
                    opacity:
                      isBoxBeingOpened(i) ||
                      !address ||
                      !data ||
                      !data[i] ||
                      data[i] === 0n
                        ? 0.6
                        : 1,
                  }}
                >
                  {isBoxBeingOpened(i) ? "OPENING..." : "OPEN"}
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
