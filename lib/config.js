// Development configuration
export const DEV_CONFIG = {
  // Set to true to skip the welcome modal and load directly into the game
  skipIntro: false,
  
  // Set to true to show the tileset viewer instead of the game
  // This displays all tiles in a grid with their index numbers
  showTilesetViewer: false,
  
  // Show the tileset viewer toggle button in the game
  showTilesetViewerButton: false,
  
  // Show the world editor button in the game
  showWorldEditorButton: false,
  
  // Skip breathing exercise (auto-complete for faster testing)
  skipBreathingExercise: true,
  
  // Double player movement speed for faster testing
  doublePlayerSpeed: true,
  
  // Test user data (used when skipIntro is true)
  testUser: {
    firstName: 'ilia',
    lastName: 'demertchian',
    language: 'en'
  }
};

// You can easily toggle this for production
export const isProduction = false;

