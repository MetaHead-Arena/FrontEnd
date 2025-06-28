import React, { useState, useMemo, useEffect } from "react";
import { useAccount } from "wagmi";
import AuctionCard from "./AuctionCard";
import PixelButton from "./PixelButton";
import AuctionFilter from "./AuctionFilter";
import MyAuctions from "./MyAuctions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import NewAuctionModal from "./NewAuctionModal";
import { fetchAuctionData } from "../lib/graphql/client";

const auctionData = [
  {
    id: "1",
    rarity: "COMMON",
    title: "COMMON PLAYER #1",
    countdown: "2:15:30",
    topBid: "2.50 MHcoin",
    rarityColor: "#808080",
    numberOfBids: 3,
    playerImg: "/head-1.png",
    status: "ACTIVE",
    isParticipated: false,
    isFinished: false,
    auctionContract: "0x1234567890abcdef1234567890abcdef12345678",
    manager: "0xabcdef1234567890abcdef1234567890abcdef12",
    startPrice: "1000000000000000000",
    endAt: "1719504930",
    blockTimestamp: "1719496930",
    winner: null,
    winningAmount: null,
  },
  {
    id: "2",
    rarity: "EPIC",
    title: "EPIC PLAYER #2",
    countdown: "8:45:12",
    topBid: "5.00 MHcoin",
    rarityColor: "#9333EA",
    numberOfBids: 7,
    playerImg: "/head-2.png",
    status: "ACTIVE",
    isParticipated: true,
    isFinished: false,
    auctionContract: "0x2345678901bcdef2345678901bcdef2345678901",
    manager: "0xbcdef2345678901bcdef2345678901bcdef234567",
    startPrice: "2000000000000000000",
    endAt: "1719527712",
    blockTimestamp: "1719496930",
    winner: null,
    winningAmount: null,
  },
  {
    id: "3",
    rarity: "LEGENDARY",
    title: "LEGENDARY PLAYER #3",
    countdown: "0:00:00",
    topBid: "7.00 MHcoin",
    rarityColor: "#EAB308",
    numberOfBids: 12,
    playerImg: "/head-1.png",
    status: "FINISHED",
    isParticipated: false,
    isFinished: true,
    auctionContract: "0x3456789012cdef3456789012cdef3456789012cd",
    manager: "0xcdef3456789012cdef3456789012cdef34567890",
    startPrice: "3000000000000000000",
    endAt: "1719496930",
    blockTimestamp: "1719410530",
    winner: "0xdef456789012cdef456789012cdef456789012cd",
    winningAmount: "7000000000000000000",
  },
  {
    id: "4",
    rarity: "LEGENDARY",
    title: "LEGENDARY PLAYER #4",
    countdown: "5:00:00",
    topBid: "7.00 MHcoin",
    rarityColor: "#EAB308",
    numberOfBids: 12,
    playerImg: "/head-2.png",
    status: "ACTIVE",
    isParticipated: true,
    isFinished: false,
    auctionContract: "0x456789012cdef456789012cdef456789012cdef4",
    manager: "0xdef456789012cdef456789012cdef456789012cd",
    startPrice: "3000000000000000000",
    endAt: "1719514930",
    blockTimestamp: "1719496930",
    winner: null,
    winningAmount: null,
  },
  {
    id: "5",
    rarity: "LEGENDARY",
    title: "LEGENDARY PLAYER #5",
    countdown: "5:00:00",
    topBid: "7.00 MHcoin",
    rarityColor: "#EAB308",
    numberOfBids: 12,
    playerImg: "/head-2.png",
    status: "ACTIVE",
    isParticipated: false,
    isFinished: false,
    auctionContract: "0x56789012cdef56789012cdef56789012cdef5678",
    manager: "0xef56789012cdef56789012cdef56789012cdef56",
    startPrice: "3000000000000000000",
    endAt: "1719514930",
    blockTimestamp: "1719496930",
    winner: null,
    winningAmount: null,
  },
  {
    id: "6",
    rarity: "COMMON",
    title: "COMMON PLAYER #6",
    countdown: "0:00:00",
    topBid: "7.00 MHcoin",
    rarityColor: "#808080",
    numberOfBids: 12,
    playerImg: "/head-1.png",
    status: "FINISHED",
    isParticipated: true,
    isFinished: true,
    auctionContract: "0x6789012cdef6789012cdef6789012cdef67890123",
    manager: "0xf6789012cdef6789012cdef6789012cdef6789012",
    startPrice: "1000000000000000000",
    endAt: "1719496930",
    blockTimestamp: "1719410530",
    winner: "0x789012cdef789012cdef789012cdef789012cdef7",
    winningAmount: "7000000000000000000",
  },
  {
    id: "7",
    rarity: "EPIC",
    title: "EPIC PLAYER #7",
    countdown: "5:00:00",
    topBid: "7.00 MHcoin",
    rarityColor: "#9333EA",
    numberOfBids: 12,
    playerImg: "/head-2.png",
    status: "ACTIVE",
    isParticipated: false,
    isFinished: false,
    auctionContract: "0x789012cdef789012cdef789012cdef789012cdef7",
    manager: "0x89012cdef789012cdef789012cdef789012cdef78",
    startPrice: "2000000000000000000",
    endAt: "1719514930",
    blockTimestamp: "1719496930",
    winner: null,
    winningAmount: null,
  },
  {
    id: "8",
    rarity: "COMMON",
    title: "COMMON PLAYER #8",
    countdown: "5:00:00",
    topBid: "7.00 MHcoin",
    rarityColor: "#808080",
    numberOfBids: 12,
    playerImg: "/head-1.png",
    status: "ACTIVE",
    isParticipated: true,
    isFinished: false,
    auctionContract: "0x89012cdef89012cdef89012cdef89012cdef89012",
    manager: "0x9012cdef89012cdef89012cdef89012cdef890123",
    startPrice: "1000000000000000000",
    endAt: "1719514930",
    blockTimestamp: "1719496930",
    winner: null,
    winningAmount: null,
  },
  {
    id: "9",
    rarity: "EPIC",
    title: "EPIC PLAYER #9",
    countdown: "0:00:00",
    topBid: "7.00 MHcoin",
    rarityColor: "#9333EA",
    numberOfBids: 12,
    playerImg: "/head-1.png",
    status: "FINISHED",
    isParticipated: false,
    isFinished: true,
    auctionContract: "0x9012cdef9012cdef9012cdef9012cdef9012cdef9",
    manager: "0x012cdef9012cdef9012cdef9012cdef9012cdef90",
    startPrice: "2000000000000000000",
    endAt: "1719496930",
    blockTimestamp: "1719410530",
    winner: "0x12cdef9012cdef9012cdef9012cdef9012cdef901",
    winningAmount: "7000000000000000000",
  },
];

