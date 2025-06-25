const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");
const Pokemons = require("../models/Pokemons");
const { authenticateToken } = require("../middleware/authenticate");

router.get("/", authenticateToken, async (req, res) => {
  try {
    const usersWithBuddies = await User.find({
      buddy_pokemon: { $exists: true, $ne: null },
    }).populate("buddy_pokemon");

    if (usersWithBuddies.length === 0) {
      return res
        .status(200)
        .json({ message: "No users with buddy Pokémon found." });
    }

    const result = usersWithBuddies.map((user) => ({
      username: user.username,
      buddy_pokemon: user.buddy_pokemon
        ? {
            name: user.buddy_pokemon.pokemon_name,
            pokedex_entries: user.buddy_pokemon.pokedex_entries,
            level: user.buddy_pokemon.pokemon_level,
            exp: user.buddy_pokemon.pokemon_exp,
            types: user.buddy_pokemon.pokemon_types,
            sprite_url: user.buddy_pokemon.sprite_url,
          }
        : null,
    }));

    res.status(200).json({
      message: `Found ${result.length} users with buddy Pokémon.`,
      users: result,
    });
  } catch (error) {
    console.error("Error fetching users with buddies:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

router.post("/assign/:pokedex_entries", authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const objectUserId = new mongoose.Types.ObjectId(userId);
    const pokedexEntry = req.params.pokedex_entries;

    console.log(
      `Looking for YOUR Pokemon with pokedex_entries=${pokedexEntry}`
    );

    // find by pokedex_entries and owned by user
    const pokemonToAssign = await Pokemons.findOne({
      pokedex_entries: pokedexEntry,
      pokemon_owner: objectUserId,
    });

    if (!pokemonToAssign) {
      console.log("You do not own this Pokemon or it doesn't exist.");
      return res
        .status(403)
        .json({
          error: `You do not own a Pokemon with Pokedex entry ${pokedexEntry}.`,
        });
    }

    const user = await User.findById(objectUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    //buddy check
    if (
      user.buddy_pokemon &&
      user.buddy_pokemon.toString() === pokemonToAssign._id.toString()
    ) {
      return res.status(200).json({
        message: `${pokemonToAssign.pokemon_name} is already your buddy.`,
      });
    }

    // assign buddy
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
    console.error("🔥 ERROR:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
  
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const { pokedex_entries } = req.body;
    
    if (userId !== req.user.id && userId !== req.user._id.toString()) {
      return res.status(403).json({ message: "You're not allowed to update someone else's buddy." });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.buddy_pokemon) {
      await Pokemons.findByIdAndUpdate(user.buddy_pokemon, {
        $unset: { assigned_buddy: "" },
      });
    }

    const newBuddy = await Pokemons.findOne({
      pokedex_entries: pokedex_entries,
      pokemon_owner: userId,
    });

    if (!newBuddy) {
      return res.status(404).json({ message: `No owned Pokemon with Pokedex entry ${pokedex_entries}.` });
    }

    user.buddy_pokemon = newBuddy._id;
    newBuddy.assigned_buddy = user._id;

    await user.save();
    await newBuddy.save();

    res.status(200).json({
      message: `${newBuddy.pokemon_name} is now your new buddy!`,
      buddy_pokemon: {
        name: newBuddy.pokemon_name,
        pokedex_entries: newBuddy.pokedex_entries,
        level: newBuddy.pokemon_level,
        exp: newBuddy.pokemon_exp,
        types: newBuddy.pokemon_types,
        sprite_url: newBuddy.sprite_url,
      },
    });
  } catch (error) {
    if (error.name === 'CastError' && error.path === '_id') {
      return res.status(404).json({ message: 'User not found.' });
    }

    console.error("Update Error:", error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});



router.delete('/remove/:pokedex_entries', async (req, res) => {
  try {
    const { pokedex_entries } = req.params;

    // Find the Pokémon and populate the assigned user's username
    const pokemon = await Pokemons.findOne({ pokedex_entries }).populate("assigned_buddy", "username");

    if (!pokemon || !pokemon.assigned_buddy) {
      return res.status(404).json({ error: "Buddy not found or not assigned." });
    }

    const userId = pokemon.assigned_buddy._id;
    const username = pokemon.assigned_buddy.username;

    // Unassign buddy on both ends
    await User.findByIdAndUpdate(userId, { $unset: { buddy_pokemon: "" } });
    await Pokemons.findByIdAndUpdate(pokemon._id, { $unset: { assigned_buddy: "" } });

    res.status(200).json({
      message: `${pokemon.pokemon_name} has been unassigned as a buddy from user ${username}.`,
    });
  } catch (error) {
    console.error("Error removing buddy:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});



module.exports = router;
