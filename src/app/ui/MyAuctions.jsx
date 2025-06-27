import React, { useState } from "react";
import PixelButton from "./PixelButton";
import InputBid from "./InputBid";

const MyAuctions = ({ auctions, onEdit, onDelete, onEnd }) => {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBid, setEditBid] = useState("");

  const startEdit = (auction) => {
    setEditingId(auction.id);
    setEditTitle(auction.title);
    setEditBid(
      String(
        parseFloat(
          String(auction.topBid).replace(/[^\d.,]/g, "").replace(",", ".")
        )
      )
    );
  };

  const handleEditSave = (id) => {
    onEdit(id, { title: editTitle, topBid: `${parseFloat(editBid).toFixed(2)} MHcoin` });
    setEditingId(null);
    setEditTitle("");
    setEditBid("");
  };

  const handleCreateAuction = (newAuction) => {
    setAuctions([{ ...newAuction, id: Date.now(), owner: true }, ...auctions]);
  };

  if (!auctions || auctions.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="pixel-card rounded-none p-6 inline-block">
          <p className="text-white pixelated-font text-sm">
            YOU HAVE NO AUCTIONS
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {auctions.map((auction) => (
        <div key={auction.id || auction.title} className="pixel-card p-4 flex flex-col gap-2">
          <div className="flex flex-col items-center">
            <img
              src={auction.playerImg}
              alt={auction.title}
              className="w-16 h-16 mb-2"
              style={{ imageRendering: "pixelated" }}
            />
            {editingId === auction.id ? (
              <>
                <InputBid
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="pixelated-font text-xs mb-1"
                />
                <InputBid
                  type="number"
                  step="0.01"
                  value={editBid}
                  onChange={e => setEditBid(e.target.value)}
                  className="pixelated-font text-xs mb-1"
                />
              </>
            ) : (
              <>
                <h4 className="text-white pixelated-font text-xs">{auction.title}</h4>
                <p className="text-yellow-400 pixelated-font text-xs">{auction.topBid}</p>
                <p className="text-gray-400 pixelated-font text-xs">{auction.numberOfBids} BIDS</p>
                <p className="text-white pixelated-font text-xs">{auction.countdown}</p>
                {auction.ended && (
                  <span className="text-red-400 pixelated-font text-xs">ENDED</span>
                )}
              </>
            )}
          </div>
          <div className="flex gap-2 justify-center mt-2">
            {editingId === auction.id ? (
              <>
                <PixelButton
                  text="Save"
                  size="small"
                  onClick={() => handleEditSave(auction.id)}
                />
                <PixelButton
                  text="Cancel"
                  size="small"
                  onClick={() => setEditingId(null)}
                />
              </>
            ) : (
              <>
                <PixelButton
                  text="Edit"
                  size="small"
                  onClick={() => startEdit(auction)}
                />
                <PixelButton
                  text="Delete"
                  size="small"
                  onClick={() => onDelete(auction.id)}
                />
                {!auction.ended && (
                  <PixelButton
                    text="End"
                    size="small"
                    onClick={() => onEnd(auction.id)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default MyAuctions;
