const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const User = require('../models/User');    
const Pokemons = require('../models/Pokemons'); 
const { authenticateToken } = require('../middleware/authenticate'); 


router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;

        
        const user = await User.findById(userId).populate('buddy_pokemon');

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        if (!user.buddy_pokemon) {
            return res.status(200).json({
                message: `Buddy: ${user.username}`,
                buddy_pokemon: null,
                info: 'You currently have no buddy Pokémon assigned.'
            });
        }

        res.status(200).json({
            message: `Buddy: ${user.username}`,
            buddy_pokemon: {
                name: user.buddy_pokemon.pokemon_name,
                pokedex_entries: user.buddy_pokemon.pokedex_entries,
                level: user.buddy_pokemon.pokemon_level,
                exp: user.buddy_pokemon.pokemon_exp,
                types: user.buddy_pokemon.pokemon_types,
                sprite_url: user.buddy_pokemon.sprite_url,
              
            },
            info: `Your buddy is ${user.buddy_pokemon.pokemon_name}!`
        });

    } catch (error) {
        console.error('Error fetching buddy info:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

router.post('/assign/:pokedex_entries', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const objectUserId = new mongoose.Types.ObjectId(userId);
    const pokedexEntry = req.params.pokedex_entries;

    console.log(`🔍 DEBUG: Looking for Pokémon with pokedex_entries=${pokedexEntry} (owner check SKIPPED)`);

    // Find Pokémon ONLY by pokedex_entries — NO owner check
    const pokemonToAssign = await Pokemons.findOne({ pokedex_entries: pokedexEntry });

    if (!pokemonToAssign) {
      console.log("⚠️ DEBUG: Pokémon with that entry not found at all");
      return res.status(404).json({ error: `Pokémon with Pokedex entry ${pokedexEntry} not found.` });
    }

    const user = await User.findById(objectUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Already buddy check
    if (user.buddy_pokemon && user.buddy_pokemon.toString() === pokemonToAssign._id.toString()) {
      return res.status(200).json({
        message: `${pokemonToAssign.pokemon_name} is already your buddy.`,
      });
    }

    // Assign buddy both ways
    user.buddy_pokemon = pokemonToAssign._id;
    pokemonToAssign.assigned_buddy = user._id;

    await user.save();
    await pokemonToAssign.save();

    return res.status(200).json({
      message: `${pokemonToAssign.pokemon_name} is now your buddy!`,
      buddy_pokemon: {
        name: pokemonToAssign.pokemon_name,
        pokedex_entries: pokemonToAssign.pokedex_entries,
        level: pokemonToAssign.pokemon_level,
        exp: pokemonToAssign.pokemon_exp,
        types: pokemonToAssign.pokemon_types,
        sprite_url: pokemonToAssign.sprite_url,
      },
    });
  } catch (error) {
    console.error('🔥 ERROR:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});


module.exports = router;