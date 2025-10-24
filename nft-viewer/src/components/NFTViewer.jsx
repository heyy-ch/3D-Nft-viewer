// 3D NFT Viewer — single-file React component
// File: NFTViewer.jsx
// Description: A self-contained React component using react-three-fiber (r3f) + @react-three/drei to load and display 3D NFT assets (GLB/GLTF), fallback to images and 2D, and fetch metadata from an ERC-721/ERC-1155 token contract.
// Setup (run in your project root):
// 1. Create a React app (Vite recommended):
//    npm create vite@latest nft-viewer -- --template react
//    cd nft-viewer
// 2. Install dependencies:
//    npm install three @react-three/fiber @react-three/drei three-stdlib ethers axios tailwindcss
// 3. Tailwind (optional) - configure if you want styling.
// 4. Place this file at src/components/NFTViewer.jsx and import into App.jsx.
// 5. Run: npm run dev

// Notes and tips:
// - This viewer fetches tokenURI via ethers.js if you provide a contract address + tokenId and an RPC provider URL (e.g., Infura/Alchemy/MetaMask).
// - Supports content types: .glb/.gltf (3D), images (png/jpg/webp), and generic iframe-embeds (for marketplace-hosted viewers).
// - For IPFS URIs (ipfs://...), the code converts to a gateway URL. You may swap to your preferred gateway.
// - CORS: many IPFS gateways and hosting providers require CORS enabled for direct fetching. If assets fail to load, try another gateway or proxy.

import React, { useEffect, useState, Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, useGLTF, Environment, useProgress } from '@react-three/drei';
import axios from 'axios';
import { ethers } from 'ethers';

// Minimal ERC-721 ABI to get tokenURI and ownerOf
const ERC721_ABI = [
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)'
];

// Helper: convert ipfs://... to gateway URL
function ipfsToHttp(url) {
  if (!url) return url;
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  // handle ipfs gateway patterns
  if (url.includes('ipfs/') && url.startsWith('http')) return url;
  return url;
}

// Loader component for GLTF models
function ModelGLTF({ url }) {
  const { scene } = useGLTF(url, true);
  // Some GLTFs need scaling — try to make them visible
  return <primitive object={scene} dispose={null} />;
}

// Simple progress loader
function LoaderFallback() {
  const { active, progress } = useProgress();
  return (
    <Html center>
      <div style={{ padding: 12, background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: 8 }}>
        <div style={{ fontSize: 14 }}>{active ? `Loading ${Math.round(progress)}%` : 'Loading...'}</div>
      </div>
    </Html>
  );
}

