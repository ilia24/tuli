'use client';

import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { getWorld } from '../lib/worldConfig';

export default function WorldEditor() {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);
  const [showTileSelector, setShowTileSelector] = useState(false);
  const [selectedGridPos, setSelectedGridPos] = useState(null);
  const [currentTiles, setCurrentTiles] = useState(null);
  const [selectedPaletteTab, setSelectedPaletteTab] = useState('tileset');
  const [selectedPaletteTile, setSelectedPaletteTile] = useState(null);
  const [showPalette, setShowPalette] = useState(true);
  const [paletteWidth, setPaletteWidth] = useState(320);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [layers, setLayers] = useState([]);

  useEffect(() => {
    if (phaserGameRef.current || !gameRef.current) return;

    const world = getWorld('tutorial');
    const worldLayers = JSON.parse(JSON.stringify(world.layers)); // Deep copy
    setLayers(worldLayers);

    class WorldEditorScene extends Phaser.Scene {
      constructor() {
        super({ key: 'WorldEditorScene' });
        this.layers = worldLayers;
        this.layerSprites = []; // Array of layers, each containing tileSprites
        this.gridGraphics = null;
        this.hoveredTile = null;
        this.copiedTileIndex = null;
        this.currentLayerIndex = 0;
      }

      preload() {
        this.load.spritesheet('tileset', '/spritesheets/Tileset_16x16.png', {
          frameWidth: 16,
          frameHeight: 16,
          spacing: 0,
          margin: 0,
        });
      }

      create() {
        const tileSize = 16;
        const scale = 2;
        
        // Set texture filtering
        this.textures.get('tileset').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('objects').setFilter(Phaser.Textures.FilterMode.NEAREST);

        // Create background
        const bg = this.add.graphics();
        bg.fillStyle(0x222222, 1);
        bg.fillRect(0, 0, world.width * tileSize * scale, world.height * tileSize * scale);

        // Render all layers
        this.layers.forEach((layer, layerIndex) => {
          this.layerSprites[layerIndex] = [];
          
          for (let y = 0; y < world.height; y++) {
            this.layerSprites[layerIndex][y] = [];
            for (let x = 0; x < world.width; x++) {
              const tileIndex = layer.tiles[y][x];
              const tileX = x * tileSize * scale;
              const tileY = y * tileSize * scale;
              
              // Skip null/empty tiles
              if (tileIndex === null || tileIndex === undefined) {
                this.layerSprites[layerIndex][y][x] = null;
                continue;
              }
              
              const tile = this.add.image(tileX, tileY, layer.spriteSheet, tileIndex);
              tile.setOrigin(0, 0);
              tile.setScale(scale);
              tile.setDepth(layerIndex);
              
              // Only make tiles in current layer interactive
              if (layerIndex === this.currentLayerIndex) {
                tile.setInteractive(
                  new Phaser.Geom.Rectangle(0, 0, tileSize, tileSize),
                  Phaser.Geom.Rectangle.Contains
                );
                
                // Click handler - only trigger on left click
                tile.on('pointerdown', (pointer) => {
                  if (pointer.leftButtonDown() && !this.isDragging) {
                    setSelectedGridPos({ x, y, layer: layerIndex });
                    setShowTileSelector(true);
                  }
                });

                // Hover effect
                tile.on('pointerover', () => {
                  tile.setTint(0xaaaaff);
                  this.hoveredTile = { x, y, sprite: tile, layer: layerIndex };
                });
                
                tile.on('pointerout', () => {
                  tile.clearTint();
                  if (this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y) {
                    this.hoveredTile = null;
                  }
                });
              }
              
              this.layerSprites[layerIndex][y][x] = tile;
            }
          }
        });

        // Draw grid
        this.gridGraphics = this.add.graphics();
        this.drawGrid(tileSize * scale);

        // Set camera bounds
        const worldWidth = world.width * tileSize * scale;
        const worldHeight = world.height * tileSize * scale;
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // Track drag state
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // Enable camera controls with right mouse button
        this.input.on('pointerdown', (pointer) => {
          if (pointer.rightButtonDown()) {
            this.isDragging = true;
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
          }
        });

        this.input.on('pointermove', (pointer) => {
          if (this.isDragging && pointer.rightButtonDown()) {
            const deltaX = pointer.x - this.dragStartX;
            const deltaY = pointer.y - this.dragStartY;
            
            this.cameras.main.scrollX -= deltaX / this.cameras.main.zoom;
            this.cameras.main.scrollY -= deltaY / this.cameras.main.zoom;
            
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
          }
        });

        this.input.on('pointerup', (pointer) => {
          if (pointer.button === 2) { // Right button released
            this.isDragging = false;
          }
        });

        // Prevent context menu on right click
        this.game.canvas.addEventListener('contextmenu', (e) => {
          e.preventDefault();
        });

        // Zoom with mouse wheel
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
          const zoomAmount = deltaY > 0 ? -0.1 : 0.1;
          const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom + zoomAmount, 0.5, 4);
          this.cameras.main.setZoom(newZoom);
        });

        // Keyboard controls for copy/paste
        this.input.keyboard.on('keydown-C', () => {
          if (this.hoveredTile) {
            const tileIndex = this.tiles[this.hoveredTile.y][this.hoveredTile.x];
            this.copiedTileIndex = tileIndex;
            window.worldEditorSelectedTile = tileIndex;
            console.log(`Copied tile ${tileIndex} from position (${this.hoveredTile.x}, ${this.hoveredTile.y})`);
            
            // Visual feedback - flash the tile
            this.hoveredTile.sprite.setTint(0x00ff00);
            this.time.delayedCall(200, () => {
              if (this.hoveredTile) {
                this.hoveredTile.sprite.setTint(0xaaaaff);
              }
            });
          }
        });

        this.input.keyboard.on('keydown-V', () => {
          const pasteIndex = window.worldEditorSelectedTile !== undefined 
            ? window.worldEditorSelectedTile 
            : this.copiedTileIndex;
            
          if (this.hoveredTile && pasteIndex !== null) {
            this.updateTile(this.hoveredTile.x, this.hoveredTile.y, this.currentLayerIndex, pasteIndex);
            console.log(`Pasted tile ${pasteIndex} to position (${this.hoveredTile.x}, ${this.hoveredTile.y}) on layer ${this.currentLayerIndex}`);
          }
        });

        // Store scene reference globally for updates
        window.worldEditorScene = this;
      }

      drawGrid(size) {
        this.gridGraphics.clear();
        this.gridGraphics.lineStyle(1, 0x444444, 0.5);
        
        // Vertical lines
        for (let x = 0; x <= world.width; x++) {
          this.gridGraphics.lineBetween(
            x * size, 
            0, 
            x * size, 
            world.height * size
          );
        }
        
        // Horizontal lines
        for (let y = 0; y <= world.height; y++) {
          this.gridGraphics.lineBetween(
            0, 
            y * size, 
            world.width * size, 
            y * size
          );
        }
      }

      updateTile(x, y, layerIndex, newTileIndex) {
        const layer = this.layers[layerIndex];
        layer.tiles[y][x] = newTileIndex;
        
        // Remove old sprite if exists
        if (this.layerSprites[layerIndex][y][x]) {
          this.layerSprites[layerIndex][y][x].destroy();
        }
        
        // Create new sprite
        if (newTileIndex !== null) {
          const tileSize = 16;
          const scale = 2;
          const tileX = x * tileSize * scale;
          const tileY = y * tileSize * scale;
          
          const tile = this.add.image(tileX, tileY, layer.spriteSheet, newTileIndex);
          tile.setOrigin(0, 0);
          tile.setScale(scale);
          tile.setDepth(layerIndex);
          
          if (layerIndex === this.currentLayerIndex) {
            tile.setInteractive(
              new Phaser.Geom.Rectangle(0, 0, tileSize, tileSize),
              Phaser.Geom.Rectangle.Contains
            );
            
            tile.on('pointerdown', (pointer) => {
              if (pointer.leftButtonDown() && !this.isDragging) {
                setSelectedGridPos({ x, y, layer: layerIndex });
                setShowTileSelector(true);
              }
            });

            tile.on('pointerover', () => {
              tile.setTint(0xaaaaff);
              this.hoveredTile = { x, y, sprite: tile, layer: layerIndex };
            });
            
            tile.on('pointerout', () => {
              tile.clearTint();
              if (this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y) {
                this.hoveredTile = null;
              }
            });
          }
          
          this.layerSprites[layerIndex][y][x] = tile;
        } else {
          this.layerSprites[layerIndex][y][x] = null;
        }
        
        // Update state and log
        setCurrentTiles(JSON.parse(JSON.stringify(this.layers)));
        console.log('Updated world layers:');
        console.log(JSON.stringify(this.layers, null, 2));
      }

      switchLayer(newLayerIndex) {
        this.currentLayerIndex = newLayerIndex;
        
        // Update interactivity for all tiles
        this.layerSprites.forEach((layer, layerIndex) => {
          layer.forEach((row, y) => {
            row.forEach((tile, x) => {
              if (tile) {
                if (layerIndex === newLayerIndex) {
                  // Make interactive
                  tile.setInteractive(
                    new Phaser.Geom.Rectangle(0, 0, 16, 16),
                    Phaser.Geom.Rectangle.Contains
                  );
                  tile.setAlpha(1);
                } else {
                  // Make non-interactive and slightly transparent
                  tile.disableInteractive();
                  tile.setAlpha(0.5);
                }
              }
            });
          });
        });
      }
    }

    const config = {
      type: Phaser.AUTO,
      parent: gameRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#222222',
      scene: [WorldEditorScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    phaserGameRef.current = new Phaser.Game(config);
    setCurrentTiles(worldLayers);

    return () => {
      window.worldEditorScene = null;
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  const handleTileSelect = (tileIndex) => {
    if (selectedGridPos && window.worldEditorScene) {
      window.worldEditorScene.updateTile(
        selectedGridPos.x, 
        selectedGridPos.y,
        selectedGridPos.layer !== undefined ? selectedGridPos.layer : currentLayer,
        tileIndex
      );
    }
    setShowTileSelector(false);
    setSelectedGridPos(null);
  };

  const handleLayerChange = (newLayerIndex) => {
    setCurrentLayer(newLayerIndex);
    if (window.worldEditorScene) {
      window.worldEditorScene.switchLayer(newLayerIndex);
      window.worldEditorScene.currentLayerIndex = newLayerIndex;
    }
    
    // Update palette tab to match layer's sprite sheet
    const layer = layers[newLayerIndex];
    if (layer) {
      setSelectedPaletteTab(layer.spriteSheet);
      setShowPalette(true); // Auto-open palette when switching layers
    }
  };

  // Initialize layer from loaded data
  useEffect(() => {
    if (layers.length > 0 && layers[currentLayer]) {
      setSelectedPaletteTab(layers[currentLayer].spriteSheet);
    }
  }, [layers]);

  const copyTilesToClipboard = () => {
    if (currentTiles) {
      const tilesString = JSON.stringify(currentTiles, null, 2);
      navigator.clipboard.writeText(tilesString).then(() => {
        console.log('World tiles copied to clipboard!');
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  };

  const handlePaletteTileClick = (tileIndex) => {
    setSelectedPaletteTile(tileIndex);
    window.worldEditorSelectedTile = tileIndex;
    if (window.worldEditorScene) {
      window.worldEditorScene.copiedTileIndex = tileIndex;
    }
  };

  const handleTabClick = (tab) => {
    if (selectedPaletteTab === tab && showPalette) {
      // Clicking the same tab closes the palette
      setShowPalette(false);
    } else {
      // Clicking a different tab or reopening
      setSelectedPaletteTab(tab);
      setShowPalette(true);
      
      // Update current layer's sprite sheet
      if (window.worldEditorScene && currentLayer < layers.length) {
        window.worldEditorScene.layers[currentLayer].spriteSheet = tab;
        setLayers([...window.worldEditorScene.layers]);
      }
    }
  };

  return (
    <>
      <div ref={gameRef} className="w-full h-full" />
      
      {/* Copy Button - next to Back to Game */}
      <button
        onClick={copyTilesToClipboard}
        className="fixed top-4 right-[180px] bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors cursor-pointer pointer-events-auto z-10000"
      >
        Copy Layers
      </button>
      
      {/* Layer Selector */}
      <div className="fixed top-4 left-4 bg-black/80 text-white p-3 rounded-lg pointer-events-auto z-10000 flex gap-2 items-center">
        <span className="font-semibold">Layer:</span>
        {layers.map((layer, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              handleLayerChange(index);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className={`px-3 py-1 rounded font-semibold transition-colors cursor-pointer ${
              currentLayer === index
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {layer.name}
          </button>
        ))}
      </div>
      
      {/* Tile Palette Sidebar */}
      {showPalette ? (
        <div 
          className="fixed top-20 right-4 max-h-[calc(100vh-120px)] bg-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto z-9999"
          style={{ width: `${paletteWidth}px` }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleTabClick('tileset');
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className={`flex-1 py-2 px-4 font-semibold transition-colors cursor-pointer ${
                selectedPaletteTab === 'tileset'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Tileset
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleTabClick('objects');
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className={`flex-1 py-2 px-4 font-semibold transition-colors cursor-pointer ${
                selectedPaletteTab === 'objects'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              Objects
            </button>
          </div>
          
          {/* Tile Grid */}
          <div 
            className="flex-1 overflow-y-auto p-3"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <TilePalette
              spriteSheet={selectedPaletteTab === 'tileset' ? 'Tileset_16x16.png' : 'Objects.png'}
              selectedTile={selectedPaletteTile}
              onTileClick={handlePaletteTileClick}
              onWidthChange={setPaletteWidth}
            />
          </div>
          
          {/* Selected Tile Info */}
          {selectedPaletteTile !== null && (
            <div className="bg-gray-900 p-2 border-t border-gray-700 text-white text-sm">
              Selected Tile: <span className="font-bold text-green-400">{selectedPaletteTile}</span>
              <span className="text-gray-400 ml-2">(Press V to paste)</span>
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowPalette(true)}
          className="fixed top-20 right-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors cursor-pointer pointer-events-auto z-9999"
        >
          Show Palette
        </button>
      )}
      
      {/* Instructions */}
      <div className="fixed bottom-4 left-4 bg-black/80 text-white p-4 rounded-lg text-sm max-w-xs pointer-events-auto z-10000">
        <h3 className="font-bold mb-2">World Editor Controls:</h3>
        <ul className="space-y-1">
          <li>• <strong>Left click</strong> tile to edit</li>
          <li>• <strong>Right click drag</strong> to pan</li>
          <li>• <strong>Scroll wheel</strong> to zoom</li>
          <li>• <strong>C</strong> to copy hovered tile</li>
          <li>• <strong>V</strong> to paste selected tile</li>
          <li>• Switch layers to edit different levels</li>
          <li>• Change palette tab for sprite sheet</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-gray-600">
          <div className="text-xs text-gray-300">
            Current Layer: <span className="font-bold text-blue-400">{layers[currentLayer]?.name}</span><br/>
            Sprite Sheet: <span className="font-bold text-green-400">{layers[currentLayer]?.spriteSheet}</span>
          </div>
        </div>
      </div>

      {/* Tile Selector Modal */}
      {showTileSelector && (
        <TileSelectorModal 
          onSelect={handleTileSelect}
          onClose={() => {
            setShowTileSelector(false);
            setSelectedGridPos(null);
          }}
        />
      )}
    </>
  );
}

function TilePalette({ spriteSheet, selectedTile, onTileClick, onWidthChange }) {
  const [tiles, setTiles] = useState([]);
  const [tilesPerRow, setTilesPerRow] = useState(9);

  useEffect(() => {
    const img = new Image();
    img.src = `/spritesheets/${spriteSheet}`;
    img.onload = () => {
      const tpr = Math.floor(img.width / 16);
      const totalTiles = Math.floor(img.width / 16) * Math.floor(img.height / 16);
      const tileArray = Array.from({ length: totalTiles }, (_, i) => i);
      setTilesPerRow(tpr);
      setTiles(tileArray);
      
      // Calculate palette width: tiles * 32px + gaps + padding
      const calculatedWidth = Math.min(tpr * 32 + (tpr - 1) * 2 + 24, 600); // Max 600px
      if (onWidthChange) {
        onWidthChange(calculatedWidth);
      }
    };
  }, [spriteSheet, onWidthChange]);

  return (
    <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${tilesPerRow}, 32px)` }}>
      {tiles.map((tileIndex) => {
        const col = tileIndex % tilesPerRow;
        const row = Math.floor(tileIndex / tilesPerRow);
        
        return (
          <button
            key={tileIndex}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTileClick(tileIndex);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className={`bg-gray-700 hover:bg-blue-600 rounded transition-colors cursor-pointer relative ${
              selectedTile === tileIndex ? 'ring-2 ring-green-400' : ''
            }`}
            style={{
              width: '32px',
              height: '32px',
              padding: 0,
            }}
          >
            <div 
              style={{
                width: '32px',
                height: '32px',
                backgroundImage: `url(/spritesheets/${spriteSheet})`,
                backgroundPosition: `-${col * 32}px -${row * 32}px`,
                backgroundSize: `${tilesPerRow * 32}px auto`,
                imageRendering: 'pixelated',
              }}
            />
            <span className="absolute bottom-0 right-0 bg-black/70 text-white text-[8px] px-0.5 rounded">
              {tileIndex}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TileSelectorModal({ onSelect, onClose }) {
  const [tiles, setTiles] = useState([]);
  const [tilesPerRow, setTilesPerRow] = useState(9);

  useEffect(() => {
    // Load tileset to get frame count
    const img = new Image();
    img.src = '/spritesheets/Tileset_16x16.png';
    img.onload = () => {
      const tpr = Math.floor(img.width / 16);
      const totalTiles = Math.floor(img.width / 16) * Math.floor(img.height / 16);
      const tileArray = Array.from({ length: totalTiles }, (_, i) => i);
      setTilesPerRow(tpr);
      setTiles(tileArray);
    };
  }, []);

  const handleTileClick = (e, tileIndex) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(tileIndex);
  };

  const handleBackgroundClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex justify-center items-center z-10001 pointer-events-auto"
      onClick={handleBackgroundClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-gray-800 p-6 rounded-lg max-w-2xl max-h-[80vh] overflow-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-xl font-bold mb-4">Select Tile</h2>
        
        <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${tilesPerRow}, minmax(0, 1fr))` }}>
          {tiles.map((tileIndex) => {
            const col = tileIndex % tilesPerRow;
            const row = Math.floor(tileIndex / tilesPerRow);
            
            return (
              <button
                key={tileIndex}
                onClick={(e) => handleTileClick(e, tileIndex)}
                onMouseDown={(e) => e.stopPropagation()}
                onMouseUp={(e) => e.stopPropagation()}
                className="bg-gray-700 hover:bg-blue-600 rounded transition-colors cursor-pointer relative overflow-hidden"
                style={{
                  width: '48px',
                  height: '48px',
                  padding: 0,
                }}
              >
                <div 
                  style={{
                    width: '48px',
                    height: '48px',
                    backgroundImage: 'url(/spritesheets/Tileset_16x16.png)',
                    backgroundPosition: `-${col * 48}px -${row * 48}px`,
                    backgroundSize: `${tilesPerRow * 48}px auto`,
                    imageRendering: 'pixelated',
                  }}
                />
                <span className="absolute bottom-0 right-0 bg-black/70 text-white text-xs px-1 rounded">
                  {tileIndex}
                </span>
              </button>
            );
          })}
        </div>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

