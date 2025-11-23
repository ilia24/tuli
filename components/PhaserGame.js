'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { getWorld, isTileWalkable } from '../lib/worldConfig';

export default function PhaserGame() {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);

  useEffect(() => {
    if (phaserGameRef.current || !gameRef.current) return;

    // Main game scene
    class IslandScene extends Phaser.Scene {
      constructor() {
        super({ key: 'IslandScene' });
        this.player = null;
        this.playerSprites = null; // Container for 4-tile player
        this.targetMarker = null;
        this.isMoving = false;
        this.currentDirection = 'front';
        this.currentWorld = null;
        this.tileSize = 16;
      }

      preload() {
        // Load sprite sheets (16x16) with spacing/margin if needed
        this.load.spritesheet('tileset', '/spritesheets/Tileset_16x16.png', {
          frameWidth: 16,
          frameHeight: 16,
          spacing: 0,  // Space between tiles (if your sheet has it)
          margin: 0,   // Margin around the sheet
        });
        
        this.load.spritesheet('player-sprite', '/spritesheets/Player.png', {
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
        const width = this.scale.width;
        const height = this.scale.height;

        // Set texture filtering to NEAREST for pixel-perfect rendering
        this.textures.get('tileset').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('objects').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('player-sprite').setFilter(Phaser.Textures.FilterMode.NEAREST);

        // Load the world configuration
        this.currentWorld = getWorld('tutorial');

        // Create background (dirt)
        const background = this.add.graphics();
        background.fillStyle(0x8B7355, 1); // Dirt brown
        background.fillRect(0, 0, width, height);

        // Build world from configuration
        this.worldOffsetX = (width / 2) - (this.currentWorld.width * this.tileSize) / 2;
        this.worldOffsetY = (height / 2) - (this.currentWorld.height * this.tileSize) / 2;
        this.createWorldFromLayers();

        // Create player at spawn point
        const spawnX = this.worldOffsetX + (this.currentWorld.spawnPoint.x * this.tileSize);
        const spawnY = this.worldOffsetY + (this.currentWorld.spawnPoint.y * this.tileSize);
        this.createPlayer(spawnX, spawnY);

        // Create target marker (initially hidden)
        this.targetMarker = this.add.circle(0, 0, 8, 0xFFFF00, 0);
        this.targetMarker.setStrokeStyle(2, 0xFFFF00);
        this.targetMarker.setDepth(50);

        // Enable click/tap to move
        this.input.on('pointerdown', (pointer) => {
          // Use worldX and worldY to account for camera movement
          this.movePlayerTo(pointer.worldX, pointer.worldY);
        });

        // Add camera to follow player
        this.cameras.main.startFollow(this.playerSprites, true, 0.1, 0.1);
        this.cameras.main.setZoom(2); // Zoom in to see the 16x16 sprites better
      }

      createPlayer(x, y) {
        // Create a container for the 4-tile player sprite
        this.playerSprites = this.add.container(x, y);
        
        // Create the 4 tiles that make up the player (front facing by default)
        // Player is 2x2 tiles (32x32 pixels total from 16x16 tiles)
        const topLeft = this.add.image(-8, -8, 'player-sprite', 0);
        const topRight = this.add.image(8, -8, 'player-sprite', 1);
        const bottomLeft = this.add.image(-8, 8, 'player-sprite', 8);
        const bottomRight = this.add.image(8, 8, 'player-sprite', 9);
        
        this.playerSprites.add([topLeft, topRight, bottomLeft, bottomRight]);
        this.playerSprites.setDepth(100);
        
        // Store references to individual sprite parts
        this.playerSprites.topLeft = topLeft;
        this.playerSprites.topRight = topRight;
        this.playerSprites.bottomLeft = bottomLeft;
        this.playerSprites.bottomRight = bottomRight;
      }

      updatePlayerDirection(targetX, targetY) {
        const dx = targetX - this.playerSprites.x;
        const dy = targetY - this.playerSprites.y;
        
        // Determine direction based on larger delta
        let newDirection = this.currentDirection;
        
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal movement
          newDirection = dx > 0 ? 'right' : 'left';
        } else {
          // Vertical movement
          newDirection = dy > 0 ? 'front' : 'back';
        }
        
        if (newDirection !== this.currentDirection) {
          this.currentDirection = newDirection;
          this.setPlayerSprites(newDirection);
        }
      }

      setPlayerSprites(direction) {
        // Sprite indices for each direction (top-left, top-right, bottom-left, bottom-right)
        const sprites = {
          'front': [0, 1, 8, 9],
          'right': [2, 3, 10, 11],
          'left': [4, 5, 12, 13],
          'back': [6, 7, 14, 15],
        };
        
        const frames = sprites[direction];
        this.playerSprites.topLeft.setFrame(frames[0]);
        this.playerSprites.topRight.setFrame(frames[1]);
        this.playerSprites.bottomLeft.setFrame(frames[2]);
        this.playerSprites.bottomRight.setFrame(frames[3]);
      }

      createWorldFromLayers() {
        // Create tiles based on layers configuration
        this.currentWorld.layers.forEach((layer, layerIndex) => {
          if (!layer.visible) return;
          
          for (let y = 0; y < this.currentWorld.height; y++) {
            for (let x = 0; x < this.currentWorld.width; x++) {
              const tileIndex = layer.tiles[y][x];
              
              // Skip null/empty tiles
              if (tileIndex === null || tileIndex === undefined) continue;
              
              const tileX = this.worldOffsetX + (x * this.tileSize);
              const tileY = this.worldOffsetY + (y * this.tileSize);
              
              const tile = this.add.image(tileX, tileY, layer.spriteSheet, tileIndex);
              tile.setOrigin(0.5, 0.5);
              tile.setDepth(layerIndex);
              
              // Store tile data for collision detection (only from ground layer)
              if (layerIndex === 0) {
                tile.setData('gridX', x);
                tile.setData('gridY', y);
                tile.setData('tileIndex', tileIndex);
                tile.setData('walkable', isTileWalkable(tileIndex));
              }
            }
          }
        });
      }

      worldToGrid(worldX, worldY) {
        // Convert world coordinates to grid coordinates
        const gridX = Math.floor((worldX - this.worldOffsetX) / this.tileSize);
        const gridY = Math.floor((worldY - this.worldOffsetY) / this.tileSize);
        return { gridX, gridY };
      }

      isPositionWalkable(worldX, worldY) {
        const { gridX, gridY } = this.worldToGrid(worldX, worldY);
        
        // Check if within bounds
        if (gridX < 0 || gridX >= this.currentWorld.width || 
            gridY < 0 || gridY >= this.currentWorld.height) {
          return false;
        }
        
        // Check ground layer (layer 0) for walkability
        const groundLayer = this.currentWorld.layers[0];
        if (!groundLayer) return false;
        
        const tileIndex = groundLayer.tiles[gridY][gridX];
        return isTileWalkable(tileIndex);
      }

      movePlayerTo(targetX, targetY) {
        // Check if target position is walkable
        if (!this.isPositionWalkable(targetX, targetY)) {
          console.log('Cannot walk there - tile is not walkable');
          return;
        }
        
        // Update player direction based on movement
        this.updatePlayerDirection(targetX, targetY);
        
        // Show target marker
        this.targetMarker.setPosition(targetX, targetY);
        this.targetMarker.setAlpha(1);

        // Animate marker
        this.tweens.add({
          targets: this.targetMarker,
          alpha: 0,
          duration: 500,
          ease: 'Power2'
        });

        // Calculate distance and duration
        const distance = Phaser.Math.Distance.Between(
          this.playerSprites.x,
          this.playerSprites.y,
          targetX,
          targetY
        );
        
        const speed = 100; // pixels per second (slower for better view)
        const duration = (distance / speed) * 1000;

        // Move player to target
        this.tweens.add({
          targets: this.playerSprites,
          x: targetX,
          y: targetY,
          duration: duration,
          ease: 'Linear',
          onStart: () => {
            this.isMoving = true;
          },
          onComplete: () => {
            this.isMoving = false;
          }
        });
      }

      update() {
        // Future: Add walking animation, update sprite direction, etc.
      }
    }

    // Phaser game configuration
    const config = {
      type: Phaser.AUTO,
      parent: gameRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#87CEEB',
      scene: [IslandScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false,
        },
      },
    };

    phaserGameRef.current = new Phaser.Game(config);

    // Cleanup on unmount
    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  return <div ref={gameRef} className="w-full h-full" />;
}

