import React, { useState } from 'react';
import { Mail, Lock, User as UserIcon, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { storageService } from '../services/storage';
import type { User } from '../services/storage';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (isRegister && !name) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);

    // Add a tiny artificial delay to simulate network latency for better UX feel
    setTimeout(async () => {
      try {
        if (isRegister) {
          const user = await storageService.registerUser(email, password, name);
          onAuthSuccess(user);
        } else {
          const user = await storageService.loginUser(email, password);
          onAuthSuccess(user);
        }
      } catch (err: any) {
        setError(err.message || 'Authentication failed. Please check your inputs.');
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    setError(null);
    setEmail('');
    setPassword('');
    setName('');
  };

  return (
    <div className="auth-viewport">
      {/* Background visual decoration elements */}
      <div className="auth-bg-glow glow-1"></div>
      <div className="auth-bg-glow glow-2"></div>
      
      <div className="auth-card-container glass-plate">
        <div className="auth-brand">
          <div className="brand-logo">
            <Sparkles size={24} className="logo-icon" />
          </div>
          <h2>ArchCanvas</h2>
          <p className="brand-subtitle">Interactive Codebase Map Maker</p>
        </div>

        <h3 className="auth-title">
          {isRegister ? 'Create Your Account' : 'Welcome Back'}
        </h3>
        <p className="auth-desc">
          {isRegister 
            ? 'Sign up to map architectures and manage multiple code projects.' 
            : 'Sign in to access your saved codebase architecture maps.'}
        </p>

        {error && (
          <div className="auth-error-banner">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="input-group-field">
              <label htmlFor="name-input">Full Name</label>
              <div className="input-with-icon">
                <UserIcon size={16} className="field-icon" />
                <input
                  id="name-input"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <div className="input-group-field">
            <label htmlFor="email-input">Email Address</label>
            <div className="input-with-icon">
              <Mail size={16} className="field-icon" />
              <input
                id="email-input"
                type="email"
                placeholder="developer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-group-field">
            <label htmlFor="password-input">Password</label>
            <div className="input-with-icon">
              <Lock size={16} className="field-icon" />
              <input
                id="password-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="auth-submit-btn" 
            disabled={loading}
          >
            {loading ? (
              <span className="spinner-loader"></span>
            ) : (
              <>
                <span>{isRegister ? 'Register Account' : 'Sign In'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer-toggle">
          <span>
            {isRegister ? 'Already have an account?' : "Don't have an account yet?"}
          </span>
          <button 
            type="button" 
            className="toggle-link-btn" 
            onClick={toggleMode}
            disabled={loading}
          >
            {isRegister ? 'Sign In' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
