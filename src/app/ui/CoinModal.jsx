import React, { useState, useEffect } from "react";
import { useChainId, useWriteContract, useWaitForTransactionReceipt, useAccount, useReadContract } from "wagmi";
import { parseEther, parseUnits } from "viem";
import { GAME_TOKEN_ADDRESS, GAME_TOKEN_ABI } from "../lib/contracts/gameToken";
import { PLAYER_NFT_ADDRESS, PLAYER_NFT_ABI } from "../lib/contracts/playerNFT";

const playerUrls = [
  // Common URLs
  [
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreiaubraqacngtzbea7ha64l4al5q7hmwisap4kj47qfrvtep2coylu",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreicwlut5fat6egxcweyeak2uognc43lm7mtjgxtdiguw2gcwxvw33i",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreiabd2hyz5yknzs5h6hg7l7xcfhhzdd6umrrcdcf6yolyeloytsdry",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreifmmvtiuxfq4wpqdr5lgptwr4lxj2rcztntw74kqc2ildfovcv2ny",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreih6ik3awoqmbga3qfmyaurfhfoxcvw6imet352irz4h7qybslmi3q"
  ],
  // النوع الثاني - 4 URLs
  [
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreidjvljmufi2qbteidziz23ea7xlxey5ggxl2w2wk4ck3ojyb4y7oi",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreicldumkg2ytahxb6lpyksk6q5nsrp2g7sk7bzzwautweqtqpnnr5e",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreie3ppzd3zyzlszg6ivhdhghcc7heynjnrhkrl2sng7lwu4lmybeui",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreif5nggmkgibbe3hn47l7lzkkbaid7rump2s7pyi5fazzfhx4ajkj4"
  ],
  // النوع الثالث - 2 URLs
  [
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreie3fkgdsqfjjsifqpgwmxnafcgnb3onv4hy6pyrthwge37fqmerei",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreihdqwydegzuw3tilmbx4iflvacsd54efjvq2v3mbyyqct5gnuyocy"
  ]
];

