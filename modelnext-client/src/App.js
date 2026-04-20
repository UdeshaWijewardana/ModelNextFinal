import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Login from './pages/Login';
import Home from './pages/Home';
import About from './pages/About'; // ✅ ADDED
import EventCreate from './pages/EventCreate'; // ✅ ADDED

import ModelDashboard from './pages/ModelDashboard';
import ClientDashboard from './pages/ClientDashboard';
import ProfileDetails from './pages/ProfileDetails';
import RoleSelection from './pages/RoleSelection';
import AgencyDashboard from './pages/AgencyDashboard';
import PhotographerDashboard from './pages/PhotographerDashboard';

// ✅ FORMS
import ModelForm from "./forms/ModelForm";
import PhotographerForm from "./forms/PhotographerForm";
import AgencyForm from "./forms/AgencyForm";
import ClientForm from "./forms/ClientForm";

import './App.css';

function App() {
  return (
    <Router>
      <Routes>

        {/* CORE */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/role" element={<RoleSelection />} />
        <Route path="/about" element={<About />} /> {/* ✅ ADDED */}
        <Route path="/event/create" element={<EventCreate />} /> {/* ✅ ADDED */}

        {/* REGISTER PAGES */}
        <Route path="/register/model" element={<ModelForm />} />
        <Route path="/register/photographer" element={<PhotographerForm />} />
        <Route path="/register/agency" element={<AgencyForm />} />
        <Route path="/register/client" element={<ClientForm />} />

        {/* DASHBOARDS */}
        <Route path="/dashboard" element={<ModelDashboard />} />
        <Route path="/client-portal" element={<ClientDashboard />} />
        <Route path="/agency-dashboard" element={<AgencyDashboard />} />
        <Route path="/photographer-dashboard" element={<PhotographerDashboard />} />

        {/* PROFILE */}
        <Route path="/profile" element={<ProfileDetails />} />

      </Routes>
    </Router>
  );
}

export default App;