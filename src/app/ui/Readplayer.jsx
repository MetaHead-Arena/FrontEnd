import { useAccount, useReadContract } from "wagmi";
import { useState, useMemo } from "react";
import { PLAYER_NFT_ADDRESS, PLAYER_NFT_ABI } from "../lib/contracts/playerNFT";

const playerUrls = [
  [
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreiaubraqacngtzbea7ha64l4al5q7hmwisap4kj47qfrvtep2coylu",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreicwlut5fat6egxcweyeak2uognc43lm7mtjgxtdiguw2gcwxvw33i",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreiabd2hyz5yknzs5h6hg7l7xcfhhzdd6umrrcdcf6yolyeloytsdry",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreifmmvtiuxfq4wpqdr5lgptwr4lxj2rcztntw74kqc2ildfovcv2ny",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreih6ik3awoqmbga3qfmyaurfhfoxcvw6imet352irz4h7qybslmi3q",
  ],
  [
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreidjvljmufi2qbteidziz23ea7xlxey5ggxl2w2wk4ck3ojyb4y7oi",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreicldumkg2ytahxb6lpyksk6q5nsrp2g7sk7bzzwautweqtqpnnr5e",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreie3ppzd3zyzlszg6ivhdhghcc7heynjnrhkrl2sng7lwu4lmybeui",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreif5nggmkgibbe3hn47l7lzkkbaid7rump2s7pyi5fazzfhx4ajkj4",
  ],
  [
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreie3fkgdsqfjjsifqpgwmxnafcgnb3onv4hy6pyrthwge37fqmerei",
    "https://jade-electrical-earwig-826.mypinata.cloud/ipfs/bafkreihdqwydegzuw3tilmbx4iflvacsd54efjvq2v3mbyyqct5gnuyocy",
  ],
];

const ReadPlayer = () => {
  const { address } = useAccount();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const {
    data: tokenCount,
    isLoading,
    error,
  } = useReadContract({
    address: PLAYER_NFT_ADDRESS,
    abi: PLAYER_NFT_ABI,
    functionName: "getTokenCount",
    args: [address],
    enabled: !!address,
  });

  // Get owned NFT image URLs
  const ownedImages = useMemo(() => {
    if (!tokenCount) return [];
    const ans = [];
    for (let i = 0; i < tokenCount.length; i++) {
      for (let j = 0; j < tokenCount[i].length; j++) {
        if (tokenCount[i][j] > 0) {
          ans.push({
            url: playerUrls[i][j],
            type: i,
            idx: j,
            amount: tokenCount[i][j],
          });
        }
      }
    }
    return ans;
  }, [tokenCount]);

  // Handle arrow navigation
  const handlePrev = () => {
    setSelectedIdx((prev) => (prev === 0 ? ownedImages.length - 1 : prev - 1));
  };
  const handleNext = () => {
    setSelectedIdx((prev) => (prev === ownedImages.length - 1 ? 0 : prev + 1));
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!address) return <div>Please connect your wallet</div>;
  if (!ownedImages.length) return <div>You don't own any player NFTs.</div>;

  const selected = ownedImages[selectedIdx];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginTop: 40,
        fontFamily: '"Press Start 2P", monospace',
      }}
    >
      <h2 style={{ color: "#fde047", marginBottom: 16 }}>Your Player NFTs</h2>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 32,
          marginBottom: 16,
        }}
      >
        <button
          onClick={handlePrev}
          style={{
            fontSize: 32,
            background: "none",
            border: "none",
            color: "#fde047",
            cursor: "pointer",
            userSelect: "none",
          }}
          aria-label="Previous"
        >
          &#8592;
        </button>
        <img
          src={selected.url}
          alt={`Player NFT ${selected.type}-${selected.idx}`}
          style={{
            width: 180,
            height: 180,
            border: "4px solid #fde047",
            borderRadius: 16,
            background: "#23234c",
            objectFit: "cover",
            boxShadow: "0 4px 24px #000a",
          }}
        />
        <button
          onClick={handleNext}
          style={{
            fontSize: 32,
            background: "none",
            border: "none",
            color: "#fde047",
            cursor: "pointer",
            userSelect: "none",
          }}
          aria-label="Next"
        >
          &#8594;
        </button>
      </div>
      <div
        style={{
          color: "#fff",
          fontSize: 16,
          marginBottom: 8,
        }}
      >
        <span>
          Type: {selected.type + 1} | Index: {selected.idx + 1} | Amount:{" "}
          {selected.amount}
        </span>
      </div>
      <div
        style={{
          color: "#94a3b8",
          fontSize: 12,
          maxWidth: 320,
          textAlign: "center",
        }}
      >
        Use the arrows to switch between your owned player NFTs.
      </div>
    </div>
  );
};

export default ReadPlayer;
