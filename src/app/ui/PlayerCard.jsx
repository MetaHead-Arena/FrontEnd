const PlayerCard = ({ metadata }) => {
  if (!metadata) return null;
  return (
    <div
      style={{
        background: "#181825",
        border: "2px solid #fde047",
        borderRadius: 12,
        padding: 16,
        width: 220,
        margin: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: "0 4px 24px #000a",
      }}
    >
      <img
        src={metadata.image}
        alt={metadata.name}
        style={{
          width: 100,
          height: 100,
          objectFit: "contain",
          marginBottom: 12,
          borderRadius: 8,
          background: "#23234c",
        }}
      />
      <div style={{ color: "#fde047", fontWeight: "bold", marginBottom: 4 }}>
        {metadata.name}
      </div>
      <div
        style={{
          color: "#fff",
          fontSize: 12,
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        {metadata.description}
      </div>
      <div style={{ width: "100%" }}>
        {metadata.attributes?.map((attr) => (
          <div
            key={attr.trait_type}
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#fde047",
              fontSize: 12,
              marginBottom: 2,
            }}
          >
            <span>{attr.trait_type}</span>
            <span>{attr.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayerCard;
