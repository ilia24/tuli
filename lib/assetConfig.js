// Asset configuration for easy sprite management

export const ASSETS = {
  // Character sprites
  characters: {
    player: {
      // Player sprite sheet (16x16)
      spritesheet: {
        key: 'player-sprite',
        path: '/spritesheets/Player.png',
        frameWidth: 16,
        frameHeight: 16,
      },
      // Animations configuration
      animations: {
        idle: { frames: [0, 1, 2, 3], frameRate: 8, repeat: -1 },
        walk_down: { frames: [4, 5, 6, 7], frameRate: 8, repeat: -1 },
        walk_up: { frames: [8, 9, 10, 11], frameRate: 8, repeat: -1 },
        walk_left: { frames: [12, 13, 14, 15], frameRate: 8, repeat: -1 },
        walk_right: { frames: [16, 17, 18, 19], frameRate: 8, repeat: -1 },
      }
    },
  },

  // Environment sprites
  environment: {
    tree: {
      key: 'tree',
      path: '/sprites/environment/tree.png',
    },
    rock: {
      key: 'rock',
      path: '/sprites/environment/rock.png',
    },
    grass: {
      key: 'grass',
      path: '/sprites/environment/grass.png',
    }
  },

  // Background/Tiles
  backgrounds: {
    island: {
      key: 'island-bg',
      path: '/sprites/backgrounds/island.png',
    }
  },

  // Tilesets
  tilesets: {
    main: {
      key: 'tileset',
      path: '/spritesheets/Tileset_16x16.png',
      tileWidth: 16,
      tileHeight: 16,
    },
    objects: {
      key: 'objects',
      path: '/spritesheets/Objects.png',
      tileWidth: 16,
      tileHeight: 16,
    }
  }
};

// Helper to load all assets
export function loadAssets(scene) {
  // Load character spritesheets
  Object.values(ASSETS.characters).forEach(char => {
    if (char.spritesheet) {
      scene.load.spritesheet(
        char.spritesheet.key,
        char.spritesheet.path,
        {
          frameWidth: char.spritesheet.frameWidth,
          frameHeight: char.spritesheet.frameHeight,
        }
      );
    }
  });

  // Load environment sprites (single images)
  Object.values(ASSETS.environment).forEach(sprite => {
    scene.load.image(sprite.key, sprite.path);
  });

  // Load backgrounds
  Object.values(ASSETS.backgrounds).forEach(bg => {
    scene.load.image(bg.key, bg.path);
  });

  // Load tilesets
  Object.values(ASSETS.tilesets).forEach(tileset => {
    scene.load.spritesheet(tileset.key, tileset.path, {
      frameWidth: tileset.tileWidth,
      frameHeight: tileset.tileHeight,
    });
  });
}

// Helper to create animations
export function createAnimations(scene) {
  // Create player animations
  const playerAnims = ASSETS.characters.player.animations;
  
  Object.keys(playerAnims).forEach(animKey => {
    const config = playerAnims[animKey];
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers('player', { 
        frames: config.frames 
      }),
      frameRate: config.frameRate,
      repeat: config.repeat,
    });
  });
}

