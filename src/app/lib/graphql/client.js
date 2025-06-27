import { 
  GET_AUCTIONS, 
  GET_BIDS_FOR_AUCTIONS, 
  GET_FINISHED_AUCTIONS, 
  GET_USER_BIDS,
  GET_AUCTION_CREATED 
} from './queries.js';

const GRAPH_API_URL = 'https://api.studio.thegraph.com/query/114597/meta-head-arena-avalanche-fuji/version/latest';

// GraphQL client function
export async function graphqlRequest(query, variables = {}) {
  try {
    const response = await fetch(GRAPH_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      throw new Error('GraphQL query failed');
    }

    return data.data;
  } catch (error) {
    console.error('GraphQL request failed:', error);
    throw error;
  }
}

// Helper function to convert Wei to MHcoin
function weiToMHcoin(weiString) {
  const wei = BigInt(weiString);
  const MHcoin = Number(wei) / Math.pow(10, 18);
  return MHcoin.toFixed(2);
}

// Helper function to get rarity based on nftID (you can customize this logic)
function getRarityFromNftId(nftId) {
  const id = parseInt(nftId);
  if (id % 100 < 50) return { rarity: "COMMON", color: "text-white" };
  if (id % 100 < 80) return { rarity: "EPIC", color: "text-purple-400" };
  return { rarity: "LEGENDARY", color: "text-yellow-400" };
}

// Helper function to format countdown
function formatCountdown(endTimestamp) {
  const now = Math.floor(Date.now() / 1000);
  const timeLeft = parseInt(endTimestamp) - now;
  
  if (timeLeft <= 0) {
    return "0:00:00";
  }
  
  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  
  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Helper function to check if auction is finished
function isAuctionFinished(endTimestamp) {
  const now = Math.floor(Date.now() / 1000);
  return parseInt(endTimestamp) <= now;
}

// Main function to fetch and transform auction data
export async function fetchAuctionData(userAddress = null) {
  try {
    // Fetch all auction data in parallel
    const [auctionsData, finishedAuctionsData, userBidsData] = await Promise.all([
      graphqlRequest(GET_AUCTIONS),
      graphqlRequest(GET_FINISHED_AUCTIONS),
      userAddress ? graphqlRequest(GET_USER_BIDS, { userAddress: userAddress.toLowerCase() }) : Promise.resolve({ bidPlaceds: [] })
    ]);

    const auctions = auctionsData.auctionStarteds || [];
    const finishedAuctions = finishedAuctionsData.auctionFinisheds || [];
    const userBids = userBidsData.bidPlaceds || [];

    // Get auction contracts for fetching bids
    const auctionContracts = auctions.map(auction => auction.auctionContract);
    
    let allBids = [];
    if (auctionContracts.length > 0) {
      const bidsData = await graphqlRequest(GET_BIDS_FOR_AUCTIONS, { 
        auctionContracts 
      });
      allBids = bidsData.bidPlaceds || [];
    }

    // Create a map of finished auctions for quick lookup
    const finishedAuctionMap = new Map();
    finishedAuctions.forEach(finished => {
      finishedAuctionMap.set(finished.auctionContract, finished);
    });

    // Create a map of user participation
    const userParticipationMap = new Set();
    userBids.forEach(bid => {
      userParticipationMap.add(bid.auctionContract);
    });

    // Transform auction data
    const transformedAuctions = auctions.map(auction => {
      const { rarity, color } = getRarityFromNftId(auction.nftID);
      const isFinished = isAuctionFinished(auction.endAt);
      const finishedData = finishedAuctionMap.get(auction.auctionContract);
      
      // Get highest bid for this auction
      const auctionBids = allBids.filter(bid => bid.auctionContract === auction.auctionContract);
      const highestBid = auctionBids.length > 0 ? 
        Math.max(...auctionBids.map(bid => parseInt(bid.totalBid))) : 
        parseInt(auction.startPrice);
      
      // Check if user participated
      const isParticipated = userParticipationMap.has(auction.auctionContract);

      return {
        id: auction.nftID,
        rarity,
        title: `${rarity} PLAYER #${auction.nftID}`,
        countdown: formatCountdown(auction.endAt),
        topBid: `${weiToMHcoin(highestBid.toString())} MHcoin`,
        rarityColor: color,
        numberOfBids: auctionBids.length,
        playerImg: `/head-${(parseInt(auction.nftID) % 2) + 1}.png`, // Alternate between head-1.png and head-2.png
        status: isFinished || finishedData ? "FINISHED" : "ACTIVE",
        isParticipated,
        isFinished: isFinished || !!finishedData,
        auctionContract: auction.auctionContract,
        manager: auction.manager,
        startPrice: auction.startPrice,
        endAt: auction.endAt,
        blockTimestamp: auction.blockTimestamp,
        winner: finishedData?.winner || null,
        winningAmount: finishedData?.amount || null
      };
    });

    return transformedAuctions;
  } catch (error) {
    console.error('Error fetching auction data:', error);
    // Return empty array on error, or you could return fallback data
    return [];
  }
}

// Function to fetch specific auction details
export async function fetchAuctionDetails(auctionContract) {
  try {
    const [bidsData, finishedData] = await Promise.all([
      graphqlRequest(GET_BIDS_FOR_AUCTIONS, { auctionContracts: [auctionContract] }),
      graphqlRequest(GET_FINISHED_AUCTIONS)
    ]);

    const bids = bidsData.bidPlaceds || [];
    const finished = finishedData.auctionFinisheds?.find(f => f.auctionContract === auctionContract);

    return {
      bids,
      finished,
      totalBids: bids.length,
      highestBid: bids.length > 0 ? Math.max(...bids.map(bid => parseInt(bid.totalBid))) : 0
    };
  } catch (error) {
    console.error('Error fetching auction details:', error);
    return { bids: [], finished: null, totalBids: 0, highestBid: 0 };
  }
} 