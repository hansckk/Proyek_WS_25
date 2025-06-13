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
      `🔍 DEBUG: Looking for YOUR Pokémon with pokedex_entries=${pokedexEntry}`
    );

    // Find Pokemon by pokedex_entries AND owned by user
    const pokemonToAssign = await Pokemons.findOne({
      pokedex_entries: pokedexEntry,
      pokemon_owner: objectUserId,
    });

    if (!pokemonToAssign) {
      console.log("⛔ DEBUG: You do not own this Pokémon or it doesn't exist.");
      return res
        .status(403)
        .json({
          error: `You do not own a Pokémon with Pokedex entry ${pokedexEntry}.`,
        });
    }

    const user = await User.findById(objectUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Already buddy check
    if (
      user.buddy_pokemon &&
      user.buddy_pokemon.toString() === pokemonToAssign._id.toString()
    ) {
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
    console.error("🔥 ERROR:", error);
    return res.status(500).json({ error: "Internal server error." });
  }
});

module.exports = router;