export default function NFTViewer({
  // Primary props — supply either metadataUrl *or* contract + tokenId + provider
  metadataUrl = '', // direct URL to metadata JSON
  contractAddress = '', // ERC-721/1155 contract address
  tokenId = '',
  providerUrl = '', // e.g. https://mainnet.infura.io/v3/___ or use window.ethereum
  showMetadata = true,
  autoRotate = false,
  background = 'transparent',
  style = { width: '100%', height: '600px', borderRadius: 12 }
}) {
  const [metadata, setMetadata] = useState(null);
  const [assetUrl, setAssetUrl] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchFromContract() {
      try {
        if (!contractAddress || !tokenId) return;
        // Use provider: if providerUrl not given, try window.ethereum
        let provider;
        if (providerUrl) {
          provider = new ethers.providers.JsonRpcProvider(providerUrl);
        } else if (window && window.ethereum) {
          provider = new ethers.providers.Web3Provider(window.ethereum);
        } else {
          throw new Error('No provider available — provide providerUrl or connect MetaMask');
        }

        const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
        const uri = await contract.tokenURI(tokenId);
        const fixed = ipfsToHttp(uri);
        const res = await axios.get(fixed);
        if (cancelled) return;
        setMetadata(res.data);
      } catch (err) {
        console.error('contract fetch err', err);
        setError(err.message);
      }
    }

    async function fetchFromMetadataUrl() {
      try {
        if (!metadataUrl) return;
        const fixed = ipfsToHttp(metadataUrl);
        const res = await axios.get(fixed);
        if (cancelled) return;
        setMetadata(res.data);
      } catch (err) {
        console.error('metadata fetch err', err);
        setError(err.message);
      }
    }

    setMetadata(null);
    setAssetUrl('');
    setError(null);

    if (metadataUrl) fetchFromMetadataUrl();
    else if (contractAddress && tokenId) fetchFromContract();

    return () => {
      cancelled = true;
    };
  }, [metadataUrl, contractAddress, tokenId, providerUrl]);

  useEffect(() => {
    if (!metadata) return;
    // Common fields: image, animation_url, image_url
    const candidates = [metadata.animation_url, metadata.image, metadata.image_url, metadata.asset, metadata.animation];
    const first = candidates.find(Boolean);
    if (first) setAssetUrl(ipfsToHttp(first));
  }, [metadata]);

  // format simple metadata display
  const MetaBox = () => (
    <div style={{ padding: 12, background: 'rgba(255,255,255,0.9)', borderRadius: 8, maxWidth: 320 }}>
      <h3 style={{ margin: '0 0 8px 0' }}>{metadata?.name || `Token ${tokenId}`}</h3>
      <p style={{ margin: '0 0 8px 0', fontSize: 13 }}>{metadata?.description}</p>
      {metadata?.attributes && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {metadata.attributes.map((a, i) => (
            <div key={i} style={{ padding: '6px 8px', background: '#f3f4f6', borderRadius: 6, fontSize: 12 }}>{a.trait_type || a.type}: {a.value}</div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={style}>
        <Canvas camera={{ position: [0, 0, 3], fov: 50 }} style={{ background }}>
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 5, 5]} intensity={0.6} />
          <Suspense fallback={<LoaderFallback />}>
            {assetUrl && assetUrl.match(/\.gltf$|\.glb$|model\/(.*)gltf/i) && (
              <ModelGLTF url={assetUrl} />
            )}
            {/* If asset is an image, show it as a textured plane */}
            {assetUrl && assetUrl.match(/\.png$|\.jpg$|\.jpeg$|\.webp$|image\//i) && (
              <mesh>
                <planeGeometry args={[2, 2]} />
                <meshStandardMaterial>
                  {/* Use Html to show an <img> fallback for easier CORS handling */}
                </meshStandardMaterial>
                <Html center occlude position={[0, 0, 0.01]}>
                  <img src={assetUrl} alt="nft" style={{ maxWidth: '48vh', maxHeight: '48vh', borderRadius: 8 }} />
                </Html>
              </mesh>
            )}

            {/* Fallback: if animation url or iframe-like content, show it inside Html */}
            {assetUrl && !assetUrl.match(/\.gltf$|\.glb$|\.png$|\.jpg$|\.jpeg$|\.webp$|image\//i) && (
              <Html center>
                <div style={{ width: 640, height: 480, borderRadius: 8, overflow: 'hidden', boxShadow: '0 6px 24px rgba(0,0,0,0.3)' }}>
                  <iframe src={assetUrl} title="nft-embed" width="100%" height="100%" style={{ border: 0 }} />
                </div>
              </Html>
            )}

            <Environment preset="studio" />
          </Suspense>

          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} autoRotate={autoRotate} />
        </Canvas>
      </div>

      {showMetadata && (
        <div style={{ flex: '0 0 340px' }}>
          {error && <div style={{ color: 'red' }}>Error: {error}</div>}
          {!metadata && !error && <div>Loading metadata...</div>}
          {metadata && <MetaBox />}

          {/* Quick manual loader UI */}
          <div style={{ marginTop: 12 }}>
            <h4 style={{ margin: '6px 0' }}>Quick actions</h4>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { navigator.clipboard?.writeText(assetUrl || ''); }} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }}>Copy asset URL</button>
              <button onClick={() => window.open(assetUrl, '_blank')} style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #ddd' }}>Open asset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Usage example (in your App.jsx):
// import NFTViewer from './components/NFTViewer';
//
// <NFTViewer
//   // Option A: direct metadata URL
//   metadataUrl={'ipfs://Qm.../metadata.json'}
//   // Option B: contract + tokenId (and optional provider)
//   // contractAddress={'0x...'}
//   // tokenId={'1'}
//   // providerUrl={'https://mainnet.infura.io/v3/YOUR_KEY'}
//   showMetadata={true}
//   autoRotate={false}
// />

// Additional improvements you may want to add:
// - Drag-and-drop a GLB file for local preview.
// - Wallet connect: let user connect MetaMask and auto-detect provider.
// - Support for 3D model scaling, center/normalize, autorotation presets per model.
// - LOD and fallback: if GLB fails, try a thumbnail image.
// - Add download button that uses fetch to download the underlying asset (respect licensing!).

// That's it — open the canvas file to view and edit the component.
