export async function fetchMetadataFromURI(uri) {
  try {
    if (!uri || uri.length === 0) return undefined;

    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const metadata = await response.json();
    // metadata should have { name, description, image, ... }
    return metadata;
  } catch (error) {
    console.error(`Error fetching metadata from URI ${uri}:`, error);
    return undefined;
  }
}