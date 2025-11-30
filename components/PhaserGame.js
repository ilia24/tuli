'use client';

import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { motion, AnimatePresence } from 'framer-motion';
import { getWorld, isTileWalkable, isTileAbovePlayer } from '../lib/worldConfig';
import { useGameState } from '../contexts/GameStateContext';
import { useUser } from '../contexts/UserContext';
import { DEV_CONFIG } from '../lib/config';

const ZOOM_FACTOR = 2;
const CAMERA_BOUNDS_PADDING = 30;

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
  const { gameState, updateGameState, updateMission, completeMission, setActiveMission } = useGameState();
  const { language, translations } = useUser();
  const gameStateRef = useRef(gameState); // Ref to always have current game state
  const [showTuliWelcome, setShowTuliWelcome] = useState(false);
  const [showTuliChat, setShowTuliChat] = useState(false);
  const [showDragonMissionChat, setShowDragonMissionChat] = useState(false);
  const [showGnomeChat, setShowGnomeChat] = useState(false);
  const [showGnomeChatReturn, setShowGnomeChatReturn] = useState(false);
  const [showMonkeyChat, setShowMonkeyChat] = useState(false);
  const [showDragonChat, setShowDragonChat] = useState(false);
  const [showBreathingExercise, setShowBreathingExercise] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const dragonGlowTimerRef = useRef(null);
  const showDragonMissionChatRef = useRef(false);
  const showBreathingExerciseRef = useRef(false);

  // Keep gameStateRef in sync with gameState
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Keep refs in sync with modal states
  useEffect(() => {
    showDragonMissionChatRef.current = showDragonMissionChat;
  }, [showDragonMissionChat]);

  useEffect(() => {
    showBreathingExerciseRef.current = showBreathingExercise;
  }, [showBreathingExercise]);

  useEffect(() => {
    if (phaserGameRef.current || !gameRef.current) return;
    
    // Make controls available to Phaser
    window.openTuliChat = () => setShowTuliChat(true);
    window.openDragonMissionChat = () => setShowDragonMissionChat(true);
    window.openGnomeChat = () => setShowGnomeChat(true);
    window.openGnomeChatReturn = () => setShowGnomeChatReturn(true);
    window.openMonkeyChat = () => setShowMonkeyChat(true);
    window.openDragonChat = () => setShowDragonChat(true);
    window.setActiveMission = setActiveMission;
    window.updateMission = updateMission;
    window.makeDragonHappy = () => {
      // Direct access to change dragon sprite
      if (phaserGameRef.current && phaserGameRef.current.scene.scenes[0]) {
        const scene = phaserGameRef.current.scene.scenes[0];
        if (scene.dragon) {
          console.log('Making dragon happy via window function');
          scene.dragon.setTexture('dragon-happy');
          scene.dragon.clearTint();
          scene.dragon.isHappy = true;
        }
      }
    };
    window.startWorldTransition = (worldName) => {
      setLoadingText(`Loading ${worldName}...`);
      setIsLoading(true);
    };
    window.endWorldTransition = () => {
      setTimeout(() => setIsLoading(false), 500);
    };
    
    // Expose game state to Phaser (using ref to always get current state)
    window.getGameState = () => gameStateRef.current;
    window.updateGameState = updateGameState;
    window.updateMission = updateMission;
    window.setActiveMission = setActiveMission;
    window.openBreathingExercise = () => setShowBreathingExercise(true);
    
    // Helper function to collect a rock
    window.collectRock = () => {
      const currentState = gameStateRef.current;
      const rockMission = currentState.missions.blazeRockCollection;
      if (rockMission && rockMission.accepted && !rockMission.completed) {
        const newRocksFound = rockMission.rocksFound + 1;
        updateMission('blazeRockCollection', { rocksFound: newRocksFound });
        
        // Check if all rocks found
        if (newRocksFound >= rockMission.totalRocks) {
          updateMission('blazeRockCollection', { completed: true, allRocksFound: true });
          // Set mission to talk to BLAZE
          const talkMission = translations?.blaze?.missionTalkToBlaze || 'Talk to BLAZE';
          setActiveMission(talkMission);
        }
      }
    };
    
    // Helper function to spawn rocks in the scene
    window.spawnRocks = () => {
      if (phaserGameRef.current && phaserGameRef.current.scene.scenes[0]) {
        phaserGameRef.current.scene.scenes[0].createRocks();
      }
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
        
        // Initialize game state with tutorial world
        if (window.updateGameState) {
          window.updateGameState({ currentWorld: this.currentWorldKey });
        }
        
        this.currentMoveTween = null; // Track current movement tween
        this.walkAnimationTimer = null; // Timer for walk animation
        this.followerMoveTween = null; // Track follower movement
        this.playerPathHistory = []; // Track player positions for follower
        this.clickedOnTuli = false; // Flag to prevent movement when clicking Tuli
        this.portals = []; // World transition portals
        this.frameCount = 0; // Frame counter for logging
        this.npcs = []; // NPCs in the world
        this.dragonSeenTriggered = false; // Flag to prevent multiple dragon detection triggers
        this.rocks = []; // Collectible rocks
        this.collectedRockIds = new Set(); // Track which rocks have been collected
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
        
        this.load.spritesheet('plane', '/spritesheets/plane.png', {
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
        
        // NPCs
        this.load.image('gnome', '/spritesheets/gnome.png');
        this.load.image('monkey', '/spritesheets/monkey.png');
        this.load.image('dragon-idle', '/spritesheets/dragon-idle.png');
        this.load.image('dragon-blink', '/spritesheets/dragon-idle-blink.png');
        this.load.image('dragon-happy', '/spritesheets/dragon-happy.png');
        this.load.image('dragon-fire', '/spritesheets/dragon-fire.png');
        
        // Collectibles
        this.load.image('rock', '/spritesheets/rock.png');
        
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
        this.textures.get('monkey').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('dragon-idle').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('dragon-blink').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('dragon-happy').setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get('dragon-fire').setFilter(Phaser.Textures.FilterMode.NEAREST);
        
        // Collectibles
        this.textures.get('rock').setFilter(Phaser.Textures.FilterMode.NEAREST);

        // Load the world configuration
        this.currentWorld = getWorld('tutorial');

        // Create background (world-specific color)
        const background = this.add.graphics();
        const backgroundColor = this.currentWorldKey === 'lavaWorld' ? 0x3a3a3a : 0x2594D0; // Dark gray for lava, blue for tutorial
        background.fillStyle(backgroundColor, 1);
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
          // Don't move if we just clicked on Tuli/NPC
          if (this.clickedOnTuli) {
            console.log('Blocked movement - clicked on NPC');
            this.clickedOnTuli = false; // Reset flag
            return;
          }
          
          const gridPos = this.worldToGrid(pointer.worldX, pointer.worldY);
          console.log(`Clicked floor at grid (${gridPos.gridX}, ${gridPos.gridY})`);
          
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
          // Monkey at (9, 21) - scaled down to half size
          this.createNPC(9, 21, 'monkey', 'openMonkeyChat', 0.5);
        } else if (this.currentWorldKey === 'lavaWorld') {
          // BLAZE the Dragon at (54, 17)
          this.createDragon(54, 17);
          // Maximillion the Gnome at (7, 10) - to travel back
          this.createNPC(7, 10, 'gnome', 'openGnomeChatReturn');
          
          // Create rocks if mission is accepted
          this.createRocks();
        }
      }

      createRocks() {
        const gameState = window.getGameState();
        const rockMission = gameState?.missions?.blazeRockCollection;
        
        // Only show rocks if mission is accepted and not completed
        if (!rockMission || !rockMission.accepted || rockMission.completed) {
          return;
        }
        
        // Rock positions in lava world
        const rockPositions = [
          { id: 'rock1', x: 27, y: 13 },
          { id: 'rock2', x: 67, y: 4 },
          { id: 'rock3', x: 86, y: 17 },
          { id: 'rock4', x: 105, y: 13 },
        ];
        
        // Determine which rocks should already be collected based on rocksFound count
        // If rocksFound is 2, rocks 1 and 2 are collected
        for (let i = 0; i < rockMission.rocksFound && i < rockPositions.length; i++) {
          this.collectedRockIds.add(rockPositions[i].id);
        }
        
        rockPositions.forEach((pos) => {
          // Skip if already collected
          if (this.collectedRockIds.has(pos.id)) {
            return;
          }
          
          this.createRock(pos.x, pos.y, pos.id);
        });
      }

      createRock(gridX, gridY, rockId) {
        const rockX = this.worldOffsetX + (gridX * this.tileSize);
        const rockY = this.worldOffsetY + (gridY * this.tileSize);
        
        // Create sparkle/glow effect (created first so it's behind rock)
        const glow = this.add.circle(rockX, rockY, 15, 0xcc88ff, 0.4);
        glow.setDepth(94);
        
        // Create the rock sprite
        const rock = this.add.image(rockX, rockY, 'rock');
        rock.setScale(0.6);
        rock.setDepth(95); // Above ground, below player
        rock.setInteractive();
        rock.rockId = rockId;
        rock.baseY = rockY; // Store base Y position
        
        // Store rock reference
        rock.glowCircle = glow;
        
        // Add hover up/down animation - animate both rock and glow together
        this.tweens.add({
          targets: [rock, glow],
          y: rockY - 5,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        // Add glow pulsing animation
        this.tweens.add({
          targets: glow,
          scaleX: 1.4,
          scaleY: 1.4,
          alpha: 0.6,
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        
        // Hover effect
        rock.on('pointerover', () => {
          rock.setTint(0xffccff);
          rock.setScale(0.7);
        });
        
        rock.on('pointerout', () => {
          rock.clearTint();
          rock.setScale(0.6);
        });
        
        // Click to collect
        rock.on('pointerdown', (pointer) => {
          if (pointer.leftButtonDown()) {
            this.collectRock(rock);
          }
        });
        
        this.rocks.push(rock);
      }

      collectRock(rock) {
        if (!rock || !rock.rockId || !rock.active) return;
        
        // Check if already collected
        if (this.collectedRockIds.has(rock.rockId)) {
          return;
        }
        
        // Mark as collected immediately
        this.collectedRockIds.add(rock.rockId);
        rock.disableInteractive(); // Prevent double-clicking
        
        // Remove from rocks array
        const index = this.rocks.indexOf(rock);
        if (index > -1) {
          this.rocks.splice(index, 1);
        }
        
        // Play collection animation
        this.tweens.add({
          targets: [rock, rock.glowCircle],
          scaleX: 1.5,
          scaleY: 1.5,
          alpha: 0,
          y: rock.y - 30,
          duration: 500,
          ease: 'Back.easeIn',
          onComplete: () => {
            rock.destroy();
            if (rock.glowCircle) {
              rock.glowCircle.destroy();
            }
          }
        });
        
        // Call global collect function
        if (window.collectRock) {
          window.collectRock();
        }
      }

      createNPC(gridX, gridY, spriteKey, chatFunction, scale = 1) {
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
        npc.setScale(scale);
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
            console.log(`Clicked on NPC at (${gridX}, ${gridY}), opening ${chatFunction}`);
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
        
        // Check if breathing exercise is completed
        const gameState = window.getGameState();
        const isExerciseCompleted = gameState && gameState.missions.blazeBreathingExercise.completed;
        
        // Create pulsing glow behind dragon - only show if exercise is COMPLETED
        const glow = this.add.circle(dragonX, dragonY, 30, 0xff4400, isExerciseCompleted ? 0.4 : 0);
        glow.setDepth(97);
        
        // Only animate glow if exercise is completed
        if (isExerciseCompleted) {
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
        }
        
        const dragon = this.add.image(dragonX, dragonY, 'dragon-idle');
        dragon.setScale(1.2);
        dragon.setDepth(98);
        
        // Only make dragon interactive if exercise is completed
        if (isExerciseCompleted) {
        dragon.setInteractive();
        }
        
        this.npcs.push(glow);
        this.npcs.push(dragon);
        
        // Store reference for later updates
        dragon.glowCircle = glow;
        
        // Track dragon animation state
        dragon.isAnimating = false;
        
        // Random blink animation
        const scheduleNextBlink = () => {
          const delay = Phaser.Math.Between(2000, 5000); // Random 2-5 seconds
          this.time.delayedCall(delay, () => {
            if (!dragon.isAnimating) {
            // Blink
            dragon.setTexture('dragon-blink');
            this.time.delayedCall(150, () => {
              dragon.setTexture('dragon-idle');
              scheduleNextBlink();
            });
            } else {
              scheduleNextBlink();
            }
          });
        };
        scheduleNextBlink();
        
        // Random fire-shooting animation with vibration
        const scheduleNextFire = () => {
          // Check if breathing exercise is completed - if so, don't fire
          const gameState = window.getGameState();
          if (gameState && gameState.missions.blazeBreathingExercise.completed) {
            return; // Dragon is calm now, no more fire
          }
          
          const delay = Phaser.Math.Between(3000, 8000); // Random 3-8 seconds
          this.time.delayedCall(delay, () => {
            if (!dragon.isAnimating) {
              dragon.isAnimating = true;
              
              // Store original position
              const originalX = dragon.x;
              const originalY = dragon.y;
              
              // Vibration effect
              const vibrationTween = this.tweens.add({
                targets: dragon,
                x: originalX + Phaser.Math.Between(-3, 3),
                y: originalY + Phaser.Math.Between(-2, 2),
                duration: 50,
                yoyo: true,
                repeat: 5, // Vibrate 6 times total
                ease: 'Sine.easeInOut'
              });
              
              // Show fire sprite
              dragon.setTexture('dragon-fire');
              
              // Return to idle after fire animation
              this.time.delayedCall(350, () => {
                dragon.setTexture('dragon-idle');
                
                // Ensure position is reset
                dragon.setPosition(originalX, originalY);
                
                dragon.isAnimating = false;
                scheduleNextFire();
              });
            } else {
              scheduleNextFire();
            }
          });
        };
        scheduleNextFire();
        
        // Hover and click effects - only add if exercise is completed
        if (isExerciseCompleted) {
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
            
            // Get current game state
            const gameState = window.getGameState ? window.getGameState() : {};
            const rockMission = gameState.missions?.blazeRockCollection || {};
            
            console.log('Dragon clicked, rockMission:', rockMission, 'dragon.isHappy:', dragon.isHappy);
            
            // Check if all rocks collected and haven't talked yet
            if (rockMission.allRocksFound && !rockMission.talkedToBlaze) {
              console.log('All rocks found! Changing dragon to happy sprite');
              
              // Change to happy sprite immediately
              if (window.makeDragonHappy) {
                window.makeDragonHappy();
              }
              
              // Mark as talked to
              if (window.updateMission) {
                window.updateMission('blazeRockCollection', { talkedToBlaze: true });
              }
              
              // Clear mission immediately
              if (window.setActiveMission) {
                window.setActiveMission(null);
              }
            }
            
            // Always open chat modal
            if (window.openDragonChat) {
              window.openDragonChat();
            }
          }
        });
        
        // Store dragon reference for updates
        this.dragon = dragon;
      }
      }
      
      enableDragonGlow() {
        console.log('Enabling dragon glow!');
        // Find dragon in NPCs and enable its glow and interactivity
        const dragonNPC = this.npcs.find(npc => npc.texture && npc.texture.key && npc.texture.key.includes('dragon'));
        console.log('Found dragon NPC:', dragonNPC);
        console.log('Dragon has glowCircle:', !!dragonNPC?.glowCircle);
        
        if (dragonNPC && dragonNPC.glowCircle) {
          // Kill any existing tweens first
          this.tweens.killTweensOf(dragonNPC.glowCircle);
          
          // Enable glow with warm, welcoming color (changed from angry red/orange to friendly yellow)
          dragonNPC.glowCircle.setFillStyle(0xffdd00, 0.5); // Yellow glow for happy dragon
          dragonNPC.glowCircle.setAlpha(0.6);
          this.tweens.add({
            targets: dragonNPC.glowCircle,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0.8,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
          
          console.log('Dragon glow enabled with happy yellow color!');
          
          // Make dragon interactive if not already
          if (!dragonNPC.input || !dragonNPC.input.enabled) {
            dragonNPC.setInteractive();
            
            // Add hover effect
            dragonNPC.on('pointerover', () => {
              dragonNPC.setTint(0xffaa66);
            });
            
            dragonNPC.on('pointerout', () => {
              dragonNPC.clearTint();
            });
            
            // Click to open chat (happy message)
            dragonNPC.on('pointerdown', (pointer) => {
              if (pointer.leftButtonDown()) {
                this.clickedOnTuli = true;
                
                if (window.openDragonChat) {
                  window.openDragonChat();
                }
              }
            });
          }
        } else {
          console.error('Could not enable dragon glow - dragon or glowCircle not found');
        }
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
        // Destroy all NPCs explicitly first
        if (this.npcs && this.npcs.length > 0) {
          this.npcs.forEach(npc => {
            if (npc && npc.destroy) {
              npc.destroy();
            }
          });
        }
        
        // Remove all children
        this.children.removeAll();
        this.portals = [];
        this.npcs = [];
        this.rocks = [];
        this.collectedRockIds.clear();
        
        // Reset dragon detection flag when changing worlds
        this.dragonSeenTriggered = false;
        
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
        
        // Update game state with new world
        if (window.updateGameState) {
          window.updateGameState({ currentWorld: worldKey });
        }
        
        // Recreate everything
        const width = this.scale.width;
        const height = this.scale.height;
        
        const background = this.add.graphics();
        const backgroundColor = this.currentWorldKey === 'lavaWorld' ? 0x3a3a3a : 0x2594D0; // Dark gray for lava, blue for tutorial
        background.fillStyle(backgroundColor, 1);
        background.fillRect(0, 0, width, height);
        
        this.worldOffsetX = (width / 2) - (this.currentWorld.width * this.tileSize) / 2;
        this.worldOffsetY = (height / 2) - (this.currentWorld.height * this.tileSize) / 2;
        
        this.createWorldFromLayers();
        
        const spawnX = this.worldOffsetX + (this.currentWorld.spawnPoint.x * this.tileSize);
        const spawnY = this.worldOffsetY + (this.currentWorld.spawnPoint.y * this.tileSize);
        
        this.createPlayer(spawnX, spawnY);
        this.createFollower(spawnX - 32, spawnY);
        
        // Restore glows if needed when returning to lava world
        if (worldKey === 'lavaWorld') {
          const gameState = window.getGameState();
          if (gameState && gameState.seenDragon) {
            if (!gameState.missions.blazeBreathingExercise.completed) {
              // Mission incomplete - show Tuli glow
              this.setTuliGlow(true);
              this.dragonSeenTriggered = true; // Set flag so we don't re-trigger detection
            } else {
              // Mission completed - show dragon glow instead
              this.time.delayedCall(500, () => {
                this.enableDragonGlow();
              });
            }
          }
        }
        
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
        // Create glow behind Tuli (initially hidden)
        this.tuliGlow = this.add.circle(x, y, 25, 0x9CD3B2, 0);
        this.tuliGlow.setDepth(98);
        this.tuliGlow.setStrokeStyle(2, 0x9CD3B2, 0);
        
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
            
            // Check if we should open dragon mission chat
            const gameState = window.getGameState();
            console.log('Tuli clicked! Game state:', gameState);
            console.log('Should open dragon mission?', gameState && gameState.seenDragon && !gameState.missions.blazeBreathingExercise.completed);
            console.log('window.openDragonMissionChat exists?', !!window.openDragonMissionChat);
            
            if (gameState && gameState.seenDragon && !gameState.missions.blazeBreathingExercise.completed) {
              console.log('Opening dragon mission chat!');
              if (window.openDragonMissionChat) {
                window.openDragonMissionChat();
              } else {
                console.error('window.openDragonMissionChat is not defined!');
              }
            } else if (window.openTuliChat) {
              console.log('Opening regular Tuli chat!');
              window.openTuliChat();
            }
          }
        });
      }

      setTuliGlow(enabled) {
        if (!this.tuliGlow) {
          console.log('Warning: tuliGlow object not found!');
          return;
        }
        
        if (enabled) {
          console.log('Enabling Tuli glow!');
          // Show and animate glow
          this.tuliGlow.setAlpha(0.5);
          this.tuliGlow.setStrokeStyle(3, 0x9CD3B2, 0.8);
          
          // Kill any existing tween first
          this.tweens.killTweensOf(this.tuliGlow);
          
          this.tweens.add({
            targets: this.tuliGlow,
            scaleX: 1.4,
            scaleY: 1.4,
            alpha: 0.7,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        } else {
          console.log('Disabling Tuli glow');
          // Hide glow and stop animation
          this.tweens.killTweensOf(this.tuliGlow);
          this.tuliGlow.setAlpha(0);
          this.tuliGlow.setStrokeStyle(2, 0x9CD3B2, 0);
          this.tuliGlow.setScale(1);
        }
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
        // A* pathfinding algorithm with mobile optimization
        const startGrid = this.worldToGrid(startX, startY);
        const endGrid = this.worldToGrid(endX, endY);
        
        // Limit pathfinding iterations for mobile performance
        const maxIterations = 1000;
        let iterations = 0;
        
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
        
        while (openSet.length > 0 && iterations < maxIterations) {
          iterations++;
          
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
        // Wrap in try-catch for iOS stability
        try {
          this.frameCount++;
          
          // Update Tuli glow position to follow follower
          if (this.tuliGlow && this.followerSprite) {
            this.tuliGlow.setPosition(this.followerSprite.x, this.followerSprite.y);
          }
        } catch (error) {
          console.error('Update error:', error);
          return; // Skip this frame on error
        }
        
        // Check if dragon is in viewport (lava world only) - only check once per second
        if (this.currentWorldKey === 'lavaWorld' && this.frameCount % 60 === 0 && !this.dragonSeenTriggered) {
          const gameState = window.getGameState();
          if (gameState && !gameState.seenDragon && !gameState.missions.blazeBreathingExercise.completed) {
            // Find dragon in NPCs
            const dragonNPC = this.npcs.find(npc => npc.texture && npc.texture.key && npc.texture.key.includes('dragon'));
            if (dragonNPC) {
              const camera = this.cameras.main;
              const worldView = camera.worldView;
              
              // Check if dragon is in camera view
              if (Phaser.Geom.Rectangle.Contains(worldView, dragonNPC.x, dragonNPC.y)) {
                console.log('Dragon detected in viewport! Triggering mission...');
                // Set flag immediately to prevent re-triggering
                this.dragonSeenTriggered = true;
                
                // Dragon is visible! Only update state once
                if (window.updateGameState && window.updateMission) {
                  window.updateGameState({ seenDragon: true, tuliGlowing: true });
                  window.updateMission('blazeBreathingExercise', { discovered: true });
                }
                
                // Turn on Tuli glow
                this.setTuliGlow(true);
                
                // Set timer for auto-opening chat after 15 seconds
                if (window.setDragonGlowTimer) {
                  window.setDragonGlowTimer();
                }
              }
            }
          }
        }
        
        // Check for rock collection (walk-over detection)
        if (this.playerSprites && this.rocks.length > 0) {
          this.rocks.forEach((rock) => {
            if (!rock.active) return; // Skip if rock is being destroyed
            
            const distance = Phaser.Math.Distance.Between(
              this.playerSprites.x,
              this.playerSprites.y,
              rock.x,
              rock.y
            );
            
            // Collect if within 16 pixels
            if (distance < 16) {
              this.collectRock(rock);
            }
          });
        }
        
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
      // iOS Safari optimizations
      render: {
        pixelArt: true,
        antialias: false,
        powerPreference: 'low-power',
      },
      audio: {
        noAudio: true, // Disable audio to prevent iOS issues
      },
      fps: {
        target: 45,
        forceSetTimeOut: true,
      },
    };

    phaserGameRef.current = new Phaser.Game(config);

    // Cleanup on unmount
    return () => {
      window.openTuliChat = null;
      window.openGnomeChat = null;
      window.openGnomeChatReturn = null;
      window.openMonkeyChat = null;
      window.openDragonChat = null;
      window.openDragonMissionChat = null;
      window.openBreathingExercise = null;
      window.setActiveMission = null;
      window.updateMission = null;
      window.startWorldTransition = null;
      window.endWorldTransition = null;
      window.getGameState = null;
      window.updateGameState = null;
      window.updateMission = null;
      window.setActiveMission = null;
      window.setDragonGlowTimer = null;
      window.collectRock = null;
      window.spawnRocks = null;
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
    };
  }, []);

  // Show welcome modal 2 seconds after game loads
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowTuliWelcome(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  // Handle dragon glow timer for auto-opening chat - only set up once
  useEffect(() => {
    window.setDragonGlowTimer = () => {
      // Clear any existing timer
      if (dragonGlowTimerRef.current) {
        clearTimeout(dragonGlowTimerRef.current);
      }
      
      // Set 15 second timer to auto-open dragon mission chat
      dragonGlowTimerRef.current = setTimeout(() => {
        // Check latest game state when timer fires
        const currentState = window.getGameState();
        // Only open if mission is not completed AND chat/exercise is not already open
        if (currentState && 
            !currentState.missions.blazeBreathingExercise.completed &&
            !showDragonMissionChatRef.current &&
            !showBreathingExerciseRef.current) {
          console.log('Auto-opening dragon mission chat after 15 seconds');
          setShowDragonMissionChat(true);
        } else {
          console.log('Skipping auto-open - chat or exercise already open');
        }
      }, 15000);
    };

    return () => {
      if (dragonGlowTimerRef.current) {
        clearTimeout(dragonGlowTimerRef.current);
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Reset Tuli glow when leaving lava world (but keep seenDragon true)
  useEffect(() => {
    if (gameState.currentWorld !== 'lavaWorld' && gameState.tuliGlowing) {
      // Only turn off the glow, don't reset seenDragon (we want to remember they saw the dragon)
      updateGameState({ tuliGlowing: false });
      // Tell Phaser to turn off glow
      if (phaserGameRef.current && phaserGameRef.current.scene.scenes[0]) {
        phaserGameRef.current.scene.scenes[0].setTuliGlow(false);
      }
    }
  }, [gameState.currentWorld, gameState.tuliGlowing, updateGameState]); // updateGameState is now memoized and stable

  // Update mission text when rocks are found
  useEffect(() => {
    const rockMission = gameState.missions.blazeRockCollection;
    if (!rockMission) return; // Safety check for old saved states
    
    if (rockMission.accepted && !rockMission.completed) {
      const missionText = translations?.blaze?.missionLocateRocks || "Locate BLAZE's rocks ({count}/{total})";
      setActiveMission(missionText.replace('{count}', rockMission.rocksFound).replace('{total}', rockMission.totalRocks));
    } else if (rockMission.completed && rockMission.allRocksFound && !rockMission.talkedToBlaze) {
      // All rocks found, need to talk to BLAZE
      setActiveMission(translations?.blaze?.missionTalkToBlaze || 'Talk to BLAZE');
    } else if (rockMission.talkedToBlaze) {
      setActiveMission(null); // Clear mission after talking to BLAZE
    }
  }, [gameState.missions.blazeRockCollection, setActiveMission]);

  const handleTravelToLavaWorld = () => {
    setShowGnomeChat(false);
    if (phaserGameRef.current && phaserGameRef.current.scene.scenes[0]) {
      phaserGameRef.current.scene.scenes[0].transitionToWorld('lavaWorld');
    }
  };

  const handleTravelToTutorial = () => {
    setShowGnomeChatReturn(false);
    if (phaserGameRef.current && phaserGameRef.current.scene.scenes[0]) {
      phaserGameRef.current.scene.scenes[0].transitionToWorld('tutorial');
    }
  };

  return (
    <>
      <div ref={gameRef} className="w-full h-full" />
      
      {/* Mission Card */}
      {gameState.activeMission && (
        <motion.div 
          className="fixed top-2 left-2 z-9999 pointer-events-auto"
          initial={{ x: -300, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -300, opacity: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20 }}
        >
          <div className="bg-white/85 backdrop-blur-sm rounded-xl shadow-2xl p-3 border-2 border-[#9CD3B2]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mission</span>
            </div>
            <div className="text-base font-bold text-gray-800 mt-0.5">
              {gameState.activeMission}
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Loading Screen */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/80 flex flex-col justify-center items-center z-10001 pointer-events-auto">
          <div className="text-white text-3xl font-bold mb-4">{loadingText}</div>
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      
      {/* Tuli Welcome Modal */}
      <AnimatePresence>
        {showTuliWelcome && (
          <TuliWelcomeModal 
            onClose={() => setShowTuliWelcome(false)}
            translations={translations}
          />
        )}
      </AnimatePresence>
      
      {/* Tuli Chat Modal */}
      <AnimatePresence>
      {showTuliChat && (
        <TuliChatModal 
          onClose={() => setShowTuliChat(false)} 
          language={language}
          translations={translations}
        />
      )}
      </AnimatePresence>
      
      {/* Dragon Mission Chat Modal */}
      <AnimatePresence>
      {showDragonMissionChat && (
        <DragonMissionChatModal 
          onClose={() => setShowDragonMissionChat(false)}
          language={language}
          translations={translations}
        />
      )}
      </AnimatePresence>
      
      {/* Breathing Exercise Modal */}
      <AnimatePresence>
        {showBreathingExercise && (
          <BreathingExerciseModal 
            onClose={() => setShowBreathingExercise(false)}
            translations={translations}
            onComplete={() => {
              console.log('onComplete callback triggered!');
              // Enable dragon glow and disable Tuli glow after breathing exercise
              if (phaserGameRef.current && phaserGameRef.current.scene.scenes[0]) {
                console.log('Enabling dragon glow and disabling Tuli glow...');
                phaserGameRef.current.scene.scenes[0].enableDragonGlow();
                phaserGameRef.current.scene.scenes[0].setTuliGlow(false);
              }
              // Update game state to turn off Tuli glowing and set active mission
              updateGameState({ tuliGlowing: false });
              setActiveMission(translations?.blaze?.missionSeeWhat || 'See what BLAZE wants');
              updateMission('blazeRockCollection', { discovered: true });
            }}
          />
        )}
      </AnimatePresence>
      
      {/* Maximillion Chat Modal */}
      <AnimatePresence>
      {showGnomeChat && (
        <GnomeChatModal 
          onClose={() => setShowGnomeChat(false)}
          onTravel={handleTravelToLavaWorld}
          translations={translations}
        />
      )}
      </AnimatePresence>
      
      {/* Maximillion Return Chat Modal */}
      <AnimatePresence>
        {showGnomeChatReturn && (
          <GnomeChatModal
            onClose={() => setShowGnomeChatReturn(false)}
            onTravel={handleTravelToTutorial}
            isReturn={true}
            translations={translations}
          />
        )}
      </AnimatePresence>
      
      {/* Monkey Chat Modal */}
      <AnimatePresence>
      {showMonkeyChat && (
        <MonkeyChatModal 
          onClose={() => setShowMonkeyChat(false)}
          translations={translations}
        />
      )}
      </AnimatePresence>
      
      {/* BLAZE Chat Modal */}
      <AnimatePresence>
      {showDragonChat && (
        <DragonChatModal 
          onClose={() => setShowDragonChat(false)}
          translations={translations}
        />
      )}
      </AnimatePresence>
    </>
  );
}

function TuliWelcomeModal({ onClose, translations }) {
  const t = translations?.npcs?.tuli || {};
  
  return (
    <motion.div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-white rounded-2xl p-4 sm:p-6 max-w-lg w-[90%] max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ 
          duration: 0.4, 
          ease: [0.34, 1.56, 0.64, 1] // Bouncy ease
        }}
      >
        <div className="flex items-start gap-3 sm:gap-4 mb-3 sm:mb-4">
          <motion.div 
            className="w-16 h-16 sm:w-20 sm:h-20 bg-contain bg-no-repeat bg-center shrink-0"
            style={{ backgroundImage: 'url(/spritesheets/tuli/avatar.png)' }}
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{ 
              delay: 0.2,
              duration: 0.5,
              ease: "easeOut"
            }}
          />
          <div className="flex-1">
            <motion.h3 
              className="text-xl sm:text-2xl font-bold text-[#3B7C7D] mb-2 sm:mb-3"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
            >
              {t.welcomeTitle || "Welcome to the Island of Feelings!"}
            </motion.h3>
            <motion.div
              className="text-gray-700 space-y-1.5 sm:space-y-2"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
            >
              <p className="font-semibold text-gray-800 text-sm sm:text-base">
                {t.welcomeHello || "Hello! I'm Tuli, your virtual friend. 🌟"}
              </p>
              <p className="text-sm sm:text-base">
                {t.welcomeAdventure || "I'll be with you on this adventure and many more to come!"}
              </p>
              <div className="mt-2 sm:mt-3 space-y-1 sm:space-y-1.5 text-xs sm:text-sm">
                <p><span className="font-semibold">🖱️ {t.welcomeNavigate || "Navigate:"}</span> {t.welcomeNavigateDesc || "Click anywhere to move around the island"}</p>
                <p><span className="font-semibold">💬 {t.welcomeTalk || "Talk to me:"}</span> {t.welcomeTalkDesc || "Click on me anytime to chat or ask questions"}</p>
                <p><span className="font-semibold">👥 {t.welcomeMeet || "Meet others:"}</span> {t.welcomeMeetDesc || "Look for glowing characters to interact with them"}</p>
              </div>
            </motion.div>
          </div>
        </div>
        
        <motion.button
          onClick={onClose}
          className="w-full bg-linear-to-br from-[#a8ddc0] to-[#9CD3B2] text-white font-bold py-3 px-6 rounded-lg transition-all hover:opacity-90 hover:shadow-lg cursor-pointer"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {t.welcomeButton || "Let's explore!"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function TuliChatModal({ onClose, language, translations }) {
  const t = translations?.npcs?.tuli || {};
  
  // Get initial message based on current world
  const getInitialMessage = () => {
    const currentWorld = window.currentGameWorld || 'tutorial';
    
    if (currentWorld === 'lavaWorld') {
      return t.chatLavaWorld || "Hi there! 🔥 Its HOT in here! Have you met BLAZE yet? He seems pretty upset about his rocks. How are YOU feeling?";
    } else {
      return t.chatTutorial || "Hi friend! 🌊 Welcome to the Island of Feelings! The breeze feels nice here, doesn't it? How are you doing today?";
    }
  };

  const [messages, setMessages] = useState([
    { role: 'assistant', content: getInitialMessage() }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      // Get world context from global
      const worldContext = {
        worldKey: window.currentGameWorld || 'tutorial'
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          worldContext,
          language: language || 'en'
        }),
      });

      const data = await response.json();
      
      if (data.message) {
        setMessages([...newMessages, { role: 'assistant', content: data.message }]);
      } else {
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: "I'm having trouble connecting right now. Can you try again?" 
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: "Oops! Something went wrong. Let's try again!" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-white rounded-2xl p-6 max-w-lg w-[90%] h-[600px] max-h-[80vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
          <motion.div 
            className="w-12 h-12 bg-contain bg-no-repeat bg-center shrink-0"
            style={{ backgroundImage: 'url(/spritesheets/tuli/avatar.png)' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-[#3B7C7D]">{t.chatTitle || "Chat with Tuli"}</h3>
            <p className="text-xs text-gray-500">{t.chatSubtitle || "Your supportive friend"}</p>
          </div>
        <button
          onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
        >
            ×
        </button>
      </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-3">
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === 'user' 
                  ? 'bg-[#9CD3B2] text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {msg.content}
    </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="bg-gray-100 text-gray-800 rounded-2xl px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9CD3B2] focus:border-transparent text-gray-800 placeholder:text-gray-500"
            disabled={isLoading}
          />
          <motion.button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-linear-to-br from-[#a8ddc0] to-[#9CD3B2] text-white font-bold px-6 py-3 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={{ scale: input.trim() && !isLoading ? 1.05 : 1 }}
            whileTap={{ scale: input.trim() && !isLoading ? 0.95 : 1 }}
          >
            Send
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DragonMissionChatModal({ onClose, language, translations }) {
  const { gameState, updateGameState } = useGameState();
  const tb = translations?.blaze || {};
  const tc = translations?.chat || {};
  
  const [messages, setMessages] = useState([
    { role: 'assistant', content: tb.missionInitial || 'Hey! 😮 Have you seen BLAZE? He looks really upset! What do you think we could do to help him calm down?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showBreathingButton, setShowBreathingButton] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const worldContext = {
        worldKey: 'lavaWorld'
      };

      const missionContext = {
        dragonBreathingExercise: true,
        completed: gameState.missions.blazeBreathingExercise.completed
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          worldContext,
          missionContext,
          language: language || 'en'
        }),
      });

      const data = await response.json();
      
      if (data.message) {
        setMessages([...newMessages, { role: 'assistant', content: data.message }]);
        
        // Check for action to start breathing exercise
        if (data.action === 'START_BREATHING_EXERCISE') {
          setShowBreathingButton(true);
        }
      } else {
        setMessages([...newMessages, { 
          role: 'assistant', 
          content: "I'm having trouble connecting right now. Can you try again?" 
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newMessages, { 
        role: 'assistant', 
        content: "Oops! Something went wrong. Let's try again!" 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleStartBreathingExercise = () => {
    onClose();
    // Trigger breathing exercise modal
    if (window.openBreathingExercise) {
      window.openBreathingExercise();
    }
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-white rounded-2xl p-6 max-w-lg w-[90%] h-[600px] max-h-[80vh] shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
          <motion.div 
            className="w-12 h-12 bg-contain bg-no-repeat bg-center shrink-0"
            style={{ backgroundImage: 'url(/spritesheets/tuli/avatar.png)' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          />
          <div className="flex-1">
            <h3 className="text-xl font-bold text-[#3B7C7D]">Help BLAZE!</h3>
            <p className="text-xs text-gray-500">Mission: Calm the Dragon</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-3">
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                msg.role === 'user' 
                  ? 'bg-[#9CD3B2] text-white' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isLoading && (
            <motion.div
              className="flex justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="bg-gray-100 text-gray-800 rounded-2xl px-4 py-2">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input or Breathing Exercise Button */}
        {showBreathingButton ? (
          <motion.button
            onClick={handleStartBreathingExercise}
            className="w-full bg-linear-to-br from-[#a8ddc0] to-[#9CD3B2] text-white font-bold py-4 px-6 rounded-xl transition-opacity hover:opacity-90"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {translations?.breathing?.startButton || "🌬️ Start Breathing Exercise with BLAZE"}
          </motion.button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={translations?.chat?.placeholder || "Type your message..."}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#9CD3B2] focus:border-transparent text-gray-800 placeholder:text-gray-500"
              disabled={isLoading}
            />
            <motion.button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              className="bg-linear-to-br from-[#a8ddc0] to-[#9CD3B2] text-white font-bold px-6 py-3 rounded-xl transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: input.trim() && !isLoading ? 1.05 : 1 }}
              whileTap={{ scale: input.trim() && !isLoading ? 0.95 : 1 }}
            >
              {translations?.chat?.send || "Send"}
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function BreathingExerciseModal({ onClose, onComplete, translations }) {
  const { completeMission } = useGameState();
  const t = translations?.breathing || {};
  const [phase, setPhase] = useState('intro'); // intro, inhale, hold, exhale, complete
  const [count, setCount] = useState(0);
  const [breathCycle, setBreathCycle] = useState(0);
  const [volcanicMeter, setVolcanicMeter] = useState(100);
  const totalCycles = 3;

  useEffect(() => {
    if (phase === 'intro') return;
    if (phase === 'complete') return;

    let duration = 0;
    if (phase === 'inhale') duration = 4;
    if (phase === 'hold') duration = 4;
    if (phase === 'exhale') duration = 6;

    if (count < duration) {
      const timer = setTimeout(() => {
        setCount(count + 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Move to next phase
      if (phase === 'inhale') {
        setPhase('hold');
        setCount(0);
      } else if (phase === 'hold') {
        setPhase('exhale');
        setCount(0);
      } else if (phase === 'exhale') {
        // Reduce volcanic meter
        setVolcanicMeter(prev => Math.max(0, prev - 33));
        
        if (breathCycle + 1 >= totalCycles) {
          setPhase('complete');
        } else {
          setBreathCycle(breathCycle + 1);
          setPhase('inhale');
          setCount(0);
        }
      }
    }
  }, [phase, count, breathCycle]);

  const startExercise = () => {
    setPhase('inhale');
    setCount(0);
  };

  const handleComplete = () => {
    console.log('Breathing exercise completed!');
    completeMission('blazeBreathingExercise');
    if (onComplete) {
      console.log('Calling onComplete callback to enable dragon glow...');
      onComplete();
    }
    onClose();
  };

  // Auto-complete if dev flag is enabled
  useEffect(() => {
    if (DEV_CONFIG.skipBreathingExercise) {
      console.log('DEV MODE: Auto-completing breathing exercise');
      setTimeout(() => {
        handleComplete();
      }, 500); // Small delay to show modal briefly
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const getPhaseText = () => {
    if (phase === 'inhale') return 'Breathe IN cool air...';
    if (phase === 'hold') return 'Hold your breath...';
    if (phase === 'exhale') return 'Breathe OUT hot air slowly...';
    return '';
  };

  const getPhaseColor = () => {
    if (phase === 'inhale') return '#60a5fa'; // Blue
    if (phase === 'hold') return '#a78bfa'; // Purple
    if (phase === 'exhale') return '#f87171'; // Red
    return '#9CD3B2';
  };

  const getCircleScale = () => {
    if (phase === 'inhale') {
      return 1 + (count / 4) * 0.5; // Grow from 1 to 1.5
    }
    if (phase === 'hold') {
      return 1.5; // Stay large
    }
    if (phase === 'exhale') {
      return 1.5 - (count / 6) * 0.5; // Shrink from 1.5 to 1
    }
    return 1;
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/70 flex justify-center items-center z-10001 pointer-events-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-linear-to-br from-orange-50 to-red-50 rounded-2xl p-4 sm:p-8 max-w-lg w-[90%] max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        transition={{ duration: 0.4, type: "spring" }}
      >
        {phase === 'intro' && (
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-orange-700 mb-3 sm:mb-4">{t.title || "🌋 The Dragon's Breath"}</h2>
            <div className="bg-white rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <p className="text-gray-800 mb-3 sm:mb-4 text-base sm:text-lg" dangerouslySetInnerHTML={{ __html: t.intro || `Let's help BLAZE cool down with the <strong>Dragon's Breath</strong> technique!` }} />
              <div className="text-left space-y-1.5 sm:space-y-2 text-gray-700 text-sm sm:text-base">
                <p dangerouslySetInnerHTML={{ __html: t.stepInhale || "🌬️ <strong>Breathe IN</strong> cool air (4 counts)" }} />
                <p dangerouslySetInnerHTML={{ __html: t.stepHold || "⏸️ <strong>Hold</strong> your breath (4 counts)" }} />
                <p dangerouslySetInnerHTML={{ __html: t.stepExhale || "🔥 <strong>Breathe OUT</strong> hot air slowly (6 counts)" }} />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 italic mb-4 sm:mb-6">
              {t.quote || `"Deep breathing cools down our angry fire inside"`}
            </p>
            <motion.button
              onClick={startExercise}
              className="w-full bg-linear-to-br from-orange-500 to-red-500 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl text-lg sm:text-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t.startExercise || "Start Breathing Exercise"}
            </motion.button>
          </div>
        )}

        {phase !== 'intro' && phase !== 'complete' && (
          <div className="text-center">
            <h3 className="text-xl sm:text-2xl font-bold text-orange-700 mb-2">
              {(t.breathCount || "Breath {current} of {total}").replace('{current}', breathCycle + 1).replace('{total}', totalCycles)}
            </h3>
            
            {/* Volcanic Meter */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-700">{t.volcanoHeat || "🌋 Volcano Heat"}</span>
                <span className="text-sm font-bold text-orange-600">{volcanicMeter}%</span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
                <motion.div 
                  className="h-full bg-linear-to-r from-orange-500 to-red-600"
                  initial={{ width: `${volcanicMeter}%` }}
                  animate={{ width: `${volcanicMeter}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>

            {/* Breathing Circle */}
            <div className="flex justify-center items-center mb-4 sm:mb-6 h-[180px] sm:h-[250px]">
              <motion.div
                className="rounded-full flex items-center justify-center w-[120px] h-[120px] sm:w-[150px] sm:h-[150px]"
                style={{
                  backgroundColor: getPhaseColor(),
                  opacity: 0.8,
                }}
                animate={{
                  scale: getCircleScale(),
                }}
                transition={{
                  duration: 1,
                  ease: "easeInOut"
                }}
              >
                <div className="text-center">
                  <div className="text-5xl sm:text-6xl font-bold text-white">
                    {phase === 'inhale' ? 4 - count : phase === 'hold' ? 4 - count : 6 - count}
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Phase Text */}
            <motion.p 
              className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4"
              style={{ color: getPhaseColor() }}
              key={phase}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {getPhaseText()}
            </motion.p>
          </div>
        )}

        {phase === 'complete' && (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200 }}
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-green-600 mb-3 sm:mb-4">{t.completeTitle || "🎉 Amazing Work!"}</h2>
            </motion.div>
            <div className="bg-white rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <p className="text-gray-800 mb-3 sm:mb-4 text-base sm:text-lg">
                {t.completeMessage || "You helped BLAZE cool down! The volcano is calm now. 🌋✨"}
              </p>
              <div className="mb-4">
                <div className="w-full bg-gray-300 rounded-full h-4 overflow-hidden">
                  <div className="h-full bg-linear-to-r from-green-400 to-green-600 w-0 animate-[fillBar_1s_ease-in-out_forwards]" />
                </div>
              </div>
              <p className="text-sm text-gray-600 italic">
                "Deep breathing cools down our angry fire inside"
              </p>
            </div>
            <motion.button
              onClick={handleComplete}
              className="w-full bg-linear-to-br from-green-500 to-green-600 text-white font-bold py-3 sm:py-4 px-4 sm:px-6 rounded-xl text-lg sm:text-xl"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {t.completeButton || "Complete Exercise ✓"}
            </motion.button>
          </div>
        )}
      </motion.div>
      
      <style jsx>{`
        @keyframes fillBar {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </motion.div>
  );
}

function MonkeyChatModal({ onClose, translations }) {
  const t = translations?.npcs?.monkey || {
    greeting: "Hey, I'll be able to take you to the spring dark forest soon, but I'm just out of gas right now.",
    close: "Okay"
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-white rounded-2xl p-6 max-w-md w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
      >
        <div className="flex items-start gap-4 mb-4">
          <motion.div 
            className="w-20 h-20 bg-contain bg-no-repeat bg-center shrink-0"
            style={{ backgroundImage: 'url(/spritesheets/monkey.png)' }}
            initial={{ rotate: -20, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          />
          <div className="flex-1">
            <motion.h3 
              className="text-xl font-bold text-gray-800 mb-2"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {t.name || "Monkey says:"}
            </motion.h3>
            <motion.p 
              className="text-gray-700"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {t.greeting}
            </motion.p>
          </div>
        </div>
        
        <motion.button
          onClick={onClose}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {t.close}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function GnomeChatModal({ onClose, onTravel, isReturn = false, translations }) {
  const t = translations?.npcs?.gnome || {
    greeting: "I heard there's a dragon in the far lands who has lost his rock collection! I can take you there to help him out!",
    returnGreeting: "Ready to head back to the Island of Feelings? I can take you there anytime!",
    travel: "Take me there",
    notNow: "Not now"
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-white rounded-2xl p-6 max-w-md w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.8, opacity: 0, y: 50 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.8, opacity: 0, y: 50 }}
        transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
      >
        <div className="flex items-start gap-4 mb-4">
          <motion.div 
            className="w-20 h-20 bg-contain bg-no-repeat bg-center shrink-0 rounded-full"
            style={{ backgroundImage: 'url(/spritesheets/gnome-avatar.png)' }}
            initial={{ rotate: -20, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300 }}
          />
          <div className="flex-1">
            <motion.h3 
              className="text-xl font-bold text-gray-800 mb-2"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {t.name || "Maximillion says:"}
            </motion.h3>
            <motion.p 
              className="text-gray-700"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {isReturn ? t.returnGreeting : t.greeting}
            </motion.p>
          </div>
        </div>
        
        <motion.div 
          className="flex gap-3"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <motion.button
            onClick={onTravel}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {t.travel}
          </motion.button>
          <motion.button
            onClick={onClose}
            className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {t.notNow}
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function DragonChatModal({ onClose, translations }) {
  const { gameState, updateMission, setActiveMission } = useGameState();
  const tb = translations?.blaze || {};
  const t = translations?.npcs?.dragon || {
    sad: "Rawr! I lost my rock collection and i cant stand it!",
    happy: "Thank you so much! You found all my precious rocks! I'm so happy!",
    rocksProgress: "found",
    helpButton: "I'll help you find them!",
    thankYouButton: "You're welcome, Vesuvvy!"
  };
  const isCalm = gameState.missions.blazeBreathingExercise.completed;
  const rockMission = gameState.missions.blazeRockCollection || {
    discovered: false,
    accepted: false,
    completed: false,
    rocksFound: 0,
    totalRocks: 4,
  };
  
  // Determine which message to show
  const getMessage = () => {
    if (!isCalm) {
      return tb.angry || "Someone knocked over my rock collection that took me WEEKS to build! Im so MAD I could EXPLODE! Everything feels HOT and I want to ROAR!";
    }
    
    if (!rockMission.discovered) {
      return tb.grateful || "Thank you so much for helping me calm down! 😊 That breathing exercise really helped. I feel so much better now! You're a great friend!";
    }
    
    if (!rockMission.accepted) {
      return tb.askForHelp || "Now that I'm calm, I can think clearly! 🤔 My precious rock collection is scattered all over the lava caves. I had 4 special rocks... Can you help me find them? They mean everything to me!";
    }
    
    if (rockMission.rocksFound < rockMission.totalRocks) {
      const searchText = tb.searching || "You're doing great! You've found {count} out of {total} rocks. Keep looking around the caves! 🔍";
      return searchText.replace('{count}', rockMission.rocksFound).replace('{total}', rockMission.totalRocks);
    }
    
    return tb.complete || "You found ALL my rocks! 🎉 Thank you so much! You're the best friend a dragon could ask for!";
  };

  const getButtonText = () => {
    if (!isCalm) return tb.helpButton || "Help BLAZE";
    if (!rockMission.discovered) return tb.thankYouButton || "You're welcome, BLAZE! 🐉";
    if (!rockMission.accepted) return tb.acceptButton || "I'll help you find your rocks!";
    if (rockMission.rocksFound < rockMission.totalRocks) return tb.searchButton || "I'll keep looking!";
    return tb.happyButton || "Happy to help! 🐉";
  };

  const handleButtonClick = () => {
    if (isCalm && rockMission.discovered && !rockMission.accepted) {
      // Accept the mission
      updateMission('blazeRockCollection', { accepted: true });
      const missionText = tb.missionLocateRocks || "Locate BLAZE's rocks ({count}/{total})";
      setActiveMission(missionText.replace('{count}', rockMission.rocksFound).replace('{total}', rockMission.totalRocks));
      
      // Spawn rocks in the world
      setTimeout(() => {
        if (window.spawnRocks) {
          window.spawnRocks();
        }
      }, 500); // Small delay to let modal close
    }
    onClose();
  };

  return (
    <motion.div 
      className="fixed inset-0 bg-black/50 flex justify-center items-center z-10000 pointer-events-auto"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-white rounded-2xl p-6 max-w-md w-[90%] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <div className="flex items-start gap-4 mb-4">
          <motion.div 
            className="w-24 h-24 bg-contain bg-no-repeat bg-center shrink-0"
            style={{ backgroundImage: 'url(/spritesheets/dragon-idle.png)' }}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          />
          <div className="flex-1">
            <h3 className={`text-xl font-bold mb-2 ${
              isCalm ? (rockMission.completed ? 'text-green-600' : 'text-[#3B7C7D]') : 'text-orange-700'
            }`}>
              {tb.name || "BLAZE says:"}
            </h3>
            <p className="text-gray-700">
              {getMessage()}
            </p>
          </div>
        </div>
        
        <motion.button
          onClick={handleButtonClick}
          className={`w-full font-bold py-3 px-6 rounded-lg transition-colors cursor-pointer text-white ${
            isCalm 
              ? (rockMission.discovered && !rockMission.accepted 
                  ? 'bg-orange-600 hover:bg-orange-700' 
                  : 'bg-green-600 hover:bg-green-700')
              : 'bg-red-600 hover:bg-red-700'
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {getButtonText()}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

