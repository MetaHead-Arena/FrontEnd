import { useAccount, useReadContract } from "wagmi";
import { PLAYER_NFT_ADDRESS, PLAYER_NFT_ABI } from "../lib/contracts/playerNFT";

import "./PixelUI.css";

const PlayerSelect = ({ selectedPlayer, onPlayerChange }) => {
  const { address } = useAccount();

  const {data, refetch } = useReadContract({
    address: PLAYER_NFT_ADDRESS,
    abi: PLAYER_NFT_ABI,
    functionName: "getTokenCount",
    args: [address],
  });

  // console.log("PlayerSelect data:", data);
  
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
