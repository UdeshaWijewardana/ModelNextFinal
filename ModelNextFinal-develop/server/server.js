require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const dashboardRoutes = require('./routes/dashboardRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const clientRoutes = require('./routes/clientRoutes');
const modelRoutes = require('./routes/modelRoutes');
const photographerRoutes = require('./routes/photographerRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const dataFilePath = path.join(__dirname, 'data', 'models.json');

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Static folder (for uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Local fallback storage for registrations when MongoDB is unavailable
const readLocalModels = () => {
  try {
    if (!fs.existsSync(dataFilePath)) return [];
    const raw = fs.readFileSync(dataFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('⚠️ Local data read failed:', error.message);
    return [];
  }
};

const writeLocalModels = (models) => {
  fs.writeFileSync(dataFilePath, JSON.stringify(models, null, 2));
};

app.locals.readLocalModels = readLocalModels;
app.locals.writeLocalModels = writeLocalModels;

// ✅ MongoDB Connection with fallback
const connectDatabase = async () => {
  if (!process.env.MONGO_URI) {
    console.warn('⚠️ No MONGO_URI configured. Using local fallback storage.');
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 5000
    });
    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Error:', err.message);
    console.warn('⚠️ Continuing with local fallback storage.');
  }
};

connectDatabase();

// ✅ Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/agencies', agencyRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/photographers', photographerRoutes);
app.use('/api/auth', authRoutes);

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));