require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const dashboardRoutes = require('./routes/dashboardRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const clientRoutes = require('./routes/clientRoutes');
const modelRoutes = require('./routes/modelRoutes');
const photographerRoutes = require('./routes/photographerRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

// Middleware
app.use(cors()); 
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Error:", err));

// Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/agencies', agencyRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/photographers', photographerRoutes);
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));