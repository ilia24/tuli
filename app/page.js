'use client';

import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useUser } from '../contexts/UserContext';
import WelcomeModal from '../components/WelcomeModal';
import AnimatedBackground from '../components/AnimatedBackground';
import dynamic from 'next/dynamic';
import { DEV_CONFIG } from '../lib/config';

// Dynamically import Phaser game to avoid SSR issues
const PhaserGame = dynamic(() => import('../components/PhaserGame'), {
  ssr: false,
});

const TilesetViewer = dynamic(() => import('../components/TilesetViewer'), {
  ssr: false,
});

const WorldEditor = dynamic(() => import('../components/WorldEditor'), {
  ssr: false,
});

export default function Home() {
  const { hasCompletedWelcome, getFullName, translations } = useUser();
  const [showViewer, setShowViewer] = useState(DEV_CONFIG.showTilesetViewer);
  const [showEditor, setShowEditor] = useState(false);

  // If world editor is active
  if (showEditor) {
    return (
      <div className="min-h-screen bg-gray-900 overflow-hidden">
        <div className="w-full h-screen">
          <WorldEditor onBackToGame={() => setShowEditor(false)} />
        </div>
      </div>
    );
  }

  // If tileset viewer mode is enabled, show that instead
  if (showViewer) {
    return (
      <div className="min-h-screen bg-gray-900 overflow-hidden">
        {DEV_CONFIG.showTilesetViewerButton && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowViewer(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="fixed top-4 right-4 z-10000 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors cursor-pointer pointer-events-auto"
          >
            Back to Game
          </button>
        )}
        <div className="w-full h-screen">
          <TilesetViewer />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-b from-blue-400 via-blue-300 to-cyan-200 overflow-hidden relative">
      <AnimatedBackground fadeOut={hasCompletedWelcome} />
      
      <AnimatePresence>
        {!hasCompletedWelcome && <WelcomeModal />}
      </AnimatePresence>
      
      <main className="relative z-10">
        {/* Dev Tool Buttons */}
        {hasCompletedWelcome && (
          <div className="fixed top-4 right-4 z-10000 flex gap-2">
            {DEV_CONFIG.showTilesetViewerButton && (
              <button
                onClick={() => setShowViewer(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors cursor-pointer"
              >
                Tileset Viewer
              </button>
            )}
            {DEV_CONFIG.showWorldEditorButton && (
              <button
                onClick={() => setShowEditor(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors cursor-pointer"
              >
                World Editor
              </button>
            )}
          </div>
        )}
        
        {hasCompletedWelcome ? (
          <div className="w-full h-screen" id="phaser-game">
            <PhaserGame />
          </div>
        ) : (
          <div className="flex justify-center items-center min-h-screen text-center">
            <h1 className="text-8xl md:text-5xl font-black text-white drop-shadow-lg m-0 animate-pulse">
              Tuli
            </h1>
          </div>
        )}
      </main>
    </div>
  );
}
