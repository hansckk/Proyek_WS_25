const express = require('express');
const router = express.Router();
const Item = require('../models/Item');

router.get('/', async (req, res) => {
  try {
    const items = await Item.find({});
    res.json(items);
  } catch (error) {
    console.error('❌ Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