const Marketplace = ({ onBack }) => {
  const { address, isConnected } = useAccount();
  const [selectedRarity, setSelectedRarity] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Function to load auction data
  const loadAuctionData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuctionData(address);
      // setAuctions(data);
      setAuctions([...auctionData]);
    } catch (err) {
      console.error("Failed to load auction data:", err);
      setError("Failed to load auctions. Please try again.");
      // Fallback to dummy data if API fails
      setAuctions([...auctionData]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch auction data from The Graph
  useEffect(() => {
    loadAuctionData();

    // Refresh data every 30 seconds
    const interval = setInterval(loadAuctionData, 30000);

    return () => clearInterval(interval);
  }, [address]);

  const filteredAuctions = useMemo(() => {
    let filtered = auctions;

    // Filter by status
    if (selectedStatus !== "ALL") {
      filtered = filtered.filter((auction) => {
        switch (selectedStatus) {
          case "ACTIVE":
            return auction.status === "ACTIVE";
          case "PARTICIPATED IN":
            return auction.isParticipated === true;
          case "FINISHED":
            return auction.status === "FINISHED";
          default:
            return true;
        }
      });
    }

    // Filter by rarity
    if (selectedRarity !== "ALL") {
      filtered = filtered.filter(
        (auction) => auction.rarity === selectedRarity
      );
    }

    return filtered;
  }, [selectedRarity, selectedStatus, auctions]);

  const myAuctions = useMemo(
    () =>
      auctions.filter(
        (auction) =>
          auction.manager &&
          address &&
          auction.manager.toLowerCase() === address.toLowerCase()
      ),
    [auctions, address]
  );

  const handleCreateAuction = async (newAuction) => {
    // Note: In a real implementation, you would create the auction on-chain here
    // For now, we'll just reload the data to get any new auctions from the blockchain
    setTimeout(() => {
      loadAuctionData();
    }, 2000); // Wait 2 seconds for blockchain confirmation
  };

  const handleEditAuction = async (id, updatedData) => {
    // Note: In a real implementation, you would update the auction on-chain here
    console.log("Edit auction:", id, updatedData);
    // For now, just reload data after a delay
    setTimeout(() => {
      loadAuctionData();
    }, 2000);
  };

  const handleDeleteAuction = async (id) => {
    // Note: In a real implementation, you would cancel/delete the auction on-chain here
    console.log("Delete auction:", id);
    // For now, just reload data after a delay
    setTimeout(() => {
      loadAuctionData();
    }, 2000);
  };

  const handleEndAuction = async (id) => {
    // Note: In a real implementation, you would end the auction on-chain here
    console.log("End auction:", id);
    // For now, just reload data after a delay
    setTimeout(() => {
      loadAuctionData();
    }, 2000);
  };

  const handleParticipate = (id) => {
    setAuctions(
      auctions.map((a) => (a.id === id ? { ...a, isParticipated: true } : a))
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 flex items-center justify-center relative">
      {/* Back to Main Menu Button */}
      <div
        style={{
          position: "fixed",
          left: 32,
          top: "10%",
          zIndex: 50,
        }}
      >
        <PixelButton
          text="BACK TO MAIN MENU"
          size="large"
          className="w-[220px]"
          onClick={onBack}
        />
      </div>

      <div className="w-full max-w-4xl">
        {/* Main Title Banner */}
        <div className="metahead-title mb-8">
          <div className="pixel-card rounded-none p-6 text-center relative">
            <h1 className="metahead-main">METAHEAD MARKETPLACE</h1>
            {/* Wallet Status */}
            <div className="absolute top-2 right-2 flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-none ${
                  isConnected ? "bg-green-400" : "bg-red-400"
                }`}
              ></div>
              <span className="pixelated-font text-xs text-white">
                {isConnected ? "CONNECTED" : "NOT CONNECTED"}
              </span>
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="mb-8 flex justify-center gap-4">
          <PixelButton
            text="NEW AUCTION"
            size="large"
            className="w-[320px] text-lg"
            onClick={() => setShowModal(true)}
          />
          <PixelButton
            text={loading ? "LOADING..." : "REFRESH"}
            size="large"
            className="w-[250px]"
            onClick={loadAuctionData}
            disabled={loading}
          />
        </div>

        <NewAuctionModal
          open={showModal}
          onClose={() => setShowModal(false)}
          onCreate={handleCreateAuction}
        />

        {/* Tabs for different auction views */}
        <Tabs defaultValue="all-auctions" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 pixel-card rounded-none p-1">
            <TabsTrigger
              value="all-auctions"
              className="pixelated-font text-xs tracking-wider data-[state=active]:bg-blue-900 data-[state=active]:text-yellow-400 rounded-none p-2"
            >
              ALL AUCTIONS
            </TabsTrigger>
            <TabsTrigger
              value="my-auctions"
              className="pixelated-font text-xs tracking-wider data-[state=active]:bg-blue-900 data-[state=active]:text-yellow-400 rounded-none"
            >
              MY AUCTIONS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all-auctions" className="space-y-6">
            {/* Filter Component */}
            <AuctionFilter
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              selectedRarity={selectedRarity}
              onRarityChange={setSelectedRarity}
            />

            {/* Error Message */}
            {error && (
              <div className="text-center py-4">
                <div className="pixel-card bg-red-900 border-red-400 p-4 inline-block">
                  <p className="text-red-400 pixelated-font text-sm">{error}</p>
                  <PixelButton
                    text="RETRY"
                    size="small"
                    className="mt-2"
                    onClick={loadAuctionData}
                  />
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <div className="pixel-card rounded-none p-6 inline-block">
                  <p className="text-white pixelated-font text-sm">
                    LOADING AUCTIONS...
                  </p>
                  <div className="mt-2 flex justify-center">
                    <div className="w-4 h-4 bg-yellow-400 animate-pulse"></div>
                  </div>
                </div>
              </div>
            )}

            {/* Auction Cards */}
            {!loading && !error && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {filteredAuctions.map((auction, index) => (
                  <AuctionCard
                    key={auction.auctionContract || index}
                    id={auction.id}
                    rarity={auction.rarity}
                    title={auction.title}
                    countdown={auction.countdown}
                    topBid={auction.topBid}
                    rarityColor={auction.rarityColor}
                    numberOfBids={auction.numberOfBids}
                    playerImg={auction.playerImg}
                    status={auction.status}
                    isParticipated={auction.isParticipated}
                    onParticipate={handleParticipate}
                  />
                ))}
              </div>
            )}

            {/* No Results Message */}
            {!loading && !error && filteredAuctions.length === 0 && (
              <div className="text-center py-8">
                <div className="pixel-card rounded-none p-6 inline-block">
                  <p className="text-white pixelated-font text-sm">
                    NO {selectedStatus !== "ALL" ? selectedStatus : ""}{" "}
                    {selectedRarity !== "ALL" ? selectedRarity : ""} AUCTIONS
                    FOUND
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-auctions">
            {loading ? (
              <div className="text-center py-8">
                <div className="pixel-card rounded-none p-6 inline-block">
                  <p className="text-white pixelated-font text-sm">
                    LOADING YOUR AUCTIONS...
                  </p>
                  <div className="mt-2 flex justify-center">
                    <div className="w-4 h-4 bg-yellow-400 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ) : (
              <MyAuctions
                auctions={myAuctions}
                onEdit={handleEditAuction}
                onDelete={handleDeleteAuction}
                onEnd={handleEndAuction}
              />
            )}
          </TabsContent>
        </Tabs>

        {/* Avalanche Footer */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center border-2 border-red-400">
            <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-red-500 rounded-none transform rotate-45"></div>
            </div>
          </div>
          <span className="text-white pixelated-font text-lg tracking-wider">
            AVALANCHE
          </span>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;
