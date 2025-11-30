// World/Level Configuration System
import { tutorial } from './worlds/tutorial';
import { lavaWorld } from './worlds/lavaWorld';
import { lavaWorldHappy } from './worlds/lavaWorldHappy';

// Tile Properties - define behavior for each tile type
export const TILE_PROPERTIES = {
  // Grass tiles - all walkable
  10: { walkable: true, name: 'grass-middle-1' },
  11: { walkable: true, name: 'grass-middle-2' },
  19: { walkable: true, name: 'grass-middle-3' },
  
  // Dirt tiles - all walkable
  36: { walkable: true, name: 'dirt-1' },
  37: { walkable: true, name: 'dirt-2' },
  38: { walkable: true, name: 'dirt-3' },
  39: { walkable: true, name: 'dirt-4' },
  
  // Grass borders - walkable
  0: { walkable: true, name: 'grass-patch-on-dirt-top-left-corner' },
  1: { walkable: true, name: 'grass-top-variant-1' },
  2: { walkable: true, name: 'grass-top-variant-2' },
  3: { walkable: true, name: 'grass-top-right-corner' },
  9: { walkable: true, name: 'grass-left-variant-1' },
  12: { walkable: true, name: 'grass-right-variant-1' },
  
  // Add more tile properties as needed
  // Example non-walkable: 50: { walkable: false, name: 'rock' }
};

// World Definitions
export const WORLDS = {
  tutorial: tutorial,
  lavaWorld: lavaWorld,
  lavaWorldHappy: lavaWorldHappy,
};

// Helper functions
export function getWorld(worldKey) {
  return WORLDS[worldKey];
}

export function getTileAt(world, layerIndex, x, y) {
  const layer = world.layers[layerIndex];
  if (!layer || y < 0 || y >= layer.tiles.length || x < 0 || x >= layer.tiles[0].length) {
    return null;
  }
  return layer.tiles[y][x];
}

export function getLayerCount(world) {
  return world.layers ? world.layers.length : 0;
}

export function isTileWalkable(tileIndex, world, layerIndex, x, y) {
  // Check world-specific tile properties first
  if (world && world.tileProperties) {
    const tileKey = `${layerIndex}-${x}-${y}`;
    const tileProps = world.tileProperties[tileKey];
    if (tileProps && tileProps.walkable !== undefined) {
      return tileProps.walkable;
    }
  }
  
  // Fall back to tileset properties
  const props = TILE_PROPERTIES[tileIndex];
  return props ? props.walkable : true; // Default to walkable if not defined
}

export function isTileAbovePlayer(world, layerIndex, x, y) {
  if (world && world.tileProperties) {
    const tileKey = `${layerIndex}-${x}-${y}`;
    const tileProps = world.tileProperties[tileKey];
    return tileProps ? tileProps.abovePlayer : false;
  }
  return false;
}

export function getTileProperties(tileIndex) {
  return TILE_PROPERTIES[tileIndex] || { walkable: true, name: `tile-${tileIndex}` };
}
