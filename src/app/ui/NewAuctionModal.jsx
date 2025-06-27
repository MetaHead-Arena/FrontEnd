import React, { useState } from "react";
import PixelButton from "./PixelButton";
import InputBid from "./InputBid";

const RARITIES = ["COMMON", "EPIC", "LEGENDARY"];

const NewAuctionModal = ({ open, onClose, onCreate }) => {
  const [title, setTitle] = useState("");
  const [rarity, setRarity] = useState(RARITIES[0]);
  const [startingBid, setStartingBid] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !startingBid || isNaN(parseFloat(startingBid)) || parseFloat(startingBid) <= 0) {
      setError("Please fill all fields with valid values.");
      return;
    }
    onCreate({
      title,
      rarity,
      topBid: `${parseFloat(startingBid).toFixed(2)} MHcoin`,
      rarityColor: rarity === "COMMON" ? "text-white" : rarity === "EPIC" ? "text-purple-400" : "text-yellow-400",
      numberOfBids: 0,
      playerImg: image,
      countdown: "24:00:00",
    });
    setTitle("");
    setRarity(RARITIES[0]);
    setStartingBid("");
    setImage("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="pixel-card p-8 w-full max-w-md relative">
        <button
          className="absolute top-2 right-2 text-yellow-400 text-2xl"
          onClick={onClose}
          aria-label="Close"
        >×</button>
        <h2 className="text-center pixelated-font text-lg mb-4 text-yellow-400">Create New Auction</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <InputBid
            placeholder="Player Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="pixelated-font text-xs"
          />
          <select
            value={rarity}
            onChange={e => setRarity(e.target.value)}
            className="pixelated-font text-xs w-full bg-slate-800 border-2 border-yellow-400 text-white rounded-none px-2 py-2"
          >
            {RARITIES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <InputBid
            type="number"
            step="0.01"
            placeholder="Starting Bid (MHcoin)"
            value={startingBid}
            onChange={e => setStartingBid(e.target.value)}
            className="pixelated-font text-xs"
          />
          <InputBid
            placeholder="Image URL"
            value={image}
            onChange={e => setImage(e.target.value)}
            className="pixelated-font text-xs"
          />
          {error && <p className="text-red-400 pixelated-font text-xs text-center">{error}</p>}
          <div className="flex gap-3 justify-center mt-4">
            <PixelButton text="Create" size="medium" type="submit" />
            <PixelButton text="Cancel" size="medium" type="button" onClick={onClose} />
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewAuctionModal;