// routes/buddyRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');    // Path to your User model
const Pokemon = require('../models/Pokemon'); // Path to your Pokemon model
const { authenticateToken } = require('../middleware/authenticate'); // Your authentication middleware

// Endpoint 1: Get current buddy info
// GET /buddy
router.get('/buddy', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;

        // Find the user and populate their buddy_pokemon details
        // .populate('buddy_pokemon') will fetch the actual Pokémon document
        // linked by buddy_pokemon ObjectId
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
                // Include any other relevant Pokémon fields you want to display
            },
            info: `Your buddy is ${user.buddy_pokemon.pokemon_name}!`
        });

    } catch (error) {
        console.error('Error fetching buddy info:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Endpoint 2: Assign a Pokémon as buddy
// POST /buddy/assign/:pokedex_entries
router.post('/buddy/assign/:pokedex_entries', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user._id;
        const pokedexEntries = parseInt(req.params.pokedex_entries); // Convert to number

        if (isNaN(pokedexEntries)) {
            return res.status(400).json({ error: 'Invalid Pokedex entry number provided.' });
        }

        // 1. Find the Pokémon by pokedex_entries
        // IMPORTANT: You might have multiple Pokémon with the same pokedex_entries
        // (e.g., two Pikachus). You might want to add another identifier here
        // like `pokemon_name` or a specific Pokémon _id if you want to be precise.
        // For simplicity, we'll find the first one that belongs to the user.
        const pokemonToAssign = await Pokemon.findOne({
            pokedex_entries: pokedexEntries,
            pokemon_owner: userId // Crucial: Ensure the Pokémon belongs to the user
        });

        if (!pokemonToAssign) {
            return res.status(404).json({
                error: `Pokémon with Pokedex entry ${pokedexEntries} not found or does not belong to you.`
            });
        }

        // 2. Find the user and assign the buddy
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Check if this Pokémon is already the buddy to avoid unnecessary updates
        if (user.buddy_pokemon && user.buddy_pokemon.toString() === pokemonToAssign._id.toString()) {
            return res.status(200).json({
                message: `${pokemonToAssign.pokemon_name} is already your buddy!`,
                buddy_pokemon: {
                    name: pokemonToAssign.pokemon_name,
                    pokedex_entries: pokemonToAssign.pokedex_entries,
                    // ... other details if needed for response
                }
            });
        }

        user.buddy_pokemon = pokemonToAssign._id; // Assign the Pokémon's _id
        await user.save();

        res.status(200).json({
            message: `Buddy: ${user.username}`,
            buddy_pokemon: {
                name: pokemonToAssign.pokemon_name,
                pokedex_entries: pokemonToAssign.pokedex_entries,
                level: pokemonToAssign.pokemon_level,
                exp: pokemonToAssign.pokemon_exp,
                types: pokemonToAssign.pokemon_types,
                sprite_url: pokemonToAssign.sprite_url,
            },
            info: `${pokemonToAssign.pokemon_name} has been assigned as your buddy!`
        });

    } catch (error) {
        console.error('Error assigning buddy:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;