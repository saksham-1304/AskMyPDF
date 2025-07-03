import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FileText, User, LogOut, Settings, Moon, Sun, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import GlassCard from './ui/GlassCard';
import AnimatedButton from './ui/AnimatedButton';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.header 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="sticky top-0 z-50 backdrop-blur-xl bg-white/10 dark:bg-black/10 border-b border-white/20 dark:border-white/10"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/dashboard" className="flex items-center space-x-3">
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-sm opacity-75"
                />
                <div className="relative bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-xl">
                  <FileText className="h-6 w-6 text-white" />
                </div>
              </div>
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                ChatPDF
              </span>
            </Link>
          </motion.div>
          
          {user ? (
            <div className="flex items-center space-x-4">
              {/* Desktop Navigation */}
              <nav className="hidden md:flex items-center space-x-2">
                <NavLink to="/dashboard" active={location.pathname === '/dashboard'}>
                  Dashboard
                </NavLink>
                <NavLink to="/profile" active={location.pathname === '/profile'}>
                  Profile
                </NavLink>
              </nav>
              
              {/* Theme Toggle */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 backdrop-blur-sm hover:bg-white/20 dark:hover:bg-white/10 transition-all duration-300"
              >
                <AnimatePresence mode="wait">
                  {isDark ? (
                    <motion.div
                      key="sun"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Sun className="h-5 w-5 text-yellow-500" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="moon"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Moon className="h-5 w-5 text-blue-600" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
              
              {/* User Menu */}
              <GlassCard className="px-4 py-2 hover:scale-105 transition-transform duration-300">
                <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <User className="h-4 w-4 text-white" />
                  </div>
                  <span className="hidden sm:block font-medium">{user.username}</span>
                </div>
              </GlassCard>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors duration-300"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </motion.button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 rounded-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10"
              >
                {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </motion.button>
              
              <Link to="/login">
                <AnimatedButton variant="ghost">Sign in</AnimatedButton>
              </Link>
              <Link to="/register">
                <AnimatedButton variant="gradient">Sign up</AnimatedButton>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && user && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden mt-4 overflow-hidden"
            >
              <GlassCard className="p-4 space-y-2">
                <MobileNavLink to="/dashboard" onClick={() => setIsMenuOpen(false)}>
                  Dashboard
                </MobileNavLink>
                <MobileNavLink to="/profile" onClick={() => setIsMenuOpen(false)}>
                  Profile
                </MobileNavLink>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  );
};

const NavLink: React.FC<{ to: string; active: boolean; children: React.ReactNode }> = ({ 
  to, 
  active, 
  children 
}) => (
  <Link to={to}>
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
        active
          ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30'
          : 'text-gray-600 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
      }`}
    >
      {children}
    </motion.div>
  </Link>
);

const MobileNavLink: React.FC<{ to: string; onClick: () => void; children: React.ReactNode }> = ({ 
  to, 
  onClick, 
  children 
}) => (
  <Link to={to} onClick={onClick}>
    <motion.div
      whileHover={{ x: 5 }}
      className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-white/10 dark:hover:bg-white/5 rounded-lg transition-all duration-300"
    >
      {children}
    </motion.div>
  </Link>
);

export default Header;