'use client';

import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { getWorld, isTileWalkable, isTileAbovePlayer } from '../lib/worldConfig';

const ZOOM_FACTOR = 2;
const CAMERA_BOUNDS_PADDING = 12;

// Sprite sheet tile sizes
const SPRITE_SHEET_SIZES = {
  'tileset': 16,
  'objects': 16,
  'train': 16,
  'firecave': 48, // Confirmed 48x48
};

export default function PhaserGame() {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);
  const [showTuliChat, setShowTuliChat] = useState(false);
  const [showGnomeChat, setShowGnomeChat] = useState(false);
  const [showDragonChat, setShowDragonChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  useEffect(() => {
    if (phaserGameRef.current || !gameRef.current) return;
    
    // Make controls available to Phaser
    window.openTuliChat = () => setShowTuliChat(true);
    window.openGnomeChat = () => setShowGnomeChat(true);
    window.openDragonChat = () => setShowDragonChat(true);
    window.startWorldTransition = (worldName) => {
      setLoadingText(`Loading ${worldName}...`);
      setIsLoading(true);
    };
    window.endWorldTransition = () => {
      setTimeout(() => setIsLoading(false), 500);
    };

    // Main game scene
    class IslandScene extends Phaser.Scene {
      constructor() {
        super({ key: 'IslandScene' });
        this.player = null;
        this.playerSprites = null; // Container for 4-tile player
        this.followerSprite = null; // Follower character
        this.targetMarker = null;
        this.isMoving = false;
        this.currentDirection = 'front';
        this.currentWorld = null;
        this.currentWorldKey = 'tutorial'; // Track which world is loaded
        this.tileSize = 16;
        
        // Make current world available globally for editor
        window.currentGameWorld = this.currentWorldKey;
        this.currentMoveTween = null; // Track current movement tween
        this.walkAnimationTimer = null; // Timer for walk animation
        this.followerMoveTween = null; // Track follower movement
        this.playerPathHistory = []; // Track player positions for follower
        this.clickedOnTuli = false; // Flag to prevent movement when clicking Tuli
        this.portals = []; // World transition portals
        this.frameCount = 0; // Frame counter for logging
        this.npcs = []; // NPCs in the world
      }

      preload() {
        // Load sprite sheets (16x16)
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
        
        this.load.spritesheet('train', '/spritesheets/train.png', {
          frameWidth: 16,
          frameHeight: 16,
          spacing: 0,
          margin: 0,
        });
        
        // Load firecave with unique key to force cache bust
        this.load.spritesheet('firecave', '/spritesheets/Firecave_A1.png', {
          frameWidth: 48,
          frameHeight: 48,
          spacing: 0,
          margin: 0,
        });
        
        // Load player sprites (64x64 images for each direction)
        // Standing poses
        this.load.image('player-front-stand', '/spritesheets/player/front-standing.png');
        this.load.image('player-left-stand', '/spritesheets/player/left-standing.png');
        this.load.image('player-right-stand', '/spritesheets/player/right-standing.png');
        this.load.image('player-back-stand', '/spritesheets/player/rear-standing.png');
        
        // Walking step poses
        this.load.image('player-front-step', '/spritesheets/player/front-step.png');
        this.load.image('player-right-step', '/spritesheets/player/right-step.png');
        this.load.image('player-left-step', '/spritesheets/player/left-step.png');
        this.load.image('player-back-step', '/spritesheets/player/back-step.png');
        
        // Follower character (Tuli mascot) - standing poses
        this.load.image('follower-front-stand', '/spritesheets/tuli/front-stand.png');
        this.load.image('follower-left-stand', '/spritesheets/tuli/left-stand.png');
        this.load.image('follower-right-stand', '/spritesheets/tuli/right-stand.png');
        this.load.image('follower-back-stand', '/spritesheets/tuli/back-stand.png');
        
        // NPCs
        this.load.image('gnome', '/spritesheets/gnome.png');
        this.load.image('dragon-idle', '/spritesheets/dragon-idle.png');
        this.load.image('dragon-blink', '/spritesheets/dragon-idle-blink.png');
        
        // Follower walking poses
        this.load.image('follower-front-walk', '/spritesheets/tuli/front-walk.png');
        this.load.image('follower-left-walk', '/spritesheets/tuli/left-walk.png');
        this.load.image('follower-right-walk', '/spritesheets/tuli/right-walk.png');
        this.load.image('follower-back-walk', '/spritesheets/tuli/back-step.png');
      }

      create() {
        const width = this.scale.width;
        const height = this.scale.height;

        // Debug: Check firecave texture loading
        const firecaveTexture = this.textures.get('firecave');
        const firecaveFrame = firecaveTexture.get(0);
        const firecaveSource = firecaveTexture.source[0];

        // Test render frame 1 info
        const frame1 = firecaveTexture.get(1);
        console.log('Frame 1 cutX:', frame1.cutX, 'cutY:', frame1.cutY, 'cutWidth:', frame1.cutWidth, 'cutHeight:', frame1.cutHeight);

        // Set texture filtering to NEAREST for pixel-perfect rendering
        this.textures.get('tileset').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('objects').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('train').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('firecave').setFilter(Phaser.Textures.FilterMode.NEAREST);
        // Set texture filtering for standing poses
        this.textures.get('player-front-stand').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('player-left-stand').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('player-right-stand').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('player-back-stand').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        // Set texture filtering for step poses
        this.textures.get('player-front-step').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('player-right-step').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('player-left-step').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('player-back-step').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        // Set texture filtering for follower standing
        this.textures.get('follower-front-stand').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('follower-left-stand').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('follower-right-stand').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('follower-back-stand').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        // Set texture filtering for follower walking
        this.textures.get('follower-front-walk').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('follower-left-walk').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('follower-right-walk').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('follower-back-walk').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        // NPCs
        this.textures.get('gnome').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('dragon-idle').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('dragon-blink').setFilter(Phaser.Textures.FilterMode.NEAREST);

        // Load the world configuration
        this.currentWorld = getWorld('tutorial');

        // Create background (blue)
        const background = this.add.graphics();
        background.fillStyle(0x2594D0, 1); // RGB(37, 148, 208)
        background.fillRect(0, 0, width, height);

        // Build world from configuration
        this.worldOffsetX = (width / 2) - (this.currentWorld.width * this.tileSize) / 2;
        this.worldOffsetY = (height / 2) - (this.currentWorld.height * this.tileSize) / 2;
        this.createWorldFromLayers();

        // Create player at spawn point
        const spawnX = this.worldOffsetX + (this.currentWorld.spawnPoint.x * this.tileSize);
        const spawnY = this.worldOffsetY + (this.currentWorld.spawnPoint.y * this.tileSize);
        this.createPlayer(spawnX, spawnY);
        
        // Create follower character slightly behind player
        this.createFollower(spawnX - 32, spawnY);

        // Create target marker (initially hidden)
        this.targetMarker = this.add.circle(0, 0, 8, 0xFFFF00, 0);
        this.targetMarker.setStrokeStyle(2, 0xFFFF00);
        this.targetMarker.setDepth(50);
        
        // Create portals for world transitions
        this.createPortals();
        
        // Create NPCs
        this.createNPCs();

        // Enable click/tap to move
        this.input.on('pointerdown', (pointer) => {
          // Don't move if we just clicked on Tuli
          if (this.clickedOnTuli) {
            this.clickedOnTuli = false; // Reset flag
            return;
          }
          
          // Use worldX and worldY to account for camera movement
          this.movePlayerTo(pointer.worldX, pointer.worldY);
        });

        // Set zoom first
        this.cameras.main.setZoom(ZOOM_FACTOR);
        
        // Set camera bounds (reduce right and bottom by 20px)
        const worldPixelWidth = this.currentWorld.width * this.tileSize;
        const worldPixelHeight = this.currentWorld.height * this.tileSize;
        
        this.cameras.main.setBounds(
          this.worldOffsetX,
          this.worldOffsetY,
          worldPixelWidth - CAMERA_BOUNDS_PADDING,
          worldPixelHeight - CAMERA_BOUNDS_PADDING
        );
        
        // Add camera to follow player
        this.cameras.main.startFollow(this.playerSprites, true, 0.1, 0.1);
      }

      createPlayer(x, y) {
        // Create player sprite (64x64 single image)
        this.playerSprites = this.add.image(x, y, 'player-front-stand');
        this.playerSprites.setScale(0.4); // Scale down 64x64 to 25.6x25.6
        this.playerSprites.setDepth(100);
        
        // Store current sprite key for direction changes
        this.playerSprites.currentSpriteKey = 'player-front-stand';
        this.playerSprites.isAnimating = false;
        
        // Initialize path history with starting position
        this.playerPathHistory.push({ x, y });
      }

      createNPCs() {
        // Create NPCs based on current world
        if (this.currentWorldKey === 'tutorial') {
          // Maximillion the Gnome at (39, 48)
          this.createNPC(39, 48, 'gnome', 'openGnomeChat');
        } else if (this.currentWorldKey === 'lavaWorld') {
          // Vesuvvy the Dragon at (108, 13)
          this.createDragon(108, 13);
        }
      }

      createNPC(gridX, gridY, spriteKey, chatFunction) {
        const npcX = this.worldOffsetX + (gridX * this.tileSize);
        const npcY = this.worldOffsetY + (gridY * this.tileSize);
        
        // Create pulsing glow behind NPC
        const glow = this.add.circle(npcX, npcY, 20, 0xffdd00, 0.3);
        glow.setDepth(97);
        
        // Pulsing animation
        this.tweens.add({
          targets: glow,
          scaleX: 1,
          scaleY: 1,
          alpha: 0.3,
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        const npc = this.add.image(npcX, npcY, spriteKey);
        npc.setScale(1);
        npc.setDepth(98); // Just below follower
        npc.setInteractive();
        
        this.npcs.push(glow); // Track glow for cleanup
        
        // Hover effect
        npc.on('pointerover', () => {
          npc.setTint(0xffff99);
        });
        
        npc.on('pointerout', () => {
          npc.clearTint();
        });
        
        // Click to open chat
        npc.on('pointerdown', (pointer) => {
          if (pointer.leftButtonDown()) {
            this.clickedOnTuli = true; // Prevent movement
            
            if (window[chatFunction]) {
              window[chatFunction]();
            }
          }
        });
        
        this.npcs.push(npc);
      }

      createDragon(gridX, gridY) {
        const dragonX = this.worldOffsetX + (gridX * this.tileSize);
        const dragonY = this.worldOffsetY + (gridY * this.tileSize);
        
        // Create pulsing glow behind dragon
        const glow = this.add.circle(dragonX, dragonY, 30, 0xff4400, 0.4);
        glow.setDepth(97);
        
        this.tweens.add({
          targets: glow,
          scaleX: 1.3,
          scaleY: 1.3,
          alpha: 0.6,
          duration: 1500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        const dragon = this.add.image(dragonX, dragonY, 'dragon-idle');
        dragon.setScale(1.2);
        dragon.setDepth(98);
        dragon.setInteractive();
        
        this.npcs.push(glow);
        this.npcs.push(dragon);
        
        // Random blink animation
        const scheduleNextBlink = () => {
          const delay = Phaser.Math.Between(2000, 5000); // Random 2-5 seconds
          this.time.delayedCall(delay, () => {
            // Blink
            dragon.setTexture('dragon-blink');
            this.time.delayedCall(150, () => {
              dragon.setTexture('dragon-idle');
              scheduleNextBlink();
            });
          });
        };
        scheduleNextBlink();
        
        // Hover effect
        dragon.on('pointerover', () => {
          dragon.setTint(0xffaa66);
        });
        
        dragon.on('pointerout', () => {
          dragon.clearTint();
        });
        
        // Click to open chat
        dragon.on('pointerdown', (pointer) => {
          if (pointer.leftButtonDown()) {
            this.clickedOnTuli = true;
            
            if (window.openDragonChat) {
              window.openDragonChat();
            }
          }
        });
      }

      createPortals() {
        // Create portals based on current world
        if (this.currentWorldKey === 'tutorial') {
          // Portal to Lava World
          // this.createPortal(28, 25, 'lavaWorld', 'Lava World', 0xff6600, 0xffaa00);
        } else if (this.currentWorldKey === 'lavaWorld') {
          // Portal back to Tutorial
          // this.createPortal(5, 2, 'tutorial', 'Tutorial Island', 0x00ff00, 0x00aa00);
        }
      }

      createPortal(gridX, gridY, targetWorld, label, color, hoverColor) {
        const portalX = this.worldOffsetX + (gridX * this.tileSize);
        const portalY = this.worldOffsetY + (gridY * this.tileSize);
        
        const portal = this.add.circle(portalX, portalY, 16, color, 1);
        portal.setStrokeStyle(3, hoverColor);
        portal.setDepth(50);
        portal.setInteractive();
        
        // Pulsing animation
        this.tweens.add({
          targets: portal,
          scaleX: 1.2,
          scaleY: 1.2,
          alpha: 0.7,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        portal.on('pointerover', () => {
          portal.setFillStyle(hoverColor);
        });
        
        portal.on('pointerout', () => {
          portal.setFillStyle(color);
        });
        
        portal.on('pointerdown', (pointer) => {
          if (pointer.leftButtonDown()) {
            this.clickedOnTuli = true; // Prevent movement
            this.transitionToWorld(targetWorld);
          }
        });
        
        this.portals.push(portal);
        
        // Add label
        const labelText = this.add.text(portalX, portalY - 30, label, {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: '#ffffff',
          backgroundColor: color,
          padding: { x: 6, y: 3 },
        });
        labelText.setOrigin(0.5);
        labelText.setDepth(50);
        this.portals.push(labelText);
      }

      transitionToWorld(worldKey) {
        const newWorld = getWorld(worldKey);
        if (!newWorld) {
          console.error(`World ${worldKey} not found`);
          return;
        }
        
        // Start loading screen
        if (window.startWorldTransition) {
          window.startWorldTransition(newWorld.name);
        }
        
        // Wait a moment then load new world
        this.time.delayedCall(1000, () => {
          this.loadWorld(worldKey);
          
          if (window.endWorldTransition) {
            window.endWorldTransition();
          }
        });
      }

      loadWorld(worldKey) {
        // Clear current world
        this.children.removeAll();
        this.portals = [];
        this.npcs = [];
        
        // Stop all movement
        this.tweens.killAll();
        if (this.currentMoveTween) {
          this.currentMoveTween.stop();
          this.currentMoveTween = null;
        }
        this.stopWalkAnimation();
        this.stopFollowerWalkAnimation();
        
        // Load new world
        this.currentWorldKey = worldKey;
        this.currentWorld = getWorld(worldKey);
        
        // Update global reference for editor
        window.currentGameWorld = worldKey;
        
        // Recreate everything
        const width = this.scale.width;
        const height = this.scale.height;
        
        const background = this.add.graphics();
        background.fillStyle(0x2594D0, 1);
        background.fillRect(0, 0, width, height);
        
        this.worldOffsetX = (width / 2) - (this.currentWorld.width * this.tileSize) / 2;
        this.worldOffsetY = (height / 2) - (this.currentWorld.height * this.tileSize) / 2;
        
        this.createWorldFromLayers();
        
        const spawnX = this.worldOffsetX + (this.currentWorld.spawnPoint.x * this.tileSize);
        const spawnY = this.worldOffsetY + (this.currentWorld.spawnPoint.y * this.tileSize);
        
        this.createPlayer(spawnX, spawnY);
        this.createFollower(spawnX - 32, spawnY);
        
        this.targetMarker = this.add.circle(0, 0, 8, 0xFFFF00, 0);
        this.targetMarker.setStrokeStyle(2, 0xFFFF00);
        this.targetMarker.setDepth(50);
        
        this.createPortals();
        this.createNPCs();
        
        // Set zoom first
        this.cameras.main.setZoom(ZOOM_FACTOR);
        
        // Set camera bounds (reduce right and bottom by 20px)
        const worldPixelWidth = this.currentWorld.width * this.tileSize;
        const worldPixelHeight = this.currentWorld.height * this.tileSize;
        
        this.cameras.main.setBounds(
          this.worldOffsetX,
          this.worldOffsetY,
          worldPixelWidth - CAMERA_BOUNDS_PADDING,
          worldPixelHeight - CAMERA_BOUNDS_PADDING
        );
        
        // Reset camera to follow player
        this.cameras.main.startFollow(this.playerSprites, true, 0.1, 0.1);
      }

      createFollower(x, y) {
        // Create follower sprite (Tuli mascot)
        this.followerSprite = this.add.image(x, y, 'follower-front-stand');
        this.followerSprite.setScale(0.4);
        this.followerSprite.setDepth(99); // Just behind player
        
        this.followerSprite.currentSpriteKey = 'follower-front-stand';
        this.followerSprite.currentDirection = 'front';
        this.followerSprite.isAnimating = false;
        this.followerWalkAnimationTimer = null;
        
        // Make Tuli clickable
        this.followerSprite.setInteractive();
        
        // Add hover effect
        this.followerSprite.on('pointerover', () => {
          this.followerSprite.setTint(0xffff99); // Slight yellow tint on hover
        });
        
        this.followerSprite.on('pointerout', () => {
          this.followerSprite.clearTint();
        });
        
        // Click to open chat
        this.followerSprite.on('pointerdown', (pointer) => {
          if (pointer.leftButtonDown()) {
            // Set flag to prevent movement
            this.clickedOnTuli = true;
            
            if (window.openTuliChat) {
              window.openTuliChat();
            }
          }
        });
      }

      updatePlayerDirection(targetX, targetY, isMoving = false) {
        const dx = targetX - this.playerSprites.x;
        const dy = targetY - this.playerSprites.y;
        
        // Determine direction based on larger delta
        let newDirection = this.currentDirection;
        
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal movement
          newDirection = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > 0.1) {
          // Vertical movement (only if significant)
          newDirection = dy > 0 ? 'front' : 'back';
        }
        
        // Always update direction and animation state
        this.currentDirection = newDirection;
        this.setPlayerSprites(newDirection, isMoving);
      }

      setPlayerSprites(direction, isMoving = false) {
        // Get the base sprite key for the direction
        const baseSprites = {
          'front': 'player-front',
          'right': 'player-right',
          'left': 'player-left',
          'back': 'player-back',
        };
        
        const baseSpriteKey = baseSprites[direction];
        const standKey = `${baseSpriteKey}-stand`;
        const stepKey = `${baseSpriteKey}-step`;
        
        // Check if step animation exists
        const hasStepAnimation = this.textures.exists(stepKey);
        
        if (isMoving && hasStepAnimation) {
          // Start animation if not already animating
          if (!this.playerSprites.isAnimating) {
            this.startWalkAnimation(standKey, stepKey);
          }
        } else {
          // Stop animation and show standing pose
          this.stopWalkAnimation();
          const newSpriteKey = standKey;
          
          if (this.playerSprites.currentSpriteKey !== newSpriteKey) {
            this.playerSprites.setTexture(newSpriteKey);
            this.playerSprites.currentSpriteKey = newSpriteKey;
          }
        }
      }

      startWalkAnimation(standKey, stepKey) {
        this.playerSprites.isAnimating = true;
        
        // Stop any existing animation timer
        if (this.walkAnimationTimer) {
          this.walkAnimationTimer.remove();
        }
        
        let currentFrame = 0;
        const frames = [standKey, stepKey];
        const frameDelay = 200; // 200ms per frame (5 fps walk cycle)
        
        // Set initial frame
        this.playerSprites.setTexture(frames[0]);
        this.playerSprites.currentSpriteKey = frames[0];
        
        // Alternate between standing and step
        this.walkAnimationTimer = this.time.addEvent({
          delay: frameDelay,
          callback: () => {
            currentFrame = (currentFrame + 1) % frames.length;
            this.playerSprites.setTexture(frames[currentFrame]);
            this.playerSprites.currentSpriteKey = frames[currentFrame];
          },
          loop: true,
        });
      }

      stopWalkAnimation() {
        this.playerSprites.isAnimating = false;
        
        if (this.walkAnimationTimer) {
          this.walkAnimationTimer.remove();
          this.walkAnimationTimer = null;
        }
      }

      createWorldFromLayers() {
        // Create tiles based on layers configuration
        this.currentWorld.layers.forEach((layer, layerIndex) => {
          if (!layer.visible) return;
          
          // Debug sprite sheet info
          if (layerIndex === 0) {
            const texture = this.textures.get(layer.spriteSheet);
            const frames = texture.getFrameNames();
            console.log(`Layer ${layerIndex} (${layer.name}): sheet=${layer.spriteSheet}, frames=${frames.length}`);
            
            // Check first few frames
            if (frames.length > 0) {
              const frame0 = texture.get(0);
              const frame1 = texture.get(1);
              console.log(`Frame 0:`, frame0.width, 'x', frame0.height);
              console.log(`Frame 1:`, frame1.width, 'x', frame1.height);
            }
          }
          
          for (let y = 0; y < this.currentWorld.height; y++) {
            for (let x = 0; x < this.currentWorld.width; x++) {
              const tileIndex = layer.tiles[y][x];
              
              // Skip only null/undefined
              if (tileIndex === null || tileIndex === undefined) continue;
              
              const tileX = this.worldOffsetX + (x * this.tileSize);
              const tileY = this.worldOffsetY + (y * this.tileSize);
              
              const tile = this.add.image(tileX, tileY, layer.spriteSheet, tileIndex);
              tile.setOrigin(0.5, 0.5);
              
              // Scale down to fit 16x16 grid like in WorldEditor
              const sheetTileSize = SPRITE_SHEET_SIZES[layer.spriteSheet] || 16;
              if (sheetTileSize !== this.tileSize) {
                const scaleRatio = this.tileSize / sheetTileSize;
                tile.setScale(scaleRatio);
                console.log(`Scaling ${layer.spriteSheet} tile ${tileIndex}: ${sheetTileSize}→${this.tileSize}, scale=${scaleRatio}`);
              }
              
              // Check if tile should render above player
              const isAbovePlayer = isTileAbovePlayer(this.currentWorld, layerIndex, x, y);
              if (isAbovePlayer) {
                tile.setDepth(layerIndex + 1000); // Above player (player is at 100)
              } else {
                tile.setDepth(layerIndex); // Below player
              }
              
              // Store tile data for collision detection (only from ground layer)
              if (layerIndex === 0) {
                tile.setData('gridX', x);
                tile.setData('gridY', y);
                tile.setData('tileIndex', tileIndex);
                tile.setData('walkable', isTileWalkable(tileIndex, this.currentWorld, layerIndex, x, y));
              }
            }
          }
        });
      }

      worldToGrid(worldX, worldY) {
        // Convert world coordinates to grid coordinates
        // Account for tile origin being at center (0.5, 0.5)
        const gridX = Math.round((worldX - this.worldOffsetX) / this.tileSize);
        const gridY = Math.round((worldY - this.worldOffsetY) / this.tileSize);
        return { gridX, gridY };
      }

      gridToWorld(gridX, gridY) {
        // Convert grid coordinates to world coordinates (center of tile)
        const worldX = this.worldOffsetX + (gridX * this.tileSize);
        const worldY = this.worldOffsetY + (gridY * this.tileSize);
        return { x: worldX, y: worldY };
      }

      isPositionWalkable(worldX, worldY) {
        const { gridX, gridY } = this.worldToGrid(worldX, worldY);
        return this.isGridWalkable(gridX, gridY);
      }

      isGridWalkable(gridX, gridY) {
        // Check if within bounds
        if (gridX < 0 || gridX >= this.currentWorld.width || 
            gridY < 0 || gridY >= this.currentWorld.height) {
          return false;
        }
        
        // Check ALL layers for walkability
        for (let layerIndex = 0; layerIndex < this.currentWorld.layers.length; layerIndex++) {
          const layer = this.currentWorld.layers[layerIndex];
          if (!layer || !layer.tiles) continue;
          
          // Safety check for tiles array bounds
          if (gridY < 0 || gridY >= layer.tiles.length) continue;
          if (!layer.tiles[gridY]) continue;
          if (gridX < 0 || gridX >= layer.tiles[gridY].length) continue;
          
          const tileIndex = layer.tiles[gridY][gridX];
          
          // Skip null/undefined tiles
          if (tileIndex === null || tileIndex === undefined) continue;
          
          // Check if this specific tile is walkable
          const walkable = isTileWalkable(tileIndex, this.currentWorld, layerIndex, gridX, gridY);
          
          if (!walkable) {
            // Found a non-walkable tile on this layer at this position
            return false;
          }
        }
        
        // No non-walkable tiles found on any layer at this position
        return true;
      }

      findPath(startX, startY, endX, endY) {
        // A* pathfinding algorithm
        const startGrid = this.worldToGrid(startX, startY);
        const endGrid = this.worldToGrid(endX, endY);
        
        // If end position not walkable, return null
        if (!this.isGridWalkable(endGrid.gridX, endGrid.gridY)) {
          return null;
        }
        
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const startKey = `${startGrid.gridX},${startGrid.gridY}`;
        const endKey = `${endGrid.gridX},${endGrid.gridY}`;
        
        openSet.push(startKey);
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(startGrid, endGrid));
        
        while (openSet.length > 0) {
          // Get node with lowest fScore
          let current = openSet[0];
          let currentFScore = fScore.get(current) || Infinity;
          
          for (let i = 1; i < openSet.length; i++) {
            const score = fScore.get(openSet[i]) || Infinity;
            if (score < currentFScore) {
              current = openSet[i];
              currentFScore = score;
            }
          }
          
          if (current === endKey) {
            // Reconstruct path
            return this.reconstructPath(cameFrom, current);
          }
          
          // Remove current from openSet
          openSet.splice(openSet.indexOf(current), 1);
          closedSet.add(current);
          
          // Check neighbors (8-directional: cardinals + diagonals)
          const [cx, cy] = current.split(',').map(Number);
          const neighbors = [
            // Cardinal directions (cost: 1)
            { x: cx + 1, y: cy, cost: 1 },
            { x: cx - 1, y: cy, cost: 1 },
            { x: cx, y: cy + 1, cost: 1 },
            { x: cx, y: cy - 1, cost: 1 },
            // Diagonal directions (cost: 1.414 ≈ √2)
            { x: cx + 1, y: cy + 1, cost: 1.414 },
            { x: cx + 1, y: cy - 1, cost: 1.414 },
            { x: cx - 1, y: cy + 1, cost: 1.414 },
            { x: cx - 1, y: cy - 1, cost: 1.414 },
          ];
          
          for (const neighbor of neighbors) {
            const nx = neighbor.x;
            const ny = neighbor.y;
            const neighborKey = `${nx},${ny}`;
            
            if (closedSet.has(neighborKey)) continue;
            if (!this.isGridWalkable(nx, ny)) continue;
            
            // For diagonals, check if both adjacent cardinals are walkable (no corner cutting)
            if (neighbor.cost > 1) {
              const dx = nx - cx;
              const dy = ny - cy;
              if (!this.isGridWalkable(cx + dx, cy) || !this.isGridWalkable(cx, cy + dy)) {
                continue; // Can't cut corners
              }
            }
            
            const tentativeGScore = (gScore.get(current) || 0) + neighbor.cost;
            
            if (!openSet.includes(neighborKey)) {
              openSet.push(neighborKey);
            } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
              continue;
            }
            
            cameFrom.set(neighborKey, current);
            gScore.set(neighborKey, tentativeGScore);
            fScore.set(neighborKey, tentativeGScore + this.heuristic({ gridX: nx, gridY: ny }, endGrid));
          }
        }
        
        return null; // No path found
      }

      heuristic(a, b) {
        // Diagonal distance (Chebyshev distance with diagonal cost)
        const dx = Math.abs(a.gridX - b.gridX);
        const dy = Math.abs(a.gridY - b.gridY);
        // Cost: straight moves cost 1, diagonal moves cost 1.414
        return Math.max(dx, dy) + (Math.min(dx, dy) * 0.414);
      }

      reconstructPath(cameFrom, current) {
        const path = [current];
        while (cameFrom.has(current)) {
          current = cameFrom.get(current);
          path.unshift(current);
        }
        
        // Convert grid coordinates to world coordinates
        return path.map(key => {
          const [gridX, gridY] = key.split(',').map(Number);
          return this.gridToWorld(gridX, gridY);
        });
      }

      movePlayerTo(targetX, targetY) {
        // Check if target position is walkable
        if (!this.isPositionWalkable(targetX, targetY)) {
          return;
        }
        
        // Stop any existing movement completely
        if (this.currentMoveTween) {
          this.currentMoveTween.stop();
          this.currentMoveTween = null;
        }
        
        // Kill all tweens on player to prevent warping
        this.tweens.killTweensOf(this.playerSprites);
        
        // Clear current path
        this.currentPath = null;
        this.currentPathIndex = 0;
        
        // Find path using A*
        const path = this.findPath(
          this.playerSprites.x,
          this.playerSprites.y,
          targetX,
          targetY
        );
        
        if (!path || path.length === 0) {
          return;
        }
        
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

        // Move along the path
        this.followPath(path);
      }

      followPath(path) {
        if (!path || path.length === 0) return;
        
        // Reset path state
        this.currentPathIndex = 0;
        this.currentPath = path;
        this.isMoving = true;
        
        // Start walking animation with first waypoint direction
        if (path.length > 1) {
          const firstWaypoint = path[1]; // Skip current position, use next
          this.updatePlayerDirection(firstWaypoint.x, firstWaypoint.y, true);
        }
        
        this.moveToNextWaypoint();
      }

      moveToNextWaypoint() {
        if (!this.currentPath || this.currentPathIndex >= this.currentPath.length) {
          // Path complete
          this.isMoving = false;
          this.currentMoveTween = null;
          this.setPlayerSprites(this.currentDirection, false);
          return;
        }
        
        const waypoint = this.currentPath[this.currentPathIndex];
        
        // Skip if we're already very close to this waypoint
        const distToWaypoint = Phaser.Math.Distance.Between(
          this.playerSprites.x,
          this.playerSprites.y,
          waypoint.x,
          waypoint.y
        );
        
        if (distToWaypoint < 2) {
          // Already at waypoint, move to next
          this.currentPathIndex++;
          this.moveToNextWaypoint();
          return;
        }
        
        // Calculate direction for THIS specific waypoint movement
        const dx = waypoint.x - this.playerSprites.x;
        const dy = waypoint.y - this.playerSprites.y;
        
        let newDirection;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Predominantly horizontal
          newDirection = dx > 0 ? 'right' : 'left';
        } else {
          // Predominantly vertical
          newDirection = dy > 0 ? 'front' : 'back';
        }
        
        // Check if direction changed before updating
        const directionChanged = newDirection !== this.currentDirection;
        
        // Always stop and restart animation when direction changes
        if (directionChanged) {
          this.currentDirection = newDirection;
          
          // Stop old animation completely
          this.stopWalkAnimation();
          
          // Get sprite keys for new direction
          const baseSprites = {
            'front': 'player-front',
            'right': 'player-right',
            'left': 'player-left',
            'back': 'player-back',
          };
          const baseSpriteKey = baseSprites[newDirection];
          const standKey = `${baseSpriteKey}-stand`;
          const stepKey = `${baseSpriteKey}-step`;
          
          // Start new animation immediately
          if (this.textures.exists(stepKey)) {
            this.startWalkAnimation(standKey, stepKey);
          } else {
            this.playerSprites.setTexture(standKey);
            this.playerSprites.currentSpriteKey = standKey;
          }
        } else {
          // Same direction - ensure animation is running
          this.currentDirection = newDirection;
          if (!this.playerSprites.isAnimating) {
            this.setPlayerSprites(newDirection, true);
          }
        }
        
        const speed = 100; // pixels per second
        const duration = (distToWaypoint / speed) * 1000;

        // Move to waypoint
        this.currentMoveTween = this.tweens.add({
          targets: this.playerSprites,
          x: waypoint.x,
          y: waypoint.y,
          duration: duration,
          ease: 'Linear',
          onComplete: () => {
            this.currentPathIndex++;
            this.moveToNextWaypoint();
          }
        });
      }

      update() {
        this.frameCount++;
        
        // Log player grid position every second
        if (this.playerSprites && this.frameCount % 60 === 0) {
          const gridPos = this.worldToGrid(this.playerSprites.x, this.playerSprites.y);
          console.log(`Player at grid position: (${gridPos.gridX}, ${gridPos.gridY})`);
        }
        
        // Update player path history for follower
        if (this.playerSprites && this.followerSprite) {
          const currentPlayerPos = { x: this.playerSprites.x, y: this.playerSprites.y };
          const lastHistoryPos = this.playerPathHistory[this.playerPathHistory.length - 1];
          
          // Only add to history if player has moved significantly
          const distance = Phaser.Math.Distance.Between(
            currentPlayerPos.x, 
            currentPlayerPos.y,
            lastHistoryPos.x,
            lastHistoryPos.y
          );
          
          if (distance > 8) { // Update every 8 pixels
            this.playerPathHistory.push(currentPlayerPos);
            
            // Keep history to a reasonable size (last 50 positions)
            if (this.playerPathHistory.length > 50) {
              this.playerPathHistory.shift();
            }
            
            // Make follower move to an earlier position in the path
            this.updateFollowerPosition();
          }
        }
      }

      updateFollowerPosition() {
        // Follower follows a position in the history (trailing behind player)
        const followDistance = 5; // Follow 5 positions behind
        const targetIndex = Math.max(0, this.playerPathHistory.length - followDistance);
        const targetPos = this.playerPathHistory[targetIndex];
        
        if (!targetPos) return;
        
        // Calculate distance to target
        const distance = Phaser.Math.Distance.Between(
          this.followerSprite.x,
          this.followerSprite.y,
          targetPos.x,
          targetPos.y
        );
        
        // Only move if far enough away
        if (distance > 5) {
          // Update follower direction based on movement
          const dx = targetPos.x - this.followerSprite.x;
          const dy = targetPos.y - this.followerSprite.y;
          
          let newDirection = this.followerSprite.currentDirection;
          if (Math.abs(dx) > Math.abs(dy)) {
            newDirection = dx > 0 ? 'right' : 'left';
          } else {
            newDirection = dy > 0 ? 'front' : 'back';
          }
          
          // Update direction and animation if changed
          const directionChanged = newDirection !== this.followerSprite.currentDirection;
          
          if (directionChanged) {
            this.followerSprite.currentDirection = newDirection;
            // Restart animation with new direction
            this.startFollowerWalkAnimation(newDirection);
          } else if (!this.followerSprite.isAnimating) {
            // Start animation if not already running
            this.startFollowerWalkAnimation(newDirection);
          }
          
          // Find path for follower using A*
          const followerPath = this.findPath(
            this.followerSprite.x,
            this.followerSprite.y,
            targetPos.x,
            targetPos.y
          );
          
          if (followerPath && followerPath.length > 1) {
            // Cancel existing follower tween
            if (this.followerMoveTween) {
              this.followerMoveTween.stop();
            }
            
            // Move to next waypoint in path
            const nextWaypoint = followerPath[1]; // Skip first (current position)
            const dist = Phaser.Math.Distance.Between(
              this.followerSprite.x,
              this.followerSprite.y,
              nextWaypoint.x,
              nextWaypoint.y
            );
            
            const speed = 120; // Slightly faster than player
            const duration = (dist / speed) * 1000;
            
            this.followerMoveTween = this.tweens.add({
              targets: this.followerSprite,
              x: nextWaypoint.x,
              y: nextWaypoint.y,
              duration: duration,
              ease: 'Linear',
              onComplete: () => {
                this.stopFollowerWalkAnimation();
              }
            });
          } else {
            // No path or too close, stop animation
            this.stopFollowerWalkAnimation();
          }
        } else {
          // Not moving far, stop walk animation
          this.stopFollowerWalkAnimation();
        }
      }

      startFollowerWalkAnimation(direction) {
        const standKey = `follower-${direction}-stand`;
        const walkKey = `follower-${direction}-walk`;
        
        // Check if walk animation exists for this direction
        if (!this.textures.exists(walkKey)) {
          // No walk animation, just show standing
          if (this.textures.exists(standKey)) {
            this.followerSprite.setTexture(standKey);
            this.followerSprite.currentSpriteKey = standKey;
          }
          this.followerSprite.isAnimating = false;
          return;
        }
        
        // Stop existing animation
        if (this.followerWalkAnimationTimer) {
          this.followerWalkAnimationTimer.remove();
          this.followerWalkAnimationTimer = null;
        }
        
        this.followerSprite.isAnimating = true;
        
        let currentFrame = 0;
        const frames = [standKey, walkKey];
        const frameDelay = 200; // Same as player (200ms per frame)
        
        // Set initial frame
        this.followerSprite.setTexture(frames[0]);
        this.followerSprite.currentSpriteKey = frames[0];
        
        // Alternate between standing and walking
        this.followerWalkAnimationTimer = this.time.addEvent({
          delay: frameDelay,
          callback: () => {
            currentFrame = (currentFrame + 1) % frames.length;
            this.followerSprite.setTexture(frames[currentFrame]);
            this.followerSprite.currentSpriteKey = frames[currentFrame];
          },
          loop: true,
        });
      }

      stopFollowerWalkAnimation() {
        if (this.followerWalkAnimationTimer) {
          this.followerWalkAnimationTimer.remove();
          this.followerWalkAnimationTimer = null;
        }
        
        this.followerSprite.isAnimating = false;
        
        // Show standing pose
        const standKey = `follower-${this.followerSprite.currentDirection}-stand`;
        if (this.textures.exists(standKey)) {
          this.followerSprite.setTexture(standKey);
          this.followerSprite.currentSpriteKey = standKey;
        }
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
      window.openTuliChat = null;
      window.openGnomeChat = null;
      window.openDragonChat = null;
      window.startWorldTransition = null;
      window.endWorldTransition = null;
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  const handleTravelToLavaWorld = () => {
    setShowGnomeChat(false);
    if (phaserGameRef.current && phaserGameRef.current.scene.scenes[0]) {
      phaserGameRef.current.scene.scenes[0].transitionToWorld('lavaWorld');
    }
  };

  return (
    <>
      <div ref={gameRef} className="w-full h-full" />
      
      {/* Loading Screen */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-center items-center z-10001 pointer-events-auto">
          <div className="text-white text-3xl font-bold mb-4">{loadingText}</div>
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Tuli Chat Modal */}
      {showTuliChat && (
        <TuliChatModal onClose={() => setShowTuliChat(false)} />
      )}
      
      {/* Maximillion Chat Modal */}
      {showGnomeChat && (
        <GnomeChatModal 
          onClose={() => setShowGnomeChat(false)}
          onTravel={handleTravelToLavaWorld}
        />
      )}
      
      {/* Vesuvvy Chat Modal */}
      {showDragonChat && (
        <DragonChatModal onClose={() => setShowDragonChat(false)} />
      )}
    </>
  );
}

function TuliChatModal({ onClose }) {
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-6 max-w-md w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div 
            className="w-16 h-16 bg-contain bg-no-repeat bg-center shrink-0"
            style={{ backgroundImage: 'url(/spritesheets/tuli/avatar.png)' }}
          />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Tuli says:</h3>
            <p className="text-gray-700">
              Hi there! I'm Tuli, your friendly guide! Click around the world to explore and learn new things!
            </p>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
        >
          Thanks, Tuli!
        </button>
      </div>
    </div>
  );
}

function GnomeChatModal({ onClose, onTravel }) {
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-6 max-w-md w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div 
            className="w-20 h-20 bg-contain bg-no-repeat bg-center shrink-0 rounded-full"
            style={{ backgroundImage: 'url(/spritesheets/gnome-avatar.png)' }}
          />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-800 mb-2">Maximillion says:</h3>
            <p className="text-gray-700">
              I heard there's a dragon in the far lands who has lost his rock collection! I can take you there to help him out!
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onTravel}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
          >
            Take me there
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

function DragonChatModal({ onClose }) {
  return (
    <div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-6 max-w-md w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div 
            className="w-24 h-24 bg-contain bg-no-repeat bg-center shrink-0"
            style={{ backgroundImage: 'url(/spritesheets/dragon-idle.png)' }}
          />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-orange-700 mb-2">Vesuvvy says:</h3>
            <p className="text-gray-700">
              Rawr! I lost my rock collection and i cant stand it!
            </p>
          </div>
        </div>
        
        <button
          onClick={onClose}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
        >
          I'll help you find them!
        </button>
      </div>
    </div>
  );
}