const CoinModal = ({ open, onClose, children, width = 500 }) => {
  const [selectedNetwork, setSelectedNetwork] = useState("avalanche");
  const [coinAmount, setCoinAmount] = useState("");
  const [transferType, setTransferType] = useState("coins");
  const [selectedNFT, setSelectedNFT] = useState("");
  const [coinUnit, setCoinUnit] = useState("ether");
  const [isTransferring, setIsTransferring] = useState(false);
  const [txHash, setTxHash] = useState(null);
  
  const chainId = useChainId();
  const { address } = useAccount();
  const { writeContract } = useWriteContract();
  
  // Wait for transaction confirmation
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Read owned NFTs
  const { data: tokenCount, isLoading: isLoadingNFTs, error: nftError } = useReadContract({
    address: PLAYER_NFT_ADDRESS[chainId],
    abi: PLAYER_NFT_ABI,
    functionName: 'getTokenCount',
    args: [address],
    enabled: !!address && !!PLAYER_NFT_ADDRESS[chainId], // Only run when address and contract are available
  });
  console.log("Token Count", tokenCount);

  // Function to get owned URIs with metadata
  const getOwnedNFTs = (tokenCount) => {
    const ownedNFTs = [];
    
    if (!tokenCount) return ownedNFTs;
    
    for (let i = 0; i < tokenCount.length; i++) {
      for (let j = 0; j < tokenCount[i].length; j++) {
        if (tokenCount[i] && tokenCount[i][j] && Number(tokenCount[i][j]) > 0) {
          // Generate NFT data based on category and index
          const categories = ["Common", "Rare", "Epic"];
          const category = categories[i] || "Common";
          const tokenId = `${i}_${j}`;
          const url = playerUrls[i] && playerUrls[i][j] ? playerUrls[i][j] : null;
          
          ownedNFTs.push({
            id: tokenId,
            name: `Player ${category} #${j + 1}`,
            rarity: category,
            imageUrl: url,
            count: Number(tokenCount[i][j])
          });
        }
      }
    }
    
    return ownedNFTs;
  };

  const ownedNFTs = getOwnedNFTs(tokenCount);

  // Chain ID mapping to network names
  const chainIdToNetwork = {
    43113: "avalanche", // Avalanche Fuji
    11155111: "sepolia"  // Sepolia
  };

  const networks = {
    avalanche: { name: "Avalanche", color: "#e84142", chainId: 43113 },
    sepolia: { name: "Sepolia", color: "#627eea", chainId: 11155111 }
  };

  // Auto-detect current network based on chain ID
  useEffect(() => {
    console.log("Current chainId:", chainId);
    if (chainId && chainIdToNetwork[chainId]) {
      const networkKey = chainIdToNetwork[chainId];
      console.log("Detected network:", networkKey);
      setSelectedNetwork(networkKey);
    } else {
      console.log("Unknown chainId, defaulting to avalanche");
      setSelectedNetwork("avalanche");
    }
  }, [chainId]);

  // Reset transfer state when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      setIsTransferring(false);
      setTxHash(null);
      setCoinAmount("");
      alert("Transfer completed successfully!");
    }
  }, [isConfirmed]);

  // Set first NFT as selected when NFTs are loaded
  useEffect(() => {
    if (ownedNFTs.length > 0 && !selectedNFT) {
      setSelectedNFT(ownedNFTs[0].id);
    }
  }, [ownedNFTs, selectedNFT]);

  // Early return after all hooks
  if (!open) return null;

  // Use real NFT data instead of dummy data
  const nftPlayers = ownedNFTs;

  // Coin units data
  const coinUnits = [
    { value: "wei", label: "Wei", description: "Smallest unit (1 Wei)" },
    { value: "gwei", label: "Gwei", description: "Gas unit (10⁹ Wei)" },
    { value: "ether", label: "Ether", description: "Full coin (10¹⁸ Wei)" }
  ];

  const getRarityColor = (rarity) => {
    switch(rarity) {
      case "Legendary": return "#ff6b35";
      case "Epic": return "#9333ea";
      case "Rare": return "#2563eb";
      case "Common": return "#16a34a";
      default: return "#666";
    }
  };

  const targetNetwork = selectedNetwork === "avalanche" ? "sepolia" : "avalanche";

  // Convert amount based on selected unit
  const convertAmount = (amount, unit) => {
    if (!amount || amount === "0") return "0";
    
    switch(unit) {
      case "wei":
        return amount;
      case "gwei":
        return parseUnits(amount, 9).toString();
      case "ether":
        return parseEther(amount).toString();
      default:
        return parseEther(amount).toString();
    }
  };

  // Handle CCIP Bridge Transfer for Coins
  const handleBridgeTransfer = async () => {
    if (!coinAmount || coinAmount === "0") {
      alert("Please enter a valid amount");
      return;
    }

    if (!chainId || !GAME_TOKEN_ADDRESS[chainId]) {
      alert("Unsupported network. Please switch to Avalanche Fuji or Sepolia");
      return;
    }

    try {
      setIsTransferring(true);
      
      // Convert amount to wei based on selected unit
      const amountInWei = convertAmount(coinAmount, coinUnit);
      
      console.log("Bridge transfer params:", {
        chainId,
        selectedNetwork,
        targetNetwork,
        amount: amountInWei,
        contractAddress: GAME_TOKEN_ADDRESS[chainId]
      });

      // Determine which bridge function to call based on current network
      let functionName;
      if (selectedNetwork === "avalanche") {
        // From Avalanche to Sepolia
        functionName = "bridgeToSepolia";
      } else if (selectedNetwork === "sepolia") {
        // From Sepolia to Avalanche
        functionName = "bridgeToFuji";
      } else {
        throw new Error("Invalid network selection");
      }

      console.log("Calling function:", functionName, "with amount:", amountInWei);

      // Call the bridge function
      const hash = await writeContract({
        address: GAME_TOKEN_ADDRESS[chainId],
        abi: GAME_TOKEN_ABI,
        functionName,
        args: [amountInWei],
        value: parseEther("0.01") // Gas fee for CCIP (adjust as needed)
      });

      setTxHash(hash);
      console.log("Transaction hash:", hash);
      
    } catch (error) {
      console.error("Bridge transfer failed:", error);
      setIsTransferring(false);
      
      // Handle specific error types
      if (error?.message?.includes("User rejected")) {
        alert("Transaction was cancelled by user");
      } else if (error?.message?.includes("insufficient funds")) {
        alert("Insufficient funds for this transaction");
      } else {
        alert(`Bridge transfer failed: ${error?.message || "Unknown error"}`);
      }
    }
  };

  // Handle CCIP Bridge Transfer for NFTs
  const handleNFTBridgeTransfer = async () => {
    if (!selectedNFT) {
      alert("Please select an NFT to transfer");
      return;
    }

    if (!chainId || !PLAYER_NFT_ADDRESS[chainId]) {
      alert("Unsupported network. Please switch to Avalanche Fuji or Sepolia");
      return;
    }

    if (!address) {
      alert("Please connect your wallet");
      return;
    }

    try {
      setIsTransferring(true);
      
      // Extract playerType and uriIndex from selectedNFT (format: "playerType_uriIndex")
      const [playerType, uriIndex] = selectedNFT.split('_').map(Number);
      
      console.log("NFT Bridge transfer params:", {
        chainId,
        selectedNetwork,
        targetNetwork,
        selectedNFT,
        playerType,
        uriIndex,
        contractAddress: PLAYER_NFT_ADDRESS[chainId]
      });

      // First, get the last token ID for this player type and URI index
      console.log("Getting last token ID for playerType:", playerType, "uriIndex:", uriIndex);
      
      // Use a separate read contract call to get the token ID
      const { createPublicClient, http } = await import('viem');
      const { avalancheFuji, sepolia } = await import('viem/chains');
      
      const currentChain = chainId === 43113 ? avalancheFuji : sepolia;
      const publicClient = createPublicClient({
        chain: currentChain,
        transport: http(),
      });

      const lastTokenId = await publicClient.readContract({
        address: PLAYER_NFT_ADDRESS[chainId],
        abi: PLAYER_NFT_ABI,
        functionName: 'getLastTokenOf',
        args: [address, BigInt(playerType), BigInt(uriIndex)],
      });

      console.log("Last token ID:", lastTokenId.toString());

      // Determine which bridge function to call based on current network
      let functionName;
      if (selectedNetwork === "avalanche") {
        // From Avalanche to Sepolia
        functionName = "bridgeToSepolia";
      } else if (selectedNetwork === "sepolia") {
        // From Sepolia to Avalanche
        functionName = "bridgeToFuji";
      } else {
        throw new Error("Invalid network selection");
      }

      console.log("Calling NFT bridge function:", functionName, "with tokenId:", lastTokenId.toString());

      // Call the NFT bridge function
      const hash = await writeContract({
        address: PLAYER_NFT_ADDRESS[chainId],
        abi: PLAYER_NFT_ABI,
        functionName,
        args: [lastTokenId],
        value: parseEther("0.01") // Gas fee for CCIP (adjust as needed)
      });

      setTxHash(hash);
      console.log("NFT Bridge transaction hash:", hash);
      
    } catch (error) {
      console.error("NFT Bridge transfer failed:", error);
      setIsTransferring(false);
      
      // Handle specific error types
      if (error?.message?.includes("User rejected")) {
        alert("Transaction was cancelled by user");
      } else if (error?.message?.includes("insufficient funds")) {
        alert("Insufficient funds for this transaction");
      } else if (error?.message?.includes("No tokens for this player")) {
        alert("You don't own any tokens of this player type");
      } else {
        alert(`NFT Bridge transfer failed: ${error?.message || "Unknown error"}`);
      }
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 10001,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#23234c",
          border: "4px solid #fde047",
          boxShadow: "0 8px 32px #000a",
          padding: 40,
          borderRadius: 12,
          width: "90%",
          maxWidth: width,
          minWidth: 700,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "transparent",
            border: "none",
            color: "#fde047",
            fontSize: 24,
            cursor: "pointer",
            lineHeight: 1,
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* Transfer Type Selection */}
        <div style={{ 
          width: "100%", 
          marginBottom: 25,
          color: "#fde047"
        }}>
          <h2 style={{ 
            margin: "0 0 20px 0", 
            textAlign: "center",
            fontSize: 22,
            fontWeight: "bold",
            color: "#fde047"
          }}>
            CCIP Cross-Chain Transfer
          </h2>

          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: "block", 
              marginBottom: 12,
              fontSize: 16,
              fontWeight: "600",
              textAlign: "center"
            }}>
              What do you want to transfer?
            </label>
            <div style={{ display: "flex", gap: 16 }}>
              <button
                onClick={() => setTransferType("coins")}
                style={{
                  flex: 1,
                  padding: "18px 25px",
                  border: `3px solid ${transferType === "coins" ? "#fde047" : "#666"}`,
                  background: transferType === "coins" ? "#fde047" : "transparent",
                  color: transferType === "coins" ? "#000" : "#fde047",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: "bold",
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 80
                }}
              >
                <span style={{ fontSize: 28 }}>🪙</span>
                <span>Coins</span>
              </button>
              <button
                onClick={() => setTransferType("nft")}
                style={{
                  flex: 1,
                  padding: "18px 25px",
                  border: `3px solid ${transferType === "nft" ? "#fde047" : "#666"}`,
                  background: transferType === "nft" ? "#fde047" : "transparent",
                  color: transferType === "nft" ? "#000" : "#fde047",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontSize: 18,
                  fontWeight: "bold",
                  transition: "all 0.3s ease",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  minHeight: 80
                }}
              >
                <span style={{ fontSize: 28 }}>🎮</span>
                <span>NFT Player</span>
              </button>
            </div>
          </div>
        </div>

        {/* CCIP Cross-Chain Transfer Section */}
        <div style={{ 
          width: "100%", 
          marginBottom: 20,
          color: "#fde047"
        }}>
          {/* Current Network */}
          <div style={{ 
            marginBottom: 20,
            fontSize: 16,
            fontWeight: "500"
          }}>
            Current Network : {networks[selectedNetwork]?.name || "Unknown Network"}
          </div>

          {/* Transfer Direction */}
          <div style={{ 
            background: "#1a1a3a",
            border: "2px solid #444",
            borderRadius: 10,
            padding: 20,
            marginBottom: 20,
            textAlign: "center"
          }}>
            <div style={{ fontSize: 16, marginBottom: 12 }}>Transfer Direction:</div>
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: 20,
              fontSize: 18,
              fontWeight: "bold"
            }}>
              <span style={{ color: networks[selectedNetwork]?.color || "#fde047" }}>
                {networks[selectedNetwork]?.name || "Unknown"}
              </span>
              <span style={{ 
                fontSize: 24,
                color: "#fde047"
              }}>
                →
              </span>
              <span style={{ color: networks[targetNetwork]?.color || "#fde047" }}>
                {networks[targetNetwork]?.name || "Unknown"}
              </span>
            </div>
          </div>

          {/* Dynamic Content Based on Transfer Type */}
          {transferType === "coins" ? (
            /* Coin Amount Input with Unit Selection */
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: "block", 
                marginBottom: 8,
                fontSize: 16,
                fontWeight: "500"
              }}>
                Number of Coins:
              </label>
              
              {/* Amount and Unit Container */}
              <div style={{ display: "flex", gap: 12 }}>
                {/* Amount Input */}
                <input
                  type="number"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value)}
                  placeholder={`Enter amount (in ${coinUnit})`}
                  disabled={isTransferring || isConfirming}
                  style={{
                    flex: 2,
                    padding: "16px 20px",
                    border: "2px solid #666",
                    borderRadius: 10,
                    background: "#1a1a3a",
                    color: "#fde047",
                    fontSize: 18,
                    outline: "none",
                    transition: "border-color 0.3s ease",
                    opacity: isTransferring || isConfirming ? 0.6 : 1,
                    /* Hide number input spinners/arrows */
                    MozAppearance: "textfield"
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#fde047"}
                  onBlur={(e) => e.target.style.borderColor = "#666"}
                />
                
                {/* Unit Selection Dropdown */}
                <select
                  value={coinUnit}
                  onChange={(e) => setCoinUnit(e.target.value)}
                  disabled={isTransferring || isConfirming}
                  style={{
                    flex: 1,
                    padding: "16px 15px",
                    border: "2px solid #666",
                    borderRadius: 10,
                    background: "#1a1a3a",
                    color: "#fde047",
                    fontSize: 16,
                    outline: "none",
                    cursor: "pointer",
                    transition: "border-color 0.3s ease",
                    opacity: isTransferring || isConfirming ? 0.6 : 1
                  }}
                  onFocus={(e) => e.target.style.borderColor = "#fde047"}
                  onBlur={(e) => e.target.style.borderColor = "#666"}
                >
                  {coinUnits.map((unit) => (
                    <option 
                      key={unit.value} 
                      value={unit.value}
                      style={{
                        background: "#1a1a3a",
                        color: "#fde047",
                        padding: "8px"
                      }}
                    >
                      {unit.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Description */}
              <div style={{
                marginTop: 8,
                fontSize: 12,
                color: "#888",
                textAlign: "center"
              }}>
                {coinUnits.find(unit => unit.value === coinUnit)?.description}
              </div>
            </div>
          ) : (
            /* NFT Player Selection Dropdown */
            <div style={{ marginBottom: 20 }}>
              <label style={{ 
                display: "block", 
                marginBottom: 8,
                fontSize: 16,
                fontWeight: "500"
              }}>
                Select NFT Player:
              </label>

              {/* Loading or Error States */}
              {!address ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  background: "#1a1a3a",
                  border: "2px solid #666",
                  borderRadius: 10,
                  color: "#888"
                }}>
                  Please connect your wallet to see your NFTs
                </div>
              ) : isLoadingNFTs ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  background: "#1a1a3a",
                  border: "2px solid #666",
                  borderRadius: 10,
                  color: "#fde047"
                }}>
                  Loading your NFTs...
                </div>
              ) : nftError ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  background: "#1a1a3a",
                  border: "2px solid #e84142",
                  borderRadius: 10,
                  color: "#e84142"
                }}>
                  Error loading NFTs: {nftError.message}
                </div>
              ) : nftPlayers.length === 0 ? (
                <div style={{
                  padding: "20px",
                  textAlign: "center",
                  background: "#1a1a3a",
                  border: "2px solid #666",
                  borderRadius: 10,
                  color: "#888"
                }}>
                  You don't own any NFT players yet
                </div>
              ) : (
                <>
                  <select
                    value={selectedNFT}
                    onChange={(e) => setSelectedNFT(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "16px 20px",
                      border: "2px solid #666",
                      borderRadius: 10,
                      background: "#1a1a3a",
                      color: "#fde047",
                      fontSize: 16,
                      outline: "none",
                      cursor: "pointer",
                      transition: "border-color 0.3s ease"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#fde047"}
                    onBlur={(e) => e.target.style.borderColor = "#666"}
                  >
                    {nftPlayers.map((nft) => (
                      <option 
                        key={nft.id} 
                        value={nft.id}
                        style={{
                          background: "#1a1a3a",
                          color: "#fde047",
                          padding: "10px"
                        }}
                      >
                        🎮 {nft.name} - {nft.rarity} - (Count: {nft.count})
                      </option>
                    ))}
                  </select>

                  {/* Selected NFT Preview */}
                  {selectedNFT && (
                    <div style={{
                      marginTop: 12,
                      border: "2px solid #666",
                      borderRadius: 10,
                      background: "#1a1a3a",
                      padding: "16px 20px",
                      textAlign: "center"
                    }}>
                      {(() => {
                        const selectedPlayer = nftPlayers.find(nft => nft.id === selectedNFT);
                        return selectedPlayer ? (
                          <div>
                            <div style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "center",
                              gap: 12,
                              marginBottom: 8
                            }}>
                              <span style={{ fontSize: 28 }}>🎮</span>
                              <span style={{ fontWeight: "bold", fontSize: 18 }}>
                                {selectedPlayer.name}
                              </span>
                            </div>
                            <div style={{ 
                              display: "flex", 
                              justifyContent: "center",
                              gap: 16,
                              fontSize: 14,
                              marginBottom: 8
                            }}>
                              <span style={{ 
                                color: getRarityColor(selectedPlayer.rarity),
                                fontWeight: "bold"
                              }}>
                                {selectedPlayer.rarity}
                              </span>
                              <span style={{ color: "#888" }}>•</span>
                              <span style={{ color: "#fde047" }}>
                                Level {selectedPlayer.level}
                              </span>
                              <span style={{ color: "#888" }}>•</span>
                              <span style={{ color: "#fde047" }}>
                                Count: {selectedPlayer.count}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "#888" }}>
                              This player will be transferred
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Transfer Button */}
          <button
            onClick={transferType === "coins" ? handleBridgeTransfer : handleNFTBridgeTransfer}
            disabled={
              isTransferring || 
              isConfirming || 
              (transferType === "coins" && (!coinAmount || coinAmount === "0")) ||
              (transferType === "nft" && (!address || isLoadingNFTs || nftPlayers.length === 0))
            }
            style={{
              width: "100%",
              padding: "18px 25px",
              background: (isTransferring || isConfirming || (transferType === "nft" && (!address || isLoadingNFTs || nftPlayers.length === 0))) 
                ? "linear-gradient(135deg, #666, #444)" 
                : "linear-gradient(135deg, #fde047, #f59e0b)",
              border: "none",
              borderRadius: 12,
              color: (isTransferring || isConfirming || (transferType === "nft" && (!address || isLoadingNFTs || nftPlayers.length === 0))) ? "#ccc" : "#000",
              fontSize: 18,
              fontWeight: "bold",
              cursor: (isTransferring || isConfirming || (transferType === "nft" && (!address || isLoadingNFTs || nftPlayers.length === 0))) ? "not-allowed" : "pointer",
              transition: "all 0.3s ease",
              boxShadow: "0 4px 15px rgba(253, 224, 71, 0.3)",
              minHeight: 60,
              opacity: (isTransferring || isConfirming || (transferType === "nft" && (!address || isLoadingNFTs || nftPlayers.length === 0))) ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!isTransferring && !isConfirming && !(transferType === "nft" && (!address || isLoadingNFTs || nftPlayers.length === 0))) {
                e.target.style.transform = "translateY(-2px)";
                e.target.style.boxShadow = "0 6px 20px rgba(253, 224, 71, 0.4)";
              }
            }}
            onMouseOut={(e) => {
              if (!isTransferring && !isConfirming && !(transferType === "nft" && (!address || isLoadingNFTs || nftPlayers.length === 0))) {
                e.target.style.transform = "translateY(0)";
                e.target.style.boxShadow = "0 4px 15px rgba(253, 224, 71, 0.3)";
              }
            }}
          >
            {isTransferring 
              ? "Preparing Transfer..." 
              : isConfirming 
                ? "Confirming Transaction..." 
                : transferType === "coins" 
                  ? `Transfer ${coinAmount || "0"} ${coinUnits.find(unit => unit.value === coinUnit)?.label} via CCIP`
                  : transferType === "nft" && (!address || isLoadingNFTs || nftPlayers.length === 0)
                    ? "No NFTs Available"
                    : `Transfer ${nftPlayers.find(nft => nft.id === selectedNFT)?.name || "NFT Player"} via CCIP`
            }
          </button>

          {/* Transaction Status */}
          {txHash && (
            <div style={{
              marginTop: 12,
              padding: "12px",
              background: "#1a1a3a",
              border: "1px solid #444",
              borderRadius: 8,
              fontSize: 12,
              color: "#888",
              textAlign: "center"
            }}>
              Transaction Hash: {txHash.slice(0, 10)}...{txHash.slice(-8)}
              <br />
              {isConfirming ? "⏳ Waiting for confirmation..." : "✅ Transaction confirmed!"}
            </div>
          )}
        </div>

        {children}
      </div>
      
      {/* CSS to hide number input spinners */}
      <style jsx>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  );
};

export default CoinModal;
