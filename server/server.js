require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cors = require('cors');
const http = require('node:http');
const { createEventChatRealtime } = require('./services/eventChatRealtime');

const dashboardRoutes = require('./routes/dashboardRoutes');
const agencyRoutes = require('./routes/agencyRoutes');
const clientRoutes = require('./routes/clientRoutes');
const modelRoutes = require('./routes/modelRoutes');
const photographerRoutes = require('./routes/photographerRoutes');
const { router: authRoutes } = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { router: eventRoutes } = require('./routes/eventRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const matchingRoutes = require('./routes/matchingRoutes');
const eventChatRoutes = require('./routes/eventChatRoutes');

const app = express();
const httpServer = http.createServer(app);

// ✅ Middleware
// In development, accept credentialed requests from any port on the exact
// loopback hosts used by local frontend servers. Production remains limited to
// origins explicitly configured through CLIENT_ORIGIN or CLIENT_ORIGINS.
const configuredClientOrigins = new Set(
  [process.env.CLIENT_ORIGIN, process.env.CLIENT_ORIGINS]
    .filter(Boolean)
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean)
);

const isDevelopmentLoopbackOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  } catch (_error) {
    return false;
  }
};

const isAllowedCorsOrigin = (origin) => {
  if (!origin) return true;
  if (configuredClientOrigins.has(origin)) return true;
  return process.env.NODE_ENV !== 'production' && isDevelopmentLoopbackOrigin(origin);
};

// REST and Socket.IO share one listener and the same origin policy.
const eventChatRealtime = createEventChatRealtime(httpServer, { isAllowedOrigin: isAllowedCorsOrigin });
app.set('eventChatRealtime', eventChatRealtime);

app.use(cors({
  origin: (origin, callback) => callback(null, isAllowedCorsOrigin(origin)),
  credentials: true,
}));
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
app.use('/api/matching', matchingRoutes);
app.use('/api/event-chats', eventChatRoutes);


// ✅ Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
