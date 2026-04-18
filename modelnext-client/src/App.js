import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Login from './pages/Login';
import Home from './pages/Home';
import ModelDashboard from './pages/ModelDashboard';
import ClientDashboard from './pages/ClientDashboard';
import ProfileDetails from './pages/ProfileDetails';

// ✅ ADD THESE
import RoleSelection from './pages/RoleSelection';
import Register from './pages/Register';

import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* CORE */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        {/* ⭐ YOUR PART */}
        <Route path="/role" element={<RoleSelection />} />
        <Route path="/register" element={<Register />} />

        {/* EXISTING */}
        <Route path="/dashboard" element={<ModelDashboard />} />
        <Route path="/client-portal" element={<ClientDashboard />} />
        <Route path="/profile" element={<ProfileDetails />} />
      </Routes>
    </Router>
  );
}

export default App;