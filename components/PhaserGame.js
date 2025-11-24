'use client';

import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { getWorld, isTileWalkable } from '../lib/worldConfig';

export default function PhaserGame() {
  const gameRef = useRef(null);
  const phaserGameRef = useRef(null);
  const [showTuliChat, setShowTuliChat] = useState(false);

  useEffect(() => {
    if (phaserGameRef.current || !gameRef.current) return;
    
    // Make chat modal control available to Phaser
    window.openTuliChat = () => setShowTuliChat(true);

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
        this.tileSize = 16;
        this.currentMoveTween = null; // Track current movement tween
        this.walkAnimationTimer = null; // Timer for walk animation
        this.followerMoveTween = null; // Track follower movement
        this.playerPathHistory = []; // Track player positions for follower
        this.clickedOnTuli = false; // Flag to prevent movement when clicking Tuli
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
        
        // Follower walking poses
        this.load.image('follower-front-walk', '/spritesheets/tuli/front-walk.png');
        this.load.image('follower-left-walk', '/spritesheets/tuli/left-walk.png');
        this.load.image('follower-right-walk', '/spritesheets/tuli/right-walk.png');
        this.load.image('follower-back-walk', '/spritesheets/tuli/back-step.png');
      }

      create() {
        const width = this.scale.width;
        const height = this.scale.height;

        // Set texture filtering to NEAREST for pixel-perfect rendering
        this.textures.get('tileset').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('objects').setFilter(Phaser.Textures.FilterMode.NEAREST);
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

        // Add camera to follow player
        this.cameras.main.startFollow(this.playerSprites, true, 0.1, 0.1);
        this.cameras.main.setZoom(2); // Zoom in to see the 16x16 sprites better
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
        } else {
          // Vertical movement
          newDirection = dy > 0 ? 'front' : 'back';
        }
        
        if (newDirection !== this.currentDirection) {
          this.currentDirection = newDirection;
        }
        
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
          // Always restart animation when direction changes (even if already animating)
          this.stopWalkAnimation(); // Stop old animation first
          this.startWalkAnimation(standKey, stepKey); // Start new animation
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
          
          for (let y = 0; y < this.currentWorld.height; y++) {
            for (let x = 0; x < this.currentWorld.width; x++) {
              const tileIndex = layer.tiles[y][x];
              
              // Skip only null/undefined
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
          return;
        }
        
        // Stop any existing movement tween
        if (this.currentMoveTween) {
          this.currentMoveTween.stop();
          this.currentMoveTween = null;
        }
        
        // Stop all tweens on player to prevent warping
        this.tweens.killTweensOf(this.playerSprites);
        
        // Update player direction based on movement
        this.updatePlayerDirection(targetX, targetY, true);
        
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
        this.currentMoveTween = this.tweens.add({
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
            this.currentMoveTween = null;
            
            // Stop walk animation and show standing pose
            this.setPlayerSprites(this.currentDirection, false);
          }
        });
      }

      update() {
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
          
          // Cancel existing follower tween
          if (this.followerMoveTween) {
            this.followerMoveTween.stop();
          }
          
          // Move follower smoothly
          const speed = 120; // Slightly faster than player to catch up
          const duration = (distance / speed) * 1000;
          
          this.followerMoveTween = this.tweens.add({
            targets: this.followerSprite,
            x: targetPos.x,
            y: targetPos.y,
            duration: duration,
            ease: 'Linear',
            onComplete: () => {
              // Stop walking animation when follower reaches destination
              this.stopFollowerWalkAnimation();
            }
          });
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
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <div ref={gameRef} className="w-full h-full" />
      
      {/* Tuli Chat Modal */}
      {showTuliChat && (
        <TuliChatModal onClose={() => setShowTuliChat(false)} />
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

