import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, User, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

// Set API base URL, fallback to localhost if not set
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Login = () => {
  // State for form data (username and password)
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  // State to toggle password visibility
  const [showPassword, setShowPassword] = useState(false);
  // State to show loading spinner during login
  const [isLoading, setIsLoading] = useState(false);
  // State to display error messages
  const [error, setError] = useState('');
  // Get login function from AuthContext
  const { login } = useAuth();

  // Handle input changes and clear error on typing
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  // Handle form submission for login
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate that both fields are filled
    if (!formData.username.trim() || !formData.password) {
      setError('Please enter both username and password');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Send login request to backend
      const response = await axios.post(`${API_BASE_URL}/login`, formData);
      
      // If login is successful, update auth context
      if (response.data.token && response.data.user) {
        login(response.data.user, response.data.token);
      } else {
        setError('Invalid response from server');
      }
    } catch (err) {
      // Handle errors from server or network
      console.error('Login error:', err);
      setError(
        err.response?.data?.error || 
        'Network error. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Render login form UI
  return (
    <div className="login-container">
      {/* Animated background orbs for visual effect */}
      <div className="login-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <CheckCircle size={40} className="text-primary" />
          </div>
          <h1>Grammar Checker</h1>
          <p>Sign in to start checking your grammar</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {/* Username input field */}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <User size={20} className="input-icon" />
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                disabled={isLoading}
                autoComplete="username"
              />
            </div>
          </div>

          {/* Password input field with show/hide toggle */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock size={20} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Display error message if present */}
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit button with loading spinner */}
          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="spinner"></div>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Placeholder for demo section or additional info */}
        <div className="demo-section">
         
        </div>
      </div>
    </div>
  );
};

// Export the Login component
export default Login;