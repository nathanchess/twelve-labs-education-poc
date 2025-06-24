'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [userRole, setUserRole] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userRole') || null;
    }
    return null;
  });
  const [userName, setUserName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('userName') || '';
    }
    return '';
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('isLoggedIn') === 'true';
    }
    return false;
  });

  // Save to localStorage whenever user data changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('userRole', userRole || '');
      localStorage.setItem('userName', userName || '');
      localStorage.setItem('isLoggedIn', isLoggedIn.toString());
    }
  }, [userRole, userName, isLoggedIn]);

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
    // Clear localStorage on logout
    if (typeof window !== 'undefined') {
      localStorage.removeItem('userRole');
      localStorage.removeItem('userName');
      localStorage.removeItem('isLoggedIn');
    }
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