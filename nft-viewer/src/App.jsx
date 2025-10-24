import React from "react";
import NFTViewer from "./components/NFTViewer";

export default function App() {
  return (
    <div style={{ padding: 20 }}>
      <h1>3D NFT Viewer Demo</h1>
      <NFTViewer
       metadataUrl="https://gateway.pinata.cloud/ipfs/QmYwAPJzv5CZsnAzt8auVTL3QxP9Z7VN6x1p3XUqG4fV7n"
        showMetadata={true}
        autoRotate={true}
      />
    </div>
  );
}
