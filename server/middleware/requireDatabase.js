const mongoose = require('mongoose');

const databaseUnavailable = (res) => res.status(503).json({
  error: 'Database service is currently unavailable. Please try again later.'
});

const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState !== 1) return databaseUnavailable(res);
  next();
};

module.exports = { requireDatabase, databaseUnavailable };
