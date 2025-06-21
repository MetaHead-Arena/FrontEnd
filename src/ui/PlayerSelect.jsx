import React from "react";
import "./PixelUI.css";

const PlayerSelect = ({ selectedPlayer, onPlayerChange }) => {
  return (
    <div className="player-select">
      <div className="player-select-header">SELECT PLAYER</div>
      <div className="player-select-preview">
        {/* Player Avatar or preview logic here */}
        <div className="player-preview-placeholder">PLAYER PREVIEW</div>
      </div>
    </div>
  );
};

export default PlayerSelect;
