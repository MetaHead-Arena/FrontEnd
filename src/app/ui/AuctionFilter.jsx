import PixelButton from "./PixelButton";

const statusTabs = ["ALL", "ACTIVE", "PARTICIPATED IN", "FINISHED"];
const rarities = ["ALL", "COMMON", "EPIC", "LEGENDARY"];

const AuctionFilter = ({
  selectedStatus,
  onStatusChange,
  selectedRarity,
  onRarityChange,
}) => {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-3 justify-center items-center">
        {/* Status Tabs */}
        <div className="flex gap-6">
          {statusTabs.map((status) => (
            <PixelButton
              key={status}
              text={status}
              size="small"
              onClick={() => onStatusChange(status)}
              isActive={selectedStatus === status}
            />
          ))}
        </div>
        {/* Rarity Dropdown */}
        <div className="ml-4">
          <select
            value={selectedRarity}
            onChange={(e) => onRarityChange(e.target.value)}
            className="pixelated-font text-xs w-[120px] bg-slate-800 border-2 border-yellow-400 text-white rounded-none px-2 py-2"
          >
            {rarities.map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default AuctionFilter;
