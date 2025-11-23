'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { SUPPORTED_LANGUAGES } from '../lib/localization';

export default function WelcomeModal() {
  const { updateUserName, updateLanguage, completeWelcome, language, translations } = useUser();
  const [firstName, setFirstName] = useState('ilia');
  const [lastName, setLastName] = useState('demertchian');
  const [selectedLanguage, setSelectedLanguage] = useState(language);

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
        className="bg-linear-to-br from-purple-500 to-purple-700 rounded-3xl p-12 shadow-2xl max-w-lg w-[90%]"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="text-white">
          <h1 className="text-5xl font-extrabold mb-8 text-center drop-shadow-lg">
            {t.title}
          </h1>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <label htmlFor="firstName" className="text-lg font-semibold drop-shadow-sm">
                {t.firstNameLabel}
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t.firstNamePlaceholder}
                className="px-5 py-3.5 text-lg border-none rounded-xl bg-white text-gray-800 shadow-md transition-all duration-300 focus:outline-none focus:shadow-lg focus:-translate-y-0.5 placeholder:text-gray-400"
                autoFocus
                required
                minLength={1}
                maxLength={20}
              />
            </div>

            <div className="flex flex-col gap-3">
              <label htmlFor="lastName" className="text-lg font-semibold drop-shadow-sm">
                {t.lastNameLabel}
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t.lastNamePlaceholder}
                className="px-5 py-3.5 text-lg border-none rounded-xl bg-white text-gray-800 shadow-md transition-all duration-300 focus:outline-none focus:shadow-lg focus:-translate-y-0.5 placeholder:text-gray-400"
                required
                minLength={1}
                maxLength={20}
              />
            </div>

            <div className="flex flex-col gap-3">
              <label htmlFor="language" className="text-lg font-semibold drop-shadow-sm">
                {t.languageLabel}
              </label>
              <select
                id="language"
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="px-5 py-3.5 text-lg border-none rounded-xl bg-white text-gray-800 shadow-md transition-all duration-300 focus:outline-none focus:shadow-lg focus:-translate-y-0.5 cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {langLabels[lang.code]}
                  </option>
                ))}
              </select>
            </div>

            <button 
              type="submit" 
              className="mt-3 px-8 py-4 text-xl font-bold border-none rounded-xl bg-linear-to-br from-pink-400 to-red-400 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl active:-translate-y-0.5 cursor-pointer"
            >
              {t.startButton}
            </button>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}

