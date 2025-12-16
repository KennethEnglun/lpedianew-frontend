import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, User } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 檢查本地儲存的認證狀態
  useEffect(() => {
    const initAuth = () => {
      try {
        if (authService.isAuthenticated()) {
          const storedUser = authService.getUser();
          setUser(storedUser);
        }
      } catch (error) {
        console.error('初始化認證狀態失敗:', error);
        authService.logout();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const userData = await authService.login({ username, password });
      setUser(userData);
    } catch (error) {
      console.error('登入失敗:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    authService.logout();
  };

  const refreshUser = () => {
    const storedUser = authService.getUser();
    setUser(storedUser);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user && authService.isAuthenticated(),
    login,
    logout,
    refreshUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth必須在AuthProvider內使用');
  }
  return context;
};
