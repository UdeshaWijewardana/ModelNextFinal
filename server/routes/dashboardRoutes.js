const express = require('express');
const router = express.Router();

// Placeholder for dashboard routes
router.get('/', (req, res) => {
  res.json({ message: "Dashboard route is working!" });
});

module.exports = router;
