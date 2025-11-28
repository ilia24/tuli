'use client';

import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { getSpriteMetadata } from '../lib/spriteMetadata';

export default function TilesetViewer() {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);

  useEffect(() => {
    if (phaserGameRef.current || !gameRef.current) return;

    class TilesetViewerScene extends Phaser.Scene {
      constructor() {
        super({ key: 'TilesetViewerScene' });
      }

      preload() {
        // Load all sprite sheets (16x16)
        this.load.spritesheet('tileset', '/spritesheets/Tileset_16x16.png', {
          frameWidth: 16,
          frameHeight: 16,
        });
        
        this.load.spritesheet('objects', '/spritesheets/Objects.png', {
          frameWidth: 16,
          frameHeight: 16,
        });
        
        this.load.spritesheet('train', '/spritesheets/train.png', {
          frameWidth: 16,
          frameHeight: 16,
        });
      }

      create() {
        // Add main title
        const title = this.add.text(20, 20, 'Tileset Viewer - All Sprite Sheets (16x16)', {
          fontSize: '28px',
          fontFamily: 'Arial',
          color: '#ffffff',
          backgroundColor: '#000000',
          padding: { x: 10, y: 5 },
        });

        // Define all sprite sheets to display
        const spritesheets = [
          { key: 'tileset', name: 'Tileset_16x16.png', metadataKey: 'tileset' },
          { key: 'objects', name: 'Objects.png', metadataKey: 'objects' },
          { key: 'train', name: 'train.png', metadataKey: 'train' },
        ];

        const tileSize = 16;
        const scale = 3; // Make tiles bigger for viewing (16x16 -> 48x48)
        const spacing = 100; // Space between tiles to fit labels and names
        const startX = 50;
        let currentY = 80;

        // Display each spritesheet
        spritesheets.forEach((sheet, sheetIndex) => {
          const texture = this.textures.get(sheet.key);
          const frameNames = texture.getFrameNames();
          const totalFrames = frameNames.length;
          
          // Calculate actual tiles per row based on image width
          const sourceWidth = texture.source[0].width;
          const tilesPerRow = Math.floor(sourceWidth / tileSize);
          
          // Get sprite metadata for this sheet
          const spriteMetadata = getSpriteMetadata(sheet.metadataKey);

          // Section title
          const sectionTitle = this.add.text(startX, currentY, sheet.name, {
            fontSize: '20px',
            fontFamily: 'Arial',
            color: '#ffff00',
            backgroundColor: '#333333',
            padding: { x: 8, y: 4 },
          });

          currentY += 40;

          // Display all tiles in this spritesheet
          for (let i = 0; i < totalFrames; i++) {
            const col = i % tilesPerRow;
            const row = Math.floor(i / tilesPerRow);
            const x = startX + col * spacing;
            const y = currentY + row * spacing;

            // Add a background box
            const bg = this.add.rectangle(
              x + (tileSize * scale) / 2,
              y + (tileSize * scale) / 2,
              tileSize * scale + 4,
              tileSize * scale + 4,
              0x444444
            );
            bg.setStrokeStyle(2, 0x666666);
            bg.setDepth(-1);

            // Add the tile sprite
            const tile = this.add.image(x, y, sheet.key, i);
            tile.setScale(scale);
            tile.setOrigin(0, 0);

            // Get sprite name if it exists
            const spriteName = spriteMetadata[i];
            
            // Add tile index label
            const indexLabel = this.add.text(x, y + tileSize * scale + 5, `${i}`, {
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#ffff00',
              backgroundColor: '#000000',
              padding: { x: 3, y: 1 },
            });
            indexLabel.setOrigin(0, 0);
            
            // Add sprite name label if named
            if (spriteName) {
              const nameLabel = this.add.text(x, y + tileSize * scale + 22, spriteName, {
                fontSize: '8px',
                fontFamily: 'monospace',
                color: '#00ff00',
                backgroundColor: '#000000',
                padding: { x: 1, y: 1 },
                wordWrap: { width: spacing - 10, useAdvancedWrap: true },
              });
              nameLabel.setOrigin(0, 0);
            }
          }

          // Add summary for this spritesheet
          const rows = Math.ceil(totalFrames / tilesPerRow);
          currentY += rows * spacing + 60;

          const summary = this.add.text(
            startX,
            currentY - 40,
            `Total: ${totalFrames} tiles`,
            {
              fontSize: '14px',
              fontFamily: 'Arial',
              color: '#aaaaaa',
              backgroundColor: '#222222',
              padding: { x: 6, y: 3 },
            }
          );

          currentY += 20; // Space before next section
        });

        // Set camera bounds to allow scrolling through all content
        const maxY = currentY + 100; // Add some padding at the bottom
        this.cameras.main.setBounds(0, 0, 2000, maxY);
        
        // Add scroll/zoom controls
        const controlsText = this.add.text(
          this.scale.width - 220,
          20,
          'Controls:\nScroll: Mouse Wheel\nPan: Click & Drag',
          {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 8, y: 5 },
            lineSpacing: 3,
          }
        );
        controlsText.setScrollFactor(0);
        controlsText.setOrigin(1, 0);

        // Enable dragging
        this.input.on('pointermove', (pointer) => {
          if (pointer.isDown) {
            this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
            this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
          }
        });

        // Enable zoom with mouse wheel
        this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
          const zoomAmount = deltaY > 0 ? -0.1 : 0.1;
          const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom + zoomAmount, 0.5, 3);
          this.cameras.main.setZoom(newZoom);
        });
      }
    }

    const config = {
      type: Phaser.AUTO,
      parent: gameRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: '#222222',
      scene: [TilesetViewerScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    phaserGameRef.current = new Phaser.Game(config);

    return () => {
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  return <div ref={gameRef} className="w-full h-full" />;
}

