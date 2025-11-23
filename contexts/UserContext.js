'use client';

import React, { createContext, useContext, useState } from 'react';
import { getTranslations } from '../lib/localization';
import { DEV_CONFIG } from '../lib/config';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [firstName, setFirstName] = useState(DEV_CONFIG.skipIntro ? DEV_CONFIG.testUser.firstName : '');
  const [lastName, setLastName] = useState(DEV_CONFIG.skipIntro ? DEV_CONFIG.testUser.lastName : '');
  const [language, setLanguage] = useState(DEV_CONFIG.skipIntro ? DEV_CONFIG.testUser.language : 'en');
  const [hasCompletedWelcome, setHasCompletedWelcome] = useState(DEV_CONFIG.skipIntro);
  const [translations, setTranslations] = useState(getTranslations(DEV_CONFIG.skipIntro ? DEV_CONFIG.testUser.language : 'en'));

  const updateUserName = (first, last) => {
    setFirstName(first);
    setLastName(last);
  };

  const updateLanguage = (lang) => {
    setLanguage(lang);
    setTranslations(getTranslations(lang));
  };

  const completeWelcome = () => {
    setHasCompletedWelcome(true);
  };

  const resetWelcome = () => {
    setHasCompletedWelcome(false);
  };

  const getFullName = () => {
    return `${firstName} ${lastName}`.trim();
  };

  return (
    <UserContext.Provider
      value={{
        firstName,
        lastName,
        getFullName,
        language,
        translations,
        hasCompletedWelcome,
        updateUserName,
        updateLanguage,
        completeWelcome,
        resetWelcome
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

