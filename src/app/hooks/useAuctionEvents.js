import { useWatchContractEvent } from 'wagmi';
import { useState, useEffect, useCallback } from 'react';
import { PLAYER_AUCTION_ABI } from '../lib/contracts/playerAuction';

// Hook للاستماع لأحداث المزايدة في مزاد واحد
export function useAuctionBidEvents({ auctionContract, nftID, onNewBid, enabled = true }) {
  const [lastBidData, setLastBidData] = useState(null);
  const [isListening, setIsListening] = useState(enabled);

  // استماع لأحداث BidPlaced
  useWatchContractEvent({
    address: auctionContract,
    abi: PLAYER_AUCTION_ABI,
    eventName: 'BidPlaced',
    enabled: enabled && isListening && !!auctionContract,
    onLogs(logs) {
      logs.forEach((log) => {
        const { bidder, nftID: eventNftID, amount, totalBid } = log.args;
        
        // التحقق أن الحدث لنفس NFT
        if (nftID && eventNftID.toString() !== nftID.toString()) {
          return;
        }

        const bidData = {
          bidder: bidder.toLowerCase(),
          nftID: eventNftID.toString(),
          amount: amount.toString(),
          totalBid: totalBid.toString(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          timestamp: Date.now(),
          // تحويل إلى MHcoin
          amountInMHcoin: Number(amount) / Math.pow(10, 18),
          totalBidInMHcoin: Number(totalBid) / Math.pow(10, 18),
        };

        setLastBidData(bidData);
        
        if (onNewBid) {
          onNewBid(bidData);
        }
      });
    },
    onError(error) {
      console.error('Error listening to BidPlaced events:', error);
    },
  });

  // استماع لأحداث إنهاء المزاد
  useWatchContractEvent({
    address: auctionContract,
    abi: PLAYER_AUCTION_ABI,
    eventName: 'AuctionFinished',
    enabled: enabled && isListening && !!auctionContract,
    onLogs(logs) {
      logs.forEach((log) => {
        const { winner, nftID: eventNftID, amount } = log.args;
        
        if (nftID && eventNftID.toString() !== nftID.toString()) {
          return;
        }

        const finishData = {
          winner: winner.toLowerCase(),
          nftID: eventNftID.toString(),
          winningAmount: amount.toString(),
          winningAmountInMHcoin: Number(amount) / Math.pow(10, 18),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          timestamp: Date.now(),
        };

        if (onNewBid) {
          onNewBid({ ...finishData, type: 'AUCTION_FINISHED' });
        }
      });
    },
  });

  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    setIsListening(true);
  }, []);

  return {
    lastBidData,
    isListening,
    stopListening,
    startListening,
  };
}

// Hook للاستماع لجميع أحداث المزادات في الـ marketplace
export function useMarketplaceEvents({ onAuctionCreated, onBidPlaced, onAuctionFinished, enabled = true }) {
  const [events, setEvents] = useState([]);
  const [latestEvent, setLatestEvent] = useState(null);

  // استماع لأحداث إنشاء المزادات الجديدة
  useWatchContractEvent({
    address: process.env.NEXT_PUBLIC_MARKETPLACE_FACTORY_ADDRESS,
    abi: MARKETPLACE_FACTORY_ABI,
    eventName: 'AuctionCreated',
    enabled,
    onLogs(logs) {
      logs.forEach((log) => {
        const { auctionContract, creator, nftID, startPrice } = log.args;
        
        const eventData = {
          type: 'AUCTION_CREATED',
          auctionContract: auctionContract.toLowerCase(),
          creator: creator.toLowerCase(),
          nftID: nftID.toString(),
          startPrice: startPrice.toString(),
          startPriceInMHcoin: Number(startPrice) / Math.pow(10, 18),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          timestamp: Date.now(),
        };

        setEvents(prev => [eventData, ...prev.slice(0, 49)]); // Keep last 50 events
        setLatestEvent(eventData);
        
        if (onAuctionCreated) {
          onAuctionCreated(eventData);
        }
      });
    },
  });

  return {
    events,
    latestEvent,
  };
}

// Hook متقدم للاستماع لأحداث متعددة مع فلترة
export function useMultiAuctionEvents({ auctionContracts = [], onEventReceived, enabled = true }) {
  const [eventHistory, setEventHistory] = useState([]);
  const [activeAuctions, setActiveAuctions] = useState(new Set(auctionContracts));

  // تحديث المزادات النشطة عند تغيير القائمة
  useEffect(() => {
    setActiveAuctions(new Set(auctionContracts));
  }, [auctionContracts]);

  // استماع للأحداث لكل مزاد
  auctionContracts.forEach((auctionContract) => {
    useWatchContractEvent({
      address: auctionContract,
      abi: PLAYER_AUCTION_ABI,
      eventName: 'BidPlaced',
      enabled: enabled && activeAuctions.has(auctionContract),
      onLogs(logs) {
        logs.forEach((log) => {
          const { bidder, nftID, amount, totalBid } = log.args;
          
          const eventData = {
            type: 'BID_PLACED',
            auctionContract: auctionContract.toLowerCase(),
            bidder: bidder.toLowerCase(),
            nftID: nftID.toString(),
            amount: amount.toString(),
            totalBid: totalBid.toString(),
            totalBidInMHcoin: Number(totalBid) / Math.pow(10, 18),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: Date.now(),
          };

          setEventHistory(prev => [eventData, ...prev.slice(0, 99)]); // Keep last 100 events
          
          if (onEventReceived) {
            onEventReceived(eventData);
          }
        });
      },
    });

    useWatchContractEvent({
      address: auctionContract,
      abi: PLAYER_AUCTION_ABI,
      eventName: 'AuctionFinished',
      enabled: enabled && activeAuctions.has(auctionContract),
      onLogs(logs) {
        logs.forEach((log) => {
          const { winner, nftID, amount } = log.args;
          
          const eventData = {
            type: 'AUCTION_FINISHED',
            auctionContract: auctionContract.toLowerCase(),
            winner: winner.toLowerCase(),
            nftID: nftID.toString(),
            winningAmount: amount.toString(),
            winningAmountInMHcoin: Number(amount) / Math.pow(10, 18),
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
            timestamp: Date.now(),
          };

          setEventHistory(prev => [eventData, ...prev.slice(0, 99)]);
          
          if (onEventReceived) {
            onEventReceived(eventData);
          }
        });
      },
    });
  });

  const getEventsForAuction = useCallback((auctionContract) => {
    return eventHistory.filter(event => 
      event.auctionContract.toLowerCase() === auctionContract.toLowerCase()
    );
  }, [eventHistory]);

  const getLatestBidForAuction = useCallback((auctionContract) => {
    const auctionEvents = getEventsForAuction(auctionContract);
    return auctionEvents.find(event => event.type === 'BID_PLACED') || null;
  }, [getEventsForAuction]);

  return {
    eventHistory,
    getEventsForAuction,
    getLatestBidForAuction,
    activeAuctions: Array.from(activeAuctions),
  };
}
