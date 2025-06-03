const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authenticate'); 

router.get('/', async (req, res) => {
  try {
    const items = await Item.find({});
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/shop', authenticateToken, async (req, res) => {
  try {
    const items = await Item.find({}); 
    res.status(200).json({
      message: `Welcome to the PokéShop, ${req.user.username}!`,
      items: items,
    });
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/shop/:itemName', authenticateToken, async (req, res) => {
    const rawItemName = req.params.itemName;
    let searchName = rawItemName.toLowerCase();
    searchName = searchName.replace(/é/g, 'e'); 
    searchName = searchName.replace(/e/g, '(e|é)'); 

    try {
        const foundItem = await Item.findOne({
            name: { $regex: searchName, $options: 'i' } 
        });

        if (!foundItem) {
            return res.status(404).json({ message: `No item found matching "${rawItemName}".` });
        }
        res.status(200).json({
            message: `Result for "${rawItemName}":`,
            item: foundItem,
        });
    } catch (error) {
        console.error(`Error fetching item by name "${rawItemName}":`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.post('/shop/buy', authenticateToken, async (req, res) => {
  const userId = req.user.id || req.user._id;
  const { item_name, quantity } = req.body;

  if (!item_name || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Invalid item_name or quantity' });
  }

  try {
    
    const item = await Item.findOne({ name: item_name });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const totalPrice = item.price * quantity;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.pokeDollar < totalPrice) {
      return res.status(400).json({ error: 'Not enough pokeDollar' });
    }

    user.pokeDollar -= totalPrice;

    

    const existingItem = user.items.find(i => i.item_name === item.name);

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      user.items.push({
        name: item.name,
        type: item.type,
        effect: item.effect,
        price: item.price,
        quantity,
        rarity: item.rarity,
      });
    }

    await user.save();

  const formattedItems = user.items.map((i, idx) => ({
    name: item.name,
    type: item.type,
    effect: item.effect,
    price: item.price,
    quantity: item.quantity,
    rarity: item.rarity,
  }));

    res.json({
      message: `You bought ${quantity}x ${item.name}!`,
      pokeDollar: user.pokeDollar,
      items: formattedItems,
    });
  } catch (error) {
    console.error('Buy item error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
