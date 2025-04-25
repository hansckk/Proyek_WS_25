const express = require("express");
const router = express.Router();
const Joi = require("joi");
const axios = require("axios");
const { authenticateToken } = require("../middleware/authenticate");

router.get("/get-pokemon", authenticateToken, async (req, res) => {
  try {
    const getPokemonSchema = Joi.object({
      pokemon_name: Joi.string(),
      pokedex_entries: Joi.number().integer(),
    }).or("pokemon_name", "pokedex_entries");

    const { error } = getPokemonSchema.validate(req.query);
    if (error) {
      return res
        .status(400)
        .json({ message: "Pokemon name atau Pokedex entries harus diisi!" });
    }

    const { pokemon_name, pokedex_entries } = req.query;
    var search;
    if (pokemon_name) {
      search = pokemon_name;
    } else {
      search = pokedex_entries;
    }
    const getPokemon = await axios.get(
      `https://pokeapi.co/api/v2/pokemon/${search}`
    );

    const pokemonTypes = getPokemon.data.types;
    var types = [];
    for (let i = 0; i < pokemonTypes.length; i++) {
      types.push(pokemonTypes[i].type.name);
    }

    return res.status(200).json({
      pokemon_name: getPokemon.data.name,
      pokedex_entries: getPokemon.data.id,
      pokemon_types: types,
      pokemon_height: `${getPokemon.data.height} meters`,
      pokemon_weight: `${getPokemon.data.weight} kg`,
    });
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ message: "Pokemon tidak ditemukan!" });
    } else {
      return res.status(500).json(error.message);
    }
  }
});

module.exports = router;
