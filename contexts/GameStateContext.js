'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const GameStateContext = createContext();

export function GameStateProvider({ children }) {
  const [gameState, setGameState] = useState({
    missions: {
      blazeBreathingExercise: {
        discovered: false,
        completed: false,
      },
      blazeRockCollection: {
        discovered: false,
        accepted: false,
        completed: false,
        rocksFound: 0,
        totalRocks: 4,
      }
    },
    currentWorld: 'tutorial',
    seenDragon: false,
    tuliGlowing: false,
    activeMission: null, // Current mission to display in UI
    });
    console.log('gameState', gameState);
  
    // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('tuliGameState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        
        // Migrate old states to include new missions
        if (!parsed.missions.blazeRockCollection) {
          parsed.missions.blazeRockCollection = {
            discovered: false,
            accepted: false,
            completed: false,
            rocksFound: 0,
            totalRocks: 4,
          };
        }
        
        if (!parsed.hasOwnProperty('activeMission')) {
          parsed.activeMission = null;
        }
        
        setGameState(parsed);
      } catch (e) {
        console.error('Failed to load game state:', e);
      }
    }
  }, []);

  // Save state to localStorage whenever it changes (with a small delay to batch updates)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      localStorage.setItem('tuliGameState', JSON.stringify(gameState));
    }, 100); // 100ms debounce

    return () => clearTimeout(timeoutId);
  }, [gameState]);

  const updateGameState = useCallback((updates) => {
    setGameState(prev => ({
      ...prev,
      ...updates,
    }));
  }, []);

  const updateMission = useCallback((missionId, updates) => {
    setGameState(prev => ({
      ...prev,
      missions: {
        ...prev.missions,
        [missionId]: {
          ...prev.missions[missionId],
          ...updates,
        }
      }
    }));
  }, []);

  const completeMission = useCallback((missionId) => {
    setGameState(prev => ({
      ...prev,
      missions: {
        ...prev.missions,
        [missionId]: {
          ...prev.missions[missionId],
          completed: true,
        }
      }
    }));
  }, []);

  const setActiveMission = useCallback((missionText) => {
    setGameState(prev => ({
      ...prev,
      activeMission: missionText,
    }));
  }, []);

  const resetGameState = useCallback(() => {
    setGameState({
      missions: {
        blazeBreathingExercise: {
          discovered: false,
          completed: false,
        },
        blazeRockCollection: {
          discovered: false,
          accepted: false,
          completed: false,
          rocksFound: 0,
          totalRocks: 4,
        }
      },
      currentWorld: 'tutorial',
      seenDragon: false,
      tuliGlowing: false,
      activeMission: null,
    });
    localStorage.removeItem('tuliGameState');
  }, []);

  return (
    <GameStateContext.Provider value={{
      gameState,
      updateGameState,
      updateMission,
      completeMission,
      setActiveMission,
      resetGameState,
    }}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}

