import { useEffect, useState } from "react";
import { fetchMetadataFromURI } from "./fetchNFTMetadata";

export function useNFTMetadata(ownedImages) {
  const [metadataList, setMetadataList] = useState([]);

  useEffect(() => {
    if (!ownedImages || !ownedImages.length) {
      setMetadataList([]);
      return;
    }
    Promise.all(
      ownedImages.map(async (item) => {
        const metadata = await fetchMetadataFromURI(item.url);
        return { ...item, metadata };
      })
    ).then(setMetadataList);
  }, [ownedImages]);

  return metadataList;
}