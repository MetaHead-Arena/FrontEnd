import { useAccount, useReadContract, useChainId } from "wagmi";
import { useEffect, useState } from "react";
import { PLAYER_NFT_ADDRESS, PLAYER_NFT_ABI } from "../lib/contracts/playerNFT";
import { fetchMetadataFromURI } from "../lib/fetchNFTMetadata";

import "./PixelUI.css";

const PlayerSelect = ({ ownedImages, selectedIdx, onPlayerChange }) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [metadata, setMetadata] = useState(null);

  const { data, refetch } = useReadContract({
    address: PLAYER_NFT_ADDRESS[chainId],
    abi: PLAYER_NFT_ABI,
    functionName: "getTokenCount",
    args: [address],
  });

  // console.log("PlayerSelect data:", data);

  useEffect(() => {
    const fetchImage = async () => {
      if (!ownedImages || !ownedImages.length) return;
      const selected = ownedImages[selectedIdx];
      if (!selected || !selected.url) return;
      const data = await fetchMetadataFromURI(selected.url);
      setMetadata(data);
    };
    fetchImage();
  }, [ownedImages, selectedIdx]);

  if (!ownedImages || !ownedImages.length) {
    return (
      <div
        style={{
          color: "#fde047",
          fontFamily: '"Press Start 2P", monospace',
          marginBottom: 16,
        }}
      >
        No player NFTs found.
      </div>
    );
  }

  return (
    <div className="player-select">
      <div className="player-select-header">SELECT PLAYER</div>
      <div
        className="player-select-preview"
        style={{
          background: "#181825",
          width: 260,
          height: 160,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px auto",
          borderBottom: "2px solid #23234c",
          borderTop: "2px solid #23234c",
        }}
      >
        <button
          onClick={() => onPlayerChange("prev")}
          style={{
            fontSize: 40,
            background: "none",
            border: "none",
            color: "#fde047",
            cursor: "pointer",
            userSelect: "none",
            marginRight: 12,
            outline: "none",
          }}
          aria-label="Previous"
        >
          &#8592;
        </button>
        {metadata?.image ? (
          <img
            src={metadata.image}
            alt={metadata.name}
            style={{
              width: 110,
              height: 110,
              background: "none",
              objectFit: "contain",
              display: "block",
              margin: "0 8px",
              border: "none",
              boxShadow: "none",
            }}
          />
        ) : (
          <span style={{ color: "#fde047" }}>Loading...</span>
        )}
        <button
          onClick={() => onPlayerChange("next")}
          style={{
            fontSize: 40,
            background: "none",
            border: "none",
            color: "#fde047",
            cursor: "pointer",
            userSelect: "none",
            marginLeft: 12,
            outline: "none",
          }}
          aria-label="Next"
        >
          &#8594;
        </button>
      </div>
      {/* Player stats section */}
      {metadata && (
        <div
          style={{
            background: "#23234c",
            borderRadius: 10,
            marginTop: 8,
            padding: "10px 12px",
            color: "#fde047",
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 12,
            minHeight: 110, // Set a fixed height
            maxHeight: 110, // Prevent growing
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            overflow: "hidden",
          }}
        >
          <div style={{ fontWeight: "bold", fontSize: 14, marginBottom: 4 }}>
            {metadata.name}
          </div>

          <div
            className="player-select-stats"
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              overflowY: "auto",
              flex: 1,
              maxHeight: 50,
            }}
          >
            {metadata.attributes?.map((attr) => (
              <div
                key={attr.trait_type}
                style={{
                  background: "#181825",
                  borderRadius: 6,
                  padding: "2px 8px",
                  margin: "2px 0",
                  color: "#fde047",
                  fontSize: 11,
                  minWidth: 70,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{attr.trait_type}</span>
                <span style={{ fontWeight: "bold", marginLeft: 6 }}>
                  {attr.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlayerSelect;
