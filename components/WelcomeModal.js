'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { useGameState } from '../contexts/GameStateContext';
import { SUPPORTED_LANGUAGES } from '../lib/localization';

export default function WelcomeModal() {
  const { updateUserName, updateLanguage, completeWelcome, language, translations } = useUser();
  const { resetGameState } = useGameState();
  const [firstName, setFirstName] = useState('ilia');
  const [lastName, setLastName] = useState('demertchian');
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [hasSavedGame, setHasSavedGame] = useState(false);

  // Check for saved game state on mount
  useEffect(() => {
    const savedState = localStorage.getItem('tuliGameState');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Check if there's any meaningful progress (dragon seen or mission discovered/completed)
        const hasProgress = parsed.seenDragon || 
                           parsed.missions?.blazeBreathingExercise?.discovered || 
                           parsed.missions?.blazeBreathingExercise?.completed;
        setHasSavedGame(hasProgress);
      } catch (e) {
        setHasSavedGame(false);
      }
    }
  }, []);

  const handleLanguageChange = (langCode) => {
    setSelectedLanguage(langCode);
    updateLanguage(langCode);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (firstName.trim() && lastName.trim()) {
      updateUserName(firstName.trim(), lastName.trim());
      completeWelcome();
    }
  };

  const handleStartNew = (e) => {
    e.preventDefault();
    if (firstName.trim() && lastName.trim()) {
      resetGameState(); // Clear saved game state
      updateUserName(firstName.trim(), lastName.trim());
      completeWelcome();
    }
  };

  const t = translations.welcome;
  const langLabels = translations.languages;

  return (
    <motion.div 
      className="fixed inset-0 bg-black/70 flex justify-center items-center z-9999"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-linear-to-br from-[#4a9a9b] to-[#3B7C7D] rounded-3xl p-6 sm:p-12 shadow-2xl max-w-lg w-[90%] max-h-[90vh] overflow-y-auto"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="text-white">
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-4 sm:mb-8 text-center drop-shadow-lg">
            {t.title}
          </h1>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="firstName" className="text-base sm:text-lg font-semibold drop-shadow-sm">
                {t.firstNameLabel}
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t.firstNamePlaceholder}
                className="px-4 sm:px-5 py-2.5 sm:py-3.5 text-base sm:text-lg border-none rounded-xl bg-white text-gray-800 shadow-md transition-all duration-300 focus:outline-none focus:shadow-lg focus:-translate-y-0.5 placeholder:text-gray-400"
                autoFocus
                required
                minLength={1}
                maxLength={20}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="lastName" className="text-base sm:text-lg font-semibold drop-shadow-sm">
                {t.lastNameLabel}
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t.lastNamePlaceholder}
                className="px-4 sm:px-5 py-2.5 sm:py-3.5 text-base sm:text-lg border-none rounded-xl bg-white text-gray-800 shadow-md transition-all duration-300 focus:outline-none focus:shadow-lg focus:-translate-y-0.5 placeholder:text-gray-400"
                required
                minLength={1}
                maxLength={20}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="language" className="text-base sm:text-lg font-semibold drop-shadow-sm">
                {t.languageLabel}
              </label>
              <select
                id="language"
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="px-4 sm:px-5 py-2.5 sm:py-3.5 text-base sm:text-lg border-none rounded-xl bg-white text-gray-800 shadow-md transition-all duration-300 focus:outline-none focus:shadow-lg focus:-translate-y-0.5 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {langLabels[lang.code]}
                  </option>
                ))}
              </select>
            </div>

            {hasSavedGame ? (
              <div className="flex gap-2 sm:gap-3 mt-2 sm:mt-3">
                <button 
                  type="submit" 
                  className="flex-1 px-4 sm:px-8 py-3 sm:py-4 text-base sm:text-xl font-bold border-none rounded-xl bg-linear-to-br from-[#a8ddc0] to-[#9CD3B2] text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:-translate-y-0.5 cursor-pointer"
                >
                  {t.continueButton}
                </button>
                <button 
                  type="button"
                  onClick={handleStartNew}
                  className="flex-1 px-4 sm:px-8 py-3 sm:py-4 text-base sm:text-xl font-bold border-none rounded-xl bg-linear-to-br from-[#f59e0b] to-[#d97706] text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:-translate-y-0.5 cursor-pointer"
                >
                  {t.startNewButton}
                </button>
              </div>
            ) : (
              <button 
                type="submit" 
                className="mt-2 sm:mt-3 px-4 sm:px-8 py-3 sm:py-4 text-base sm:text-xl font-bold border-none rounded-xl bg-linear-to-br from-[#a8ddc0] to-[#9CD3B2] text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:-translate-y-0.5 cursor-pointer"
              >
                {t.startButton}
              </button>
            )}
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

