import React, { useState, useMemo } from "react";
import AuctionCard from "./AuctionCard";
import PixelButton from "./PixelButton";
import AuctionFilter from "./AuctionFilter";
import MyAuctions from "./MyAuctions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";
import NewAuctionModal from "./NewAuctionModal";

const auctionData = [
  {
    id: 1,
    rarity: "COMMON",
    title: "COMMON PLAYER",
    countdown: "2:15:30",
    topBid: "2,50 AVAX",
    rarityColor: "text-white",
    numberOfBids: 3,
    playerImg: "/head-1.png",
  },
  {
    id: 2,
    rarity: "EPIC",
    title: "EPIC PLAYER",
    countdown: "8:45:12",
    topBid: "5,00 AVAX",
    rarityColor: "text-purple-400",
    numberOfBids: 7,
    playerImg: "/head-2.png",
  },
  {
    id: 3,
    rarity: "LEGENDARY",
    title: "LEGENDARY PLAYER",
    countdown: "5:00:00",
    topBid: "7,00 AVAX",
    rarityColor: "text-yellow-400",
    numberOfBids: 12,
    playerImg: "/head-3.png",
  },
  {
    id: 4,
    rarity: "LEGENDARY",
    title: "LEGENDARY PLAYER",
    countdown: "5:00:00",
    topBid: "7,00 AVAX",
    rarityColor: "text-yellow-400",
    numberOfBids: 12,
    playerImg: "/head-3.png",
  },
  {
    id: 5,
    rarity: "LEGENDARY",
    title: "LEGENDARY PLAYER",
    countdown: "5:00:00",
    topBid: "7,00 AVAX",
    rarityColor: "text-yellow-400",
    numberOfBids: 12,
    playerImg: "/head-3.png",
  },
  {
    id: 6,
    rarity: "COMMON",
    title: "COMMON PLAYER",
    countdown: "5:00:00",
    topBid: "7,00 AVAX",
    rarityColor: "text-white",
    numberOfBids: 12,
    playerImg: "/head-1.png",
  },
  {
    id: 7,
    rarity: "EPIC",
    title: "EPIC PLAYER",
    countdown: "5:00:00",
    topBid: "7,00 AVAX",
    rarityColor: "text-purple-400",
    numberOfBids: 12,
    playerImg: "/head-2.png",
  },
  {
    id: 8,
    rarity: "COMMON",
    title: "COMMON PLAYER",
    countdown: "5:00:00",
    topBid: "7,00 AVAX",
    rarityColor: "text-white",
    numberOfBids: 12,
    playerImg: "/head-1.png",
  },
  {
    id: 9,
    rarity: "EPIC",
    title: "EPIC PLAYER",
    countdown: "5:00:00",
    topBid: "7,00 AVAX",
    rarityColor: "text-purple-400",
    numberOfBids: 12,
    playerImg: "/head-2.png",
  },
];

const Marketplace = ({ onBack }) => {
  const [selectedRarity, setSelectedRarity] = useState("ALL");
  const [auctions, setAuctions] = useState([...auctionData]);
  const [showModal, setShowModal] = useState(false);

  const filteredAuctions = useMemo(() => {
    if (selectedRarity === "ALL") return auctions;
    return auctions.filter((auction) => auction.rarity === selectedRarity);
  }, [selectedRarity, auctions]);

  const myAuctions = useMemo(
    () => auctions.filter((auction) => auction.owner),
    [auctions]
  );

  const handleCreateAuction = (newAuction) => {
    setAuctions([{ ...newAuction, owner: true }, ...auctions]);
  };

  const handleEditAuction = (id, updatedData) => {
    setAuctions(
      auctions.map((a) => (a.id === id ? { ...a, ...updatedData } : a))
    );
  };

  const handleDeleteAuction = (id) => {
    setAuctions(auctions.filter((a) => a.id !== id));
  };

  const handleEndAuction = (id) => {
    setAuctions(auctions.map((a) => (a.id === id ? { ...a, ended: true } : a)));
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
          <div className="pixel-card rounded-none p-6 text-center">
            <h1 className="metahead-main">METAHEAD MARKETPLACE</h1>
          </div>
        </div>
        {/* New Auction Button */}
        <div className="mb-8 flex justify-center">
          <PixelButton
            variant="marketplace"
            text="NEW AUCTION"
            size="large"
            className="w-[320px] text-lg"
            onClick={() => setShowModal(true)}
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
              selectedRarity={selectedRarity}
              onRarityChange={setSelectedRarity}
            />

            {/* Auction Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {filteredAuctions.map((auction, index) => (
                <AuctionCard
                  key={index}
                  rarity={auction.rarity}
                  title={auction.title}
                  countdown={auction.countdown}
                  topBid={auction.topBid}
                  rarityColor={auction.rarityColor}
                  numberOfBids={auction.numberOfBids}
                  playerImg={auction.playerImg}
                />
              ))}
            </div>

            {filteredAuctions.length === 0 && (
              <div className="text-center py-8">
                <div className="pixel-card rounded-none p-6 inline-block">
                  <p className="text-white pixelated-font text-sm">
                    NO {selectedRarity} AUCTIONS FOUND
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-auctions">
            <MyAuctions
              auctions={myAuctions}
              onEdit={handleEditAuction}
              onDelete={handleDeleteAuction}
              onEnd={handleEndAuction}
            />
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
