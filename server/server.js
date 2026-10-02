require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');

const dashboardRoutes = require('./routes/dashboardRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const clientRoutes = require('./routes/clientRoutes');
const modelRoutes = require('./routes/modelRoutes');
const photographerRoutes = require('./routes/photographerRoutes');
const { router: authRoutes } = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { router: eventRoutes } = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

// ✅ Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Static folder (for uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ MongoDB is required for persistent application operations.
const connectDatabase = async () => {
  if (!process.env.MONGO_URI) {
    console.warn('⚠️ No MONGO_URI configured. Persistent operations are unavailable.');
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
    console.warn('⚠️ Persistent operations are unavailable until MongoDB connects.');
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
app.use('/api/admin', adminRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
