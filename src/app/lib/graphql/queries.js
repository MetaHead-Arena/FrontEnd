// GraphQL queries for The Graph API

export const GET_AUCTIONS = `
  query GetAuctions($first: Int = 100, $skip: Int = 0, $orderBy: String = "blockTimestamp", $orderDirection: String = "desc") {
    auctionStarteds(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      id
      nftID
      manager
      startPrice
      endAt
      auctionContract
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

export const GET_BIDS_FOR_AUCTIONS = `
  query GetBidsForAuctions($auctionContracts: [Bytes!]) {
    bidPlaceds(
      where: { auctionContract_in: $auctionContracts }
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      bidder
      nftID
      amount
      totalBid
      auctionContract
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

export const GET_FINISHED_AUCTIONS = `
  query GetFinishedAuctions {
    auctionFinisheds(
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      winner
      nftID
      amount
      auctionContract
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

export const GET_USER_BIDS = `
  query GetUserBids($userAddress: Bytes!) {
    bidPlaceds(
      where: { bidder: $userAddress }
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      bidder
      nftID
      amount
      totalBid
      auctionContract
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

export const GET_AUCTION_CREATED = `
  query GetAuctionCreated {
    auctionCreateds(
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      auctionContract
      creator
      nftID
      startPrice
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`; 