import React, { useState, useEffect, useRef } from "react";
import PixelButton from "./PixelButton";
import { Progress } from "./Progress";
import InputBid from "./InputBid";

const AuctionCard = ({
  id,
  rarity,
  title,
  countdown,
  topBid,
  rarityColor,
  numberOfBids = 5,
  playerImg,
  status,
  isParticipated,
  onParticipate,
}) => {
  const [showBidInput, setShowBidInput] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [bidMessageType, setBidMessageType] = useState("error"); // "error" or "success"
  const [currentTopBid, setCurrentTopBid] = useState(topBid);
  const [currentNumberOfBids, setCurrentNumberOfBids] = useState(numberOfBids);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  // Progress bar logic based on countdown
  useEffect(() => {
    if (!countdown) return;
    const [hours, minutes, seconds] = countdown.split(":").map(Number);
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const totalAuctionTime = 24 * 3600; // 24 hours
    const percent = Math.max(
      0,
      Math.min(
        100,
        ((totalAuctionTime - totalSeconds) / totalAuctionTime) * 100
      )
    );
    setProgress(percent);
  }, [countdown]);

  // Focus input when shown
  useEffect(() => {
    if (showBidInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showBidInput]);

  // Helper to get numeric value from bid string
  const getCurrentBidValue = () =>
    parseFloat(
      String(currentTopBid)
        .replace(/[^\d.,]/g, "")
        .replace(",", ".")
    );

  // Handle bid submission
  const handleBid = () => {
    setBidMessage("");
    setBidMessageType("error");
    const currentBid = getCurrentBidValue();
    const newBid = parseFloat(bidAmount);

    if (!bidAmount || bidAmount.trim() === "") {
      setBidMessage("Please enter a bid amount");
      return;
    }
    if (isNaN(newBid)) {
      setBidMessage("Please enter a valid number");
      return;
    }
    if (newBid <= 0) {
      setBidMessage("Bid can't be zero or negative");
      return;
    }
    if (newBid <= currentBid) {
      setBidMessage("Your bid must be higher than the current bid");
      return;
    }

    // Success
    setCurrentTopBid(`${newBid.toFixed(2)} MHcoin`);
    setCurrentNumberOfBids((n) => n + 1);
    setBidMessage("Bid placed successfully!");
    setBidMessageType("success");
    setBidAmount("");
    setShowBidInput(false);

    // Mark as participated
    if (onParticipate && id) {
      onParticipate(id);
    }

    // Hide success message after 3 seconds
    setTimeout(() => {
      setBidMessage("");
    }, 3000);
  };

  // Handle Enter key in input
  const handleInputKeyDown = (e) => {
    if (e.key === "Enter") {
      handleBid();
    }
  };

  return (
    <div className="pixel-card rounded-none overflow-hidden">
      {/* Rarity Header */}
      <div className="bg-blue-900 border-b-4 border-yellow-400 p-3 text-center relative">
        <h3 className={`pixelated-font text-sm tracking-wider ${rarityColor}`}>
          {rarity}
        </h3>
        {/* Status Indicators */}
        <div className="absolute top-1 right-1 flex gap-1">
          {isParticipated && (
            <div className="w-2 h-2 bg-green-400 rounded-none" title="Participated"></div>
          )}
          {status === "FINISHED" && (
            <div className="w-2 h-2 bg-red-400 rounded-none" title="Finished"></div>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 space-y-4">
        {/* Player Image */}
        <div className="bg-cyan-400 border-4 border-blue-900 aspect-square flex items-center justify-center pixel-border">
          {playerImg ? (
            <img
              src={playerImg}
              alt={title}
              className="w-16 h-16"
              style={{ imageRendering: "pixelated" }}
            />
          ) : (
            <div className="w-16 h-16 bg-slate-700" />
          )}
        </div>

        {/* Player Info */}
        <div className="text-center space-y-2">
          {/* Fixed height for title */}
          <div className="min-h-[32px] flex items-center justify-center">
            <h4 className="text-white pixelated-font text-xs break-words w-full">
              {title}
            </h4>
          </div>
          {/* Fixed height for countdown label and value */}
          <div className="min-h-[40px] flex flex-col items-center justify-center bg-blue-950 text-center py-2 -mx-4 px-4">
            <p className="text-white pixelated-font text-xs">COUNTDOWN</p>
            <p className="text-white pixelated-font text-sm break-words w-full">
              {countdown}
            </p>
          </div>
          {/* Progress Bar */}
          <Progress value={progress} />
        </div>

        {/* Bid Info */}
        <div className="text-center space-y-1">
          <p className="text-yellow-400 pixelated-font text-xs">TOP BID</p>
          <p className="text-yellow-400 pixelated-font text-sm">
            {currentTopBid}
          </p>
          <p className="text-gray-400 pixelated-font text-xs">
            {currentNumberOfBids} BIDS
          </p>
        </div>

        {/* Place Bid Section */}
        <div className="space-y-3">
          {status === "FINISHED" ? (
            <div className="text-center">
              <div className="pixel-card bg-red-900 border-red-400 p-2">
                <p className="pixelated-font text-xs text-red-400">
                  AUCTION FINISHED
                </p>
              </div>
            </div>
          ) : !showBidInput ? (
            <div className="flex flex-col items-center">
              <PixelButton
                text="PLACE BID"
                size="small"
                onClick={() => setShowBidInput(true)}
              />
              {/* Show success message under the button if it exists and is success */}
              {bidMessage && bidMessageType === "success" && (
                <p className="pixelated-font text-xs text-center text-green-400 mt-2">
                  {bidMessage}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <InputBid
                ref={inputRef}
                type="number"
                step="0.01"
                placeholder="Enter bid amount"
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                onKeyDown={handleInputKeyDown}
                className="pixelated-font text-xs"
              />
              {bidMessage && bidMessageType !== "success" && (
                <p className="pixelated-font text-xs text-center text-red-400">
                  {bidMessage}
                </p>
              )}
              <div className="flex gap-2 justify-center">
                <PixelButton text="BID" size="small" onClick={handleBid} />
                <PixelButton
                  text="CANCEL"
                  size="small"
                  onClick={() => {
                    setShowBidInput(false);
                    setBidAmount("");
                    setBidMessage("");
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuctionCard;
