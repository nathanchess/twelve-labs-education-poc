'use client';

import { createContext, useContext, useState } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loginAsInstructor = (name) => {
    setUserRole('instructor');
    setUserName(name);
    setIsLoggedIn(true);
  };

  const loginAsStudent = (name) => {
    setUserRole('student');
    setUserName(name);
    setIsLoggedIn(true);
  };

  const logout = () => {
    setUserRole(null);
    setUserName('');
    setIsLoggedIn(false);
  };

  const value = {
    userRole,
    userName,
    isLoggedIn,
    loginAsInstructor,
    loginAsStudent,
    logout
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
} 