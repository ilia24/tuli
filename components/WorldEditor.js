'use client';

import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { getWorld } from '../lib/worldConfig';

export default function WorldEditor({ onBackToGame }) {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);
  const [showTileSelector, setShowTileSelector] = useState(false);
  const [selectedGridPos, setSelectedGridPos] = useState(null);
  const [currentTiles, setCurrentTiles] = useState(null);
  const [selectedPaletteTile, setSelectedPaletteTile] = useState(null);
  const [showPalette, setShowPalette] = useState(true);
  const [paletteWidth, setPaletteWidth] = useState(320);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [layers, setLayers] = useState([]);
  const [showLayerManager, setShowLayerManager] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const paletteStateBeforePreview = useRef(true);
  const [selectedTileGroup, setSelectedTileGroup] = useState(null);
  const [showControls, setShowControls] = useState(false);

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
        this.hoverBorder = null; // Border rectangle for hover effect
        this.selectionRectangle = null; // Visual rectangle for multi-tile selection
        this.selectedTiles = []; // Array of selected tile positions
        this.isSelectingTiles = false;
        this.selectionStartTile = null;
        this.copiedTileGroup = null; // For multi-tile copy/paste
      }

      preload() {
        // Load both sprite sheets
        this.load.spritesheet('tileset', '/spritesheets/Tileset_16x16.png', {
          frameWidth: 16,
          frameHeight: 16,
          spacing: 0,
          margin: 0,
        });
        
        this.load.spritesheet('objects', '/spritesheets/Objects.png', {
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
              
              // Skip null/undefined
              if (tileIndex === null || tileIndex === undefined) {
                this.layerSprites[layerIndex][y][x] = null;
                continue;
              }
              
              // Create sprite for ALL tiles - completely generic, no conditions
              const tile = this.add.image(tileX, tileY, layer.spriteSheet, tileIndex);
              tile.setOrigin(0, 0);
              tile.setScale(scale);
              tile.setDepth(layerIndex);
              tile.setData('tileIndex', tileIndex);
              tile.setData('layerIndex', layerIndex);
              
              this.layerSprites[layerIndex][y][x] = tile;
            }
          }
        });

        // Create hover border (initially invisible)
        this.hoverBorder = this.add.graphics();
        this.hoverBorder.setDepth(10000);
        
        // Create selection rectangle for multi-tile selection
        this.selectionRectangle = this.add.graphics();
        this.selectionRectangle.setDepth(9999);
        
        // After creating all layers, set up interactivity for the initial layer
        this.setupLayerInteractivity(this.currentLayerIndex);
        
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
          } else if (pointer.middleButtonDown()) {
            // Middle mouse - start tile selection
            const gridPos = this.worldToGrid(pointer.worldX, pointer.worldY);
            this.isSelectingTiles = true;
            this.selectionStartTile = gridPos;
            this.selectedTiles = [gridPos];
            this.drawSelectionRectangle(gridPos, gridPos);
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
          } else if (this.isSelectingTiles && pointer.middleButtonDown()) {
            // Update selection rectangle
            const currentTile = this.worldToGrid(pointer.worldX, pointer.worldY);
            this.updateTileSelection(currentTile);
            this.drawSelectionRectangle(this.selectionStartTile, currentTile);
          }
        });

        this.input.on('pointerup', (pointer) => {
          if (pointer.button === 2) { // Right button released
            this.isDragging = false;
          } else if (pointer.button === 1) { // Middle button released
            this.isSelectingTiles = false;
            console.log(`Selected ${this.selectedTiles.length} tiles`);
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
          const layerIndex = this.currentLayerIndex;
          const layer = this.layers[layerIndex];
          
          if (this.selectedTiles.length > 1) {
            // Copy multiple tiles with anchor point
            const anchorTile = this.selectionStartTile;
            const copiedTiles = [];
            
            this.selectedTiles.forEach(pos => {
              const tileIndex = layer.tiles[pos.gridY][pos.gridX];
              copiedTiles.push({
                tileIndex: tileIndex,
                offsetX: pos.gridX - anchorTile.gridX,
                offsetY: pos.gridY - anchorTile.gridY,
              });
            });
            
            this.copiedTileGroup = {
              tiles: copiedTiles,
              layerIndex: layerIndex,
            };
            
            console.log(`Copied ${copiedTiles.length} tiles with anchor at (${anchorTile.gridX}, ${anchorTile.gridY})`);
            
            // Visual feedback - flash green
            this.selectionRectangle.clear();
            const bounds = this.getSelectionBounds();
            const tileSize = 16;
            const scale = 2;
            const x = bounds.minX * tileSize * scale;
            const y = bounds.minY * tileSize * scale;
            const width = (bounds.maxX - bounds.minX + 1) * tileSize * scale;
            const height = (bounds.maxY - bounds.minY + 1) * tileSize * scale;
            
            this.selectionRectangle.lineStyle(3, 0x00ff00, 1);
            this.selectionRectangle.strokeRect(x, y, width, height);
            this.selectionRectangle.fillStyle(0x00ff00, 0.2);
            this.selectionRectangle.fillRect(x, y, width, height);
            
            this.time.delayedCall(200, () => {
              // Clear selection display after copy
              this.clearTileSelection();
            });
          } else if (this.hoveredTile) {
            // Copy single tile
            const tileIndex = layer.tiles[this.hoveredTile.y][this.hoveredTile.x];
            this.copiedTileIndex = tileIndex;
            this.copiedTileGroup = null; // Clear multi-tile copy
            window.worldEditorSelectedTile = tileIndex;
            console.log(`Copied tile ${tileIndex} from position (${this.hoveredTile.x}, ${this.hoveredTile.y})`);
            
            // Visual feedback - flash the tile
            this.hoveredTile.sprite.setTint(0x00ff00);
            this.time.delayedCall(200, () => {
              if (this.hoveredTile) {
                this.hoveredTile.sprite.setTint(0x4444ff);
              }
            });
          }
        });

        this.input.keyboard.on('keydown-V', () => {
          const layerIndex = this.currentLayerIndex;
          
          // Check if we have a copied tile group
          if (this.copiedTileGroup && this.hoveredTile) {
            // Paste multi-tile group with anchor point
            console.log(`Pasting ${this.copiedTileGroup.tiles.length} tiles at (${this.hoveredTile.x}, ${this.hoveredTile.y})`);
            
            this.copiedTileGroup.tiles.forEach(({ tileIndex, offsetX, offsetY }) => {
              const targetX = this.hoveredTile.x + offsetX;
              const targetY = this.hoveredTile.y + offsetY;
              
              if (targetX >= 0 && targetX < 50 && targetY >= 0 && targetY < 50) {
                this.updateTile(targetX, targetY, layerIndex, tileIndex);
              }
            });
            
            return;
          }
          
          const pasteIndex = window.worldEditorSelectedTile !== undefined 
            ? window.worldEditorSelectedTile 
            : this.copiedTileIndex;
            
          if (pasteIndex === null || pasteIndex === undefined) return;
          
          // Check if we have multiple tiles selected for batch fill
          if (this.selectedTiles.length > 1) {
            // Batch paste same tile to all selected tiles
            console.log(`Batch pasting tile ${pasteIndex} to ${this.selectedTiles.length} tiles`);
            
            this.selectedTiles.forEach(pos => {
              this.updateTile(pos.gridX, pos.gridY, layerIndex, pasteIndex);
            });
            
            // Clear selection after pasting
            this.clearTileSelection();
          } else if (this.hoveredTile) {
            // Single tile paste to hovered tile
            console.log(`Pasting tile ${pasteIndex} at (${this.hoveredTile.x}, ${this.hoveredTile.y})`);
            
            this.updateTile(this.hoveredTile.x, this.hoveredTile.y, layerIndex, pasteIndex);
          }
        });

        this.input.keyboard.on('keydown-ESC', () => {
          // Clear tile selection
          if (this.selectedTiles.length > 0) {
            console.log('Clearing tile selection');
            this.clearTileSelection();
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
        
        if (!layer) {
          console.error(`Layer ${layerIndex} does not exist`);
          return;
        }
        
        layer.tiles[y][x] = newTileIndex;
        
        console.log(`Updating tile at (${x}, ${y}) on layer ${layerIndex} (${layer.name}) with tile ${newTileIndex} from sprite sheet: ${layer.spriteSheet}`);
        
        // Remove old sprite if exists
        if (this.layerSprites[layerIndex][y][x]) {
          this.layerSprites[layerIndex][y][x].destroy();
        }
        
        // Create new sprite or interactive zone
        if (newTileIndex !== null && newTileIndex !== undefined) {
          const tileSize = 16;
          const scale = 2;
          const tileX = x * tileSize * scale;
          const tileY = y * tileSize * scale;
          
          // Create sprite for all tiles
          const tile = this.add.image(tileX, tileY, layer.spriteSheet, newTileIndex);
          tile.setOrigin(0, 0);
          tile.setScale(scale);
          
          tile.setDepth(layerIndex);
          tile.setData('tileIndex', newTileIndex);
          
          // Only show if this is the active layer
          if (layerIndex === this.currentLayerIndex) {
            tile.setVisible(true);
            tile.setInteractive();
            
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
          } else {
            tile.setVisible(false);
          }
          
          this.layerSprites[layerIndex][y][x] = tile;
        } else {
          this.layerSprites[layerIndex][y][x] = null;
        }
        
        // Update state and log
        setCurrentTiles(JSON.parse(JSON.stringify(this.layers)));
        console.log(this.layers)
      }

      setupLayerInteractivity(activeLayerIndex) {
        console.log(`Setting up interactivity for layer ${activeLayerIndex}`);
        let activeCount = 0;
        let inactiveCount = 0;
        
        // COMPLETELY GENERIC - works exactly the same for ALL sprite sheets
        this.layerSprites.forEach((layer, layerIndex) => {
          if (!layer) {
            console.log(`Layer ${layerIndex} is null`);
            return;
          }
          
          layer.forEach((row, y) => {
            if (!row) return;
            
            row.forEach((tile, x) => {
              if (!tile) return;
              
              // Remove all old listeners
              tile.removeAllListeners();
              
              // Clear visual effects
              if (tile.clearTint) {
                tile.clearTint();
              }
              
              if (layerIndex === activeLayerIndex) {
                // ACTIVE LAYER - show and make fully interactive
                tile.setVisible(true);
                tile.setDepth(1000 + layerIndex);
                tile.setAlpha(1);
                tile.setInteractive();
                
                activeCount++;
                
                // Add event listeners - IDENTICAL for all layers
                tile.on('pointerdown', (pointer) => {
                  if (pointer.leftButtonDown() && !this.isDragging) {
                    console.log(`Clicked tile at (${x}, ${y}) on layer ${layerIndex}`);
                    setSelectedGridPos({ x, y, layer: layerIndex });
                    setShowTileSelector(true);
                  }
                });

                tile.on('pointerover', () => {
                  console.log(`Hover over tile at (${x}, ${y}) on layer ${layerIndex}`);
                  
                  // Draw border around hovered tile
                  const tileSize = 16;
                  const scale = 2;
                  this.hoverBorder.clear();
                  this.hoverBorder.lineStyle(3, 0x00ffff, 1); // Bright cyan border
                  this.hoverBorder.strokeRect(
                    tile.x - 1.5, 
                    tile.y - 1.5, 
                    tileSize * scale + 3, 
                    tileSize * scale + 3
                  );
                  
                  // Also add a subtle tint for non-transparent sprites
                  if (tile.setTint) {
                    tile.setTint(0x4444ff);
                  }
                  
                  this.hoveredTile = { x, y, sprite: tile, layer: layerIndex };
                });
                
                tile.on('pointerout', () => {
                  // Clear border
                  this.hoverBorder.clear();
                  
                  // Clear tint
                  if (tile.clearTint) {
                    tile.clearTint();
                  }
                  
                  if (this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y) {
                    this.hoveredTile = null;
                  }
                });
              } else {
                // INACTIVE LAYER - hide completely
                tile.setVisible(false);
                tile.disableInteractive();
                inactiveCount++;
              }
            });
          });
        });
        
        console.log(`Setup complete: ${activeCount} active tiles, ${inactiveCount} inactive tiles`);
      }

      switchLayer(newLayerIndex) {
        this.currentLayerIndex = newLayerIndex;
        this.hoveredTile = null;
        
        // Clear any tile selection when switching layers
        this.clearTileSelection();
        
        // Use generic setup - works the same for ALL layers
        this.setupLayerInteractivity(newLayerIndex);
      }

      enterPreviewMode() {
        console.log('Entering preview mode - showing all layers');
        
        // Clear hover border and selection
        this.hoverBorder.clear();
        this.clearTileSelection();
        
        // Show all layers, make them non-interactive
        this.layerSprites.forEach((layer, layerIndex) => {
          if (!layer) return;
          
          layer.forEach((row) => {
            if (!row) return;
            
            row.forEach((tile) => {
              if (!tile) return;
              
              tile.setVisible(true);
              tile.setAlpha(1);
              tile.setDepth(layerIndex); // Render in correct order
              tile.disableInteractive();
              tile.removeAllListeners();
              
              if (tile.clearTint) {
                tile.clearTint();
              }
            });
          });
        });
        
        this.hoveredTile = null;
      }

      exitPreviewMode() {
        console.log('Exiting preview mode - showing single layer');
        // Return to single layer editing mode
        this.setupLayerInteractivity(this.currentLayerIndex);
      }

      worldToGrid(worldX, worldY) {
        // Convert world coordinates to grid coordinates
        const tileSize = 16;
        const scale = 2;
        const gridX = Math.floor(worldX / (tileSize * scale));
        const gridY = Math.floor(worldY / (tileSize * scale));
        return { gridX, gridY };
      }

      updateTileSelection(currentTile) {
        if (!this.selectionStartTile) return;
        
        const minX = Math.min(this.selectionStartTile.gridX, currentTile.gridX);
        const maxX = Math.max(this.selectionStartTile.gridX, currentTile.gridX);
        const minY = Math.min(this.selectionStartTile.gridY, currentTile.gridY);
        const maxY = Math.max(this.selectionStartTile.gridY, currentTile.gridY);
        
        this.selectedTiles = [];
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            this.selectedTiles.push({ gridX: x, gridY: y });
          }
        }
      }

      drawSelectionRectangle(startTile, endTile) {
        this.selectionRectangle.clear();
        
        const minX = Math.min(startTile.gridX, endTile.gridX);
        const maxX = Math.max(startTile.gridX, endTile.gridX);
        const minY = Math.min(startTile.gridY, endTile.gridY);
        const maxY = Math.max(startTile.gridY, endTile.gridY);
        
        const tileSize = 16;
        const scale = 2;
        const x = minX * tileSize * scale;
        const y = minY * tileSize * scale;
        const width = (maxX - minX + 1) * tileSize * scale;
        const height = (maxY - minY + 1) * tileSize * scale;
        
        // Draw selection rectangle
        this.selectionRectangle.lineStyle(3, 0xffff00, 1); // Yellow border
        this.selectionRectangle.strokeRect(x, y, width, height);
        
        // Fill with semi-transparent yellow
        this.selectionRectangle.fillStyle(0xffff00, 0.2);
        this.selectionRectangle.fillRect(x, y, width, height);
      }

      getSelectionBounds() {
        if (this.selectedTiles.length === 0) return null;
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        this.selectedTiles.forEach(pos => {
          minX = Math.min(minX, pos.gridX);
          maxX = Math.max(maxX, pos.gridX);
          minY = Math.min(minY, pos.gridY);
          maxY = Math.max(maxY, pos.gridY);
        });
        
        return { minX, maxX, minY, maxY };
      }

      clearTileSelection() {
        this.selectedTiles = [];
        this.selectionStartTile = null;
        this.isSelectingTiles = false;
        this.selectionRectangle.clear();
      }

      placeTileGroup(clickedX, clickedY, layerIndex, selection) {
        // Place multiple tiles using anchor point (where user first clicked in modal)
        const { anchorTile, tiles, tilesPerRow } = selection;
        
        console.log(`Placing ${tiles.length} tiles with anchor at tile ${anchorTile}`);
        console.log(`Clicked world position: (${clickedX}, ${clickedY})`);
        
        // Place each tile based on its offset from the anchor point
        tiles.forEach(({ tileIndex, offsetX, offsetY }) => {
          const targetX = clickedX + offsetX;
          const targetY = clickedY + offsetY;
          
          console.log(`  Placing tile ${tileIndex} at (${targetX}, ${targetY}) [offset: ${offsetX}, ${offsetY}]`);
          
          // Check bounds
          if (targetX >= 0 && targetX < 50 && targetY >= 0 && targetY < 50) {
            this.updateTile(targetX, targetY, layerIndex, tileIndex);
          }
        });
      }

      addLayer(layer, layerIndex) {
        const world = getWorld('tutorial');
        const tileSize = 16;
        const scale = 2;
        
        this.layerSprites[layerIndex] = [];
        
        // Create interactive zones for all tiles (including 0s)
        for (let y = 0; y < world.height; y++) {
          this.layerSprites[layerIndex][y] = [];
          for (let x = 0; x < world.width; x++) {
            const tileIndex = layer.tiles[y][x];
            const tileX = x * tileSize * scale;
            const tileY = y * tileSize * scale;
            
            if (tileIndex === null || tileIndex === undefined) {
              this.layerSprites[layerIndex][y][x] = null;
              continue;
            }
            
            // Create sprite for all tiles
            const tile = this.add.image(tileX, tileY, layer.spriteSheet, tileIndex);
            tile.setOrigin(0, 0);
            tile.setScale(scale);
            
            tile.setDepth(layerIndex);
            tile.setData('tileIndex', tileIndex);
            
            if (layerIndex === this.currentLayerIndex) {
              tile.setInteractive(
                new Phaser.Geom.Rectangle(0, 0, tileSize * scale, tileSize * scale),
                Phaser.Geom.Rectangle.Contains
              );
              
              tile.on('pointerdown', (pointer) => {
                if (pointer.leftButtonDown() && !this.isDragging) {
                  setSelectedGridPos({ x, y, layer: layerIndex });
                  setShowTileSelector(true);
                }
              });

              tile.on('pointerover', () => {
                tile.setTint(0x4444ff); // Brighter blue
                this.hoveredTile = { x, y, sprite: tile, layer: layerIndex };
              });
              
              tile.on('pointerout', () => {
                tile.clearTint();
                if (this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y) {
                  this.hoveredTile = null;
                }
              });
            } else {
              tile.setVisible(false);
            }
            
            this.layerSprites[layerIndex][y][x] = tile;
          }
        }
      }

      refreshLayer(layerIndex) {
        // Delete all sprites in this layer
        this.layerSprites[layerIndex].forEach(row => {
          row.forEach(tile => {
            if (tile) tile.destroy();
          });
        });
        
        // Recreate layer sprites
        const world = getWorld('tutorial');
        const layer = this.layers[layerIndex];
        const tileSize = 16;
        const scale = 2;
        
        this.layerSprites[layerIndex] = [];
        
        for (let y = 0; y < world.height; y++) {
          this.layerSprites[layerIndex][y] = [];
          for (let x = 0; x < world.width; x++) {
            const tileIndex = layer.tiles[y][x];
            
            if (tileIndex === null || tileIndex === undefined) {
              this.layerSprites[layerIndex][y][x] = null;
              continue;
            }
            
            const tileX = x * tileSize * scale;
            const tileY = y * tileSize * scale;
            
            // Create sprite for all tiles
            const tile = this.add.image(tileX, tileY, layer.spriteSheet, tileIndex);
            tile.setOrigin(0, 0);
            tile.setScale(scale);
            
            tile.setDepth(layerIndex);
            tile.setData('tileIndex', tileIndex);
            
            // Only show if this is the active layer
            if (layerIndex === this.currentLayerIndex) {
              tile.setVisible(true);
              tile.setInteractive();
              
              tile.on('pointerdown', (pointer) => {
                if (pointer.leftButtonDown() && !this.isDragging) {
                  setSelectedGridPos({ x, y, layer: layerIndex });
                  setShowTileSelector(true);
                }
              });

              tile.on('pointerover', () => {
                tile.setTint(0x4444ff); // Brighter blue
                this.hoveredTile = { x, y, sprite: tile, layer: layerIndex };
              });
              
              tile.on('pointerout', () => {
                tile.clearTint();
                if (this.hoveredTile && this.hoveredTile.x === x && this.hoveredTile.y === y) {
                  this.hoveredTile = null;
                }
              });
            } else {
              tile.setVisible(false);
            }
            
            this.layerSprites[layerIndex][y][x] = tile;
          }
        }
      }

      deleteLayerSprites(layerIndex) {
        if (this.layerSprites[layerIndex]) {
          this.layerSprites[layerIndex].forEach(row => {
            row.forEach(tile => {
              if (tile) tile.destroy();
            });
          });
          
          this.layerSprites.splice(layerIndex, 1);
          
          // Update depths for remaining layers
          this.layerSprites.forEach((layer, index) => {
            layer.forEach(row => {
              row.forEach(tile => {
                if (tile) tile.setDepth(index);
              });
            });
          });
        }
      }

      reorderLayers(newLayerOrder, oldIndex, newIndex) {
        // Swap the sprite arrays to match the new layer order
        const tempSprites = this.layerSprites[oldIndex];
        this.layerSprites[oldIndex] = this.layerSprites[newIndex];
        this.layerSprites[newIndex] = tempSprites;
        
        // Update depths based on new order
        this.layerSprites.forEach((layer, index) => {
          layer.forEach(row => {
            row.forEach(tile => {
              if (tile) {
                tile.setDepth(index);
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

  const handleTileSelect = (selection) => {
    if (selectedGridPos && window.worldEditorScene) {
      // selection can be a single index or a group {anchorTile, tiles, tilesPerRow}
      if (typeof selection === 'number') {
        // Single tile
        window.worldEditorScene.updateTile(
          selectedGridPos.x, 
          selectedGridPos.y,
          selectedGridPos.layer !== undefined ? selectedGridPos.layer : currentLayer,
          selection
        );
      } else {
        // Multiple tiles - anchor point is where user first clicked
        window.worldEditorScene.placeTileGroup(
          selectedGridPos.x,
          selectedGridPos.y,
          selectedGridPos.layer !== undefined ? selectedGridPos.layer : currentLayer,
          selection
        );
      }
    }
    setShowTileSelector(false);
    setSelectedGridPos(null);
  };

  const handleLayerChange = (newLayerIndex) => {
    setCurrentLayer(newLayerIndex);
    
    // Reset palette states
    setSelectedPaletteTile(null);
    window.worldEditorSelectedTile = null;
    
    if (window.worldEditorScene) {
      // Clear hover state
      window.worldEditorScene.hoveredTile = null;
      window.worldEditorScene.copiedTileIndex = null;
      
      // Switch layer
      if (previewMode) {
        window.worldEditorScene.exitPreviewMode();
        setPreviewMode(false);
      }
      
      window.worldEditorScene.switchLayer(newLayerIndex);
      window.worldEditorScene.currentLayerIndex = newLayerIndex;
    }
    
    // Palette always shows the current layer's sprite sheet (no manual switching)
    setShowPalette(true);
  };

  const togglePreviewMode = () => {
    if (window.worldEditorScene) {
      if (previewMode) {
        // Exiting preview mode
        window.worldEditorScene.exitPreviewMode();
        window.worldEditorScene.setupLayerInteractivity(currentLayer);
        
        // Restore palette state
        setShowPalette(paletteStateBeforePreview.current);
      } else {
        // Entering preview mode
        paletteStateBeforePreview.current = showPalette; // Save current state
        window.worldEditorScene.enterPreviewMode();
        
        // Hide palette in preview mode
        setShowPalette(false);
      }
    }
    setPreviewMode(!previewMode);
  };

  const copyTilesToClipboard = () => {
    if (layers.length > 0) {
      const layersString = JSON.stringify(layers, null, 2);
      navigator.clipboard.writeText(layersString).then(() => {
        console.log('Layers copied to clipboard!');
        console.log('Layers object:');
        console.log(layersString);
      }).catch(err => {
        console.error('Failed to copy:', err);
      });
    }
  };

  const addNewLayer = () => {
    const world = getWorld('tutorial');
    const newLayer = {
      name: `Layer ${layers.length + 1}`,
      spriteSheet: 'tileset',
      visible: true,
      tiles: Array(world.height).fill(null).map(() => Array(world.width).fill(0)),
    };
    
    const updatedLayers = [...layers, newLayer];
    setLayers(updatedLayers);
    
    if (window.worldEditorScene) {
      window.worldEditorScene.layers = updatedLayers;
      window.worldEditorScene.addLayer(newLayer, updatedLayers.length - 1);
    }
  };

  const updateLayerName = (layerIndex, newName) => {
    const updatedLayers = [...layers];
    updatedLayers[layerIndex].name = newName;
    setLayers(updatedLayers);
    
    if (window.worldEditorScene) {
      window.worldEditorScene.layers = updatedLayers;
    }
  };

  const updateLayerSpriteSheet = (layerIndex, newSpriteSheet) => {
    const updatedLayers = [...layers];
    updatedLayers[layerIndex].spriteSheet = newSpriteSheet;
    setLayers(updatedLayers);
    
    if (window.worldEditorScene) {
      window.worldEditorScene.layers = updatedLayers;
      // Refresh the layer rendering
      window.worldEditorScene.refreshLayer(layerIndex);
    }
  };

  const deleteLayer = (layerIndex) => {
    if (layers.length <= 1) {
      alert('Cannot delete the last layer!');
      return;
    }
    
    const updatedLayers = layers.filter((_, i) => i !== layerIndex);
    setLayers(updatedLayers);
    
    if (window.worldEditorScene) {
      window.worldEditorScene.layers = updatedLayers;
      window.worldEditorScene.deleteLayerSprites(layerIndex);
    }
    
    // Adjust current layer if needed
    if (currentLayer >= updatedLayers.length) {
      handleLayerChange(updatedLayers.length - 1);
    }
  };

  const moveLayerUp = (layerIndex) => {
    if (layerIndex === 0) return; // Already at top
    
    const updatedLayers = [...layers];
    const targetIndex = layerIndex - 1;
    
    // Swap with layer above
    [updatedLayers[targetIndex], updatedLayers[layerIndex]] = 
    [updatedLayers[layerIndex], updatedLayers[targetIndex]];
    
    setLayers(updatedLayers);
    
    // Update current layer tracking
    let newCurrentLayer = currentLayer;
    if (currentLayer === layerIndex) {
      newCurrentLayer = targetIndex;
    } else if (currentLayer === targetIndex) {
      newCurrentLayer = layerIndex;
    }
    
    if (window.worldEditorScene) {
      window.worldEditorScene.layers = updatedLayers;
      window.worldEditorScene.reorderLayers(updatedLayers, layerIndex, targetIndex);
      window.worldEditorScene.currentLayerIndex = newCurrentLayer;
      window.worldEditorScene.switchLayer(newCurrentLayer);
    }
    
    setCurrentLayer(newCurrentLayer);
  };

  const moveLayerDown = (layerIndex) => {
    if (layerIndex === layers.length - 1) return; // Already at bottom
    
    const updatedLayers = [...layers];
    const targetIndex = layerIndex + 1;
    
    // Swap with layer below
    [updatedLayers[layerIndex], updatedLayers[targetIndex]] = 
    [updatedLayers[targetIndex], updatedLayers[layerIndex]];
    
    setLayers(updatedLayers);
    
    // Update current layer tracking
    let newCurrentLayer = currentLayer;
    if (currentLayer === layerIndex) {
      newCurrentLayer = targetIndex;
    } else if (currentLayer === targetIndex) {
      newCurrentLayer = layerIndex;
    }
    
    if (window.worldEditorScene) {
      window.worldEditorScene.layers = updatedLayers;
      window.worldEditorScene.reorderLayers(updatedLayers, layerIndex, targetIndex);
      window.worldEditorScene.currentLayerIndex = newCurrentLayer;
      window.worldEditorScene.switchLayer(newCurrentLayer);
    }
    
    setCurrentLayer(newCurrentLayer);
  };

  const handlePaletteTileClick = (tileIndex) => {
    setSelectedPaletteTile(tileIndex);
    window.worldEditorSelectedTile = tileIndex;
    if (window.worldEditorScene) {
      window.worldEditorScene.copiedTileIndex = tileIndex;
    }
    console.log(`Selected tile ${tileIndex} from palette (layer: ${layers[currentLayer]?.name}, sheet: ${layers[currentLayer]?.spriteSheet})`);
  };

  const togglePalette = () => {
    setShowPalette(!showPalette);
  };

  return (
    <>
      <div ref={gameRef} className="w-full h-full" />
      
      {/* Layer Controls - Top Left */}
      <div className="fixed top-4 left-4 bg-black/90 text-white p-3 rounded-lg pointer-events-auto z-10000 flex gap-3 items-center">
        <span className="font-semibold">Layers:</span>
        {!previewMode && layers.map((layer, index) => (
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePreviewMode();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          className={`px-3 py-1 rounded font-semibold cursor-pointer ${
            previewMode
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
          }`}
        >
          {previewMode ? 'Exit Preview' : 'Preview'}
        </button>
        {!previewMode && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowLayerManager(true);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white font-semibold cursor-pointer"
          >
            Manage
          </button>
        )}
        
        {/* Action buttons to the right of layer menu */}
        <div className="flex gap-2 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyTilesToClipboard();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-700 text-white font-semibold cursor-pointer"
          >
            Copy Layers
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onBackToGame) onBackToGame();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer"
          >
            Back to Game
          </button>
        </div>
      </div>
      
      {/* Tile Palette Sidebar - Top Right, hide in preview mode */}
      {showPalette && !previewMode ? (
        <div 
          className="fixed top-4 right-4 max-h-[calc(100vh-32px)] bg-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto z-9999"
          style={{ width: `${paletteWidth}px` }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gray-700 p-2 border-b border-gray-600">
            <span className="text-white font-semibold px-2">
              {layers[currentLayer]?.spriteSheet === 'tileset' ? 'Tileset' : 'Objects'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePalette();
              }}
              className="text-gray-300 hover:text-white px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
          
          {/* Tile Grid */}
          <div 
            className="flex-1 overflow-y-auto p-3"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
          >
            {layers[currentLayer] && (
              <TilePalette
                spriteSheet={layers[currentLayer].spriteSheet === 'tileset' ? 'Tileset_16x16.png' : 'Objects.png'}
                selectedTile={selectedPaletteTile}
                onTileClick={handlePaletteTileClick}
                onWidthChange={setPaletteWidth}
              />
            )}
          </div>
          
          {/* Selected Tile Info */}
          {selectedPaletteTile !== null && (
            <div className="bg-gray-900 p-2 border-t border-gray-700 text-white text-sm">
              Selected Tile: <span className="font-bold text-green-400">{selectedPaletteTile}</span>
              <span className="text-gray-400 ml-2">(Press V to paste)</span>
            </div>
          )}
        </div>
      ) : !previewMode && (
        <button
          onClick={() => setShowPalette(true)}
          className="fixed top-4 right-4 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors cursor-pointer pointer-events-auto z-9999"
        >
          Show Palette
        </button>
      )}
      
      {/* Instructions - Collapsible */}
      {!previewMode && (
        <div className="fixed bottom-4 left-4 pointer-events-auto z-10000">
          {showControls ? (
            <div 
              className="bg-black/80 text-white p-4 rounded-lg text-sm max-w-xs"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold">World Editor Controls</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowControls(false);
                  }}
                  className="text-gray-300 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <ul className="space-y-0.5 text-xs">
                <li>• <strong>Left click</strong> tile to edit</li>
                <li>• <strong>Right click drag</strong> to pan</li>
                <li>• <strong>Middle click drag</strong> to select area</li>
                <li>• <strong>Scroll wheel</strong> to zoom</li>
                <li>• <strong>C</strong> to copy (single or group)</li>
                <li>• <strong>V</strong> to paste (maintains layout)</li>
                <li>• <strong>Esc</strong> to clear selection</li>
              </ul>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowControls(true);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              className="bg-black/80 hover:bg-black/90 text-white px-4 py-2 rounded-lg font-semibold cursor-pointer"
            >
              Controls
            </button>
          )}
        </div>
      )}
      
      {/* Layer Manager Modal */}
      {showLayerManager && (
        <LayerManagerModal
          layers={layers}
          currentLayer={currentLayer}
          onClose={() => setShowLayerManager(false)}
          onAddLayer={addNewLayer}
          onRenameLayer={updateLayerName}
          onChangeSpriteSheet={updateLayerSpriteSheet}
          onDeleteLayer={deleteLayer}
          onSelectLayer={handleLayerChange}
          onMoveLayerUp={moveLayerUp}
          onMoveLayerDown={moveLayerDown}
        />
      )}

      {/* Tile Selector Modal */}
      {showTileSelector && layers[currentLayer] && (
        <TileSelectorModal 
          spriteSheet={layers[currentLayer].spriteSheet === 'tileset' ? 'Tileset_16x16.png' : 'Objects.png'}
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

function LayerManagerModal({ layers, currentLayer, onClose, onAddLayer, onRenameLayer, onChangeSpriteSheet, onDeleteLayer, onSelectLayer, onMoveLayerUp, onMoveLayerDown }) {
  const [editingLayer, setEditingLayer] = useState(null);
  const [editName, setEditName] = useState('');

  const startEditing = (index, currentName) => {
    setEditingLayer(index);
    setEditName(currentName);
  };

  const saveEdit = (index) => {
    if (editName.trim()) {
      onRenameLayer(index, editName.trim());
    }
    setEditingLayer(null);
  };

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex justify-center items-center z-10001 pointer-events-auto"
      onClick={onClose}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-gray-800 p-6 rounded-lg max-w-md w-full max-h-[80vh] overflow-auto pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-2xl font-bold mb-4">Layer Manager</h2>
        
        <div className="space-y-2 mb-4">
          {layers.map((layer, index) => (
            <div 
              key={index}
              className={`bg-gray-700 p-3 rounded-lg ${currentLayer === index ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="flex items-center gap-2 mb-2">
                {/* Layer reorder buttons */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveLayerUp(index);
                    }}
                    disabled={index === 0}
                    className={`px-1.5 py-0.5 text-xs rounded ${
                      index === 0 
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-600 hover:bg-gray-500 text-white cursor-pointer'
                    }`}
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveLayerDown(index);
                    }}
                    disabled={index === layers.length - 1}
                    className={`px-1.5 py-0.5 text-xs rounded ${
                      index === layers.length - 1
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                        : 'bg-gray-600 hover:bg-gray-500 text-white cursor-pointer'
                    }`}
                  >
                    ▼
                  </button>
                </div>
                {editingLayer === index ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:outline-none focus:border-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(index);
                        if (e.key === 'Escape') setEditingLayer(null);
                      }}
                    />
                    <button
                      onClick={() => saveEdit(index)}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm cursor-pointer"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingLayer(null)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm cursor-pointer"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-white font-semibold">{layer.name}</span>
                    <button
                      onClick={() => startEditing(index, layer.name)}
                      className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs cursor-pointer"
                    >
                      Rename
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-sm">Sprite Sheet:</span>
                <select
                  value={layer.spriteSheet}
                  onChange={(e) => onChangeSpriteSheet(index, e.target.value)}
                  className="flex-1 px-2 py-1 bg-gray-600 text-white rounded text-sm cursor-pointer focus:outline-none focus:border-blue-500"
                >
                  <option value="tileset">Tileset</option>
                  <option value="objects">Objects</option>
                </select>
                
                {layers.length > 1 && (
                  <button
                    onClick={() => {
                      if (confirm(`Delete layer "${layer.name}"?`)) {
                        onDeleteLayer(index);
                      }
                    }}
                    className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs cursor-pointer"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddLayer();
          }}
          className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg cursor-pointer mb-4"
        >
          + Add New Layer
        </button>
        
        <button
          onClick={onClose}
          className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-500 text-white font-bold rounded-lg cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
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

function TileSelectorModal({ spriteSheet, onSelect, onClose }) {
  const [tiles, setTiles] = useState([]);
  const [tilesPerRow, setTilesPerRow] = useState(9);
  const [dragStart, setDragStart] = useState(null);
  const [dragEnd, setDragEnd] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    // Load the appropriate sprite sheet
    const img = new Image();
    img.src = `/spritesheets/${spriteSheet}`;
    img.onload = () => {
      const tpr = Math.floor(img.width / 16);
      const totalTiles = Math.floor(img.width / 16) * Math.floor(img.height / 16);
      const tileArray = Array.from({ length: totalTiles }, (_, i) => i);
      setTilesPerRow(tpr);
      setTiles(tileArray);
    };
  }, [spriteSheet]);

  const handleTileMouseDown = (e, tileIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragStart(tileIndex);
    setDragEnd(tileIndex);
    setIsDragging(true);
  };

  const handleTileMouseEnter = (tileIndex) => {
    if (isDragging) {
      setDragEnd(tileIndex);
    }
  };

  const handleTileMouseUp = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dragStart !== null && dragEnd !== null) {
      if (dragStart === dragEnd) {
        // Single tile selection
        onSelect(dragStart);
      } else {
        // Multi-tile selection with anchor point
        const bounds = getSelectionBounds();
        const selectedTiles = [];
        
        // Collect all tiles in the selection rectangle
        for (let row = bounds.minRow; row <= bounds.maxRow; row++) {
          for (let col = bounds.minCol; col <= bounds.maxCol; col++) {
            const tileIndex = row * tilesPerRow + col;
            selectedTiles.push({
              tileIndex: tileIndex,
              offsetX: col - (dragStart % tilesPerRow), // Offset from anchor
              offsetY: row - Math.floor(dragStart / tilesPerRow),
            });
          }
        }
        
        const selection = {
          anchorTile: dragStart, // The tile they first clicked
          tiles: selectedTiles,
          tilesPerRow: tilesPerRow,
        };
        onSelect(selection);
      }
    }
    
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const getSelectionBounds = () => {
    if (dragStart === null || dragEnd === null) return null;
    
    const startCol = dragStart % tilesPerRow;
    const startRow = Math.floor(dragStart / tilesPerRow);
    const endCol = dragEnd % tilesPerRow;
    const endRow = Math.floor(dragEnd / tilesPerRow);
    
    return {
      minCol: Math.min(startCol, endCol),
      maxCol: Math.max(startCol, endCol),
      minRow: Math.min(startRow, endRow),
      maxRow: Math.max(startRow, endRow),
    };
  };

  const isTileInSelection = (tileIndex) => {
    const bounds = getSelectionBounds();
    if (!bounds) return false;
    
    const col = tileIndex % tilesPerRow;
    const row = Math.floor(tileIndex / tilesPerRow);
    
    return col >= bounds.minCol && col <= bounds.maxCol &&
           row >= bounds.minRow && row <= bounds.maxRow;
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
        
        <div 
          className="grid gap-0.5 select-none" 
          style={{ gridTemplateColumns: `repeat(${tilesPerRow}, minmax(0, 1fr))` }}
          onMouseUp={handleTileMouseUp}
          onMouseLeave={() => {
            if (isDragging) {
              handleTileMouseUp({ preventDefault: () => {}, stopPropagation: () => {} });
            }
          }}
        >
          {tiles.map((tileIndex) => {
            const col = tileIndex % tilesPerRow;
            const row = Math.floor(tileIndex / tilesPerRow);
            const isSelected = isTileInSelection(tileIndex);
            
            return (
              <button
                key={tileIndex}
                onMouseDown={(e) => handleTileMouseDown(e, tileIndex)}
                onMouseEnter={() => handleTileMouseEnter(tileIndex)}
                className={`rounded transition-colors cursor-pointer relative overflow-hidden ${
                  isSelected 
                    ? 'bg-blue-500 ring-2 ring-cyan-400' 
                    : 'bg-gray-700 hover:bg-blue-600'
                }`}
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
                    backgroundImage: `url(/spritesheets/${spriteSheet})`,
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

