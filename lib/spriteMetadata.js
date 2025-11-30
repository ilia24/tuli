// Sprite metadata - name and describe each tile by index

export const PLAYER_SPRITES = {
  // Player front
  0: 'player-front-top-left',
  1: 'player-front-top-right',
  8: 'player-front-bottom-left',
  9: 'player-front-bottom-right',
  
  // Player right
  2: 'player-right-top-left',
  3: 'player-right-top-right',
  10: 'player-right-bottom-left',
  11: 'player-right-bottom-right',
  
  // Player left
  4: 'player-left-top-left',
  5: 'player-left-top-right',
  12: 'player-left-bottom-left',
  13: 'player-left-bottom-right',
  
  // Player back
  6: 'player-back-top-left',
  7: 'player-back-top-right',
  14: 'player-back-bottom-left',
  15: 'player-back-bottom-right',
};

export const TILESET_SPRITES = {
  0: 'grass-patch-on-dirt-top-left-corner',
  1: 'grass-patch-on-dirt-top-variant-1',
  2: 'grass-patch-on-dirt-top-variant-2',
  3: 'grass-patch-on-dirt-top-right-corner',
  9: 'grass-patch-on-dirt-left-variant-1',
  10: 'grass-patch-on-dirt-middle-variant-1',
  11: 'grass-patch-on-dirt-middle-variant-2',
  12: 'grass-patch-on-dirt-right-variant-1',
  18: 'grass-patch-on-dirt-variant-2',
  19: 'grass-patch-on-dirt-middle-variant-3',
  20: 'grass-patch-on-dirt-variant-4',
  21: 'grass-patch-on-dirt-right-variant-2',
  27: 'grass-patch-on-dirt-bottom-left-corner',
  28: 'grass-patch-on-dirt-bottom-variant-1',
  29: 'grass-patch-on-dirt-bottom-variant-2',
  30: 'grass-patch-on-dirt-bottom-right-corner',
  36: 'dirt-variant-1',
  37: 'dirt-variant-2',
  38: 'dirt-variant-3',
  39: 'dirt-variant-4',
};

export const OBJECT_SPRITES = {
  // Add object names as you identify them
  // 0: 'tree-small',
  // 1: 'rock',
  // etc.
};

export const TRAIN_SPRITES = {
  // Add train tile names as you identify them
  // 0: 'track-horizontal',
  // 1: 'track-vertical',
  // etc.
};

export const FIRECAVE_SPRITES = {
  // Add firecave tile names as you identify them
  // 0: 'lava-flow',
  // 1: 'cave-wall',
  // etc.
};

export const PLANE_SPRITES = {
  // Add plane tile names as you identify them
  // 0: 'plane-part-1',
  // 1: 'plane-part-2',
  // etc.
};

// Helper function to get sprite name
export function getSpriteName(spritesheet, index) {
  const metadata = {
    'player': PLAYER_SPRITES,
    'tileset': TILESET_SPRITES,
    'objects': OBJECT_SPRITES,
    'train': TRAIN_SPRITES,
    'firecave': FIRECAVE_SPRITES,
    'plane': PLANE_SPRITES,
  };
  
  return metadata[spritesheet]?.[index] || `tile-${index}`;
}

// Helper to get all named sprites for a sheet
export function getSpriteMetadata(spritesheet) {
  const metadata = {
    'player': PLAYER_SPRITES,
    'tileset': TILESET_SPRITES,
    'objects': OBJECT_SPRITES,
    'train': TRAIN_SPRITES,
    'firecave': FIRECAVE_SPRITES,
    'plane': PLANE_SPRITES,
  };
  
  return metadata[spritesheet] || {};
}

// Helper to get index from sprite name (reverse lookup)
export function getSpriteIndex(spritesheet, name) {
  const metadata = getSpriteMetadata(spritesheet);
  
  for (const [index, spriteName] of Object.entries(metadata)) {
    if (spriteName === name) {
      return parseInt(index);
    }
  }
  
  // If not found, check if name is already a number
  const numIndex = parseInt(name);
  return isNaN(numIndex) ? 0 : numIndex;
}

// Example usage in game code:
// Instead of: this.add.image(x, y, 'tileset', 0);
// You can use: this.add.image(x, y, 'tileset', getSpriteIndex('tileset', 'grass-patch-on-dirt-top-left-corner'));

