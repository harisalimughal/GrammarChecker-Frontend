import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import GrammarChecker from './components/GrammarChecker';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Public Route Component (redirect if already authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return !isAuthenticated ? children : <Navigate to="/grammar-check" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } 
            />
            <Route 
              path="/grammar-check" 
              element={
                <ProtectedRoute>
                  <GrammarChecker />
                </ProtectedRoute>
              } 
            />
            <Route path="/" element={<Navigate to="/grammar-check" />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;