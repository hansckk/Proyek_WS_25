const express = require("express");
const router = express.Router();
const Joi = require("joi");
const axios = require("axios");
const { authenticateToken } = require("../middleware/authenticate");
const User = require("../models/User");

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

router.get("/get-my-pokemon/", authenticateToken, async (req, res) => {
  try {
    const findUser = await User.findOne({ _id: req.user.id });
    if (!findUser) {
      return res.status(404).json({ message: "User tidak ditemukan!" });
    }
    if (!findUser.pokemon) {
      return res
        .status(200)
        .json({ message: `${findUser.username} belum ada pokemon!` });
    }
    return res.status(200).json(findUser.pokemon);
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

router.post("/catch/:pokemon_name", authenticateToken, async (req, res) => {
  try {
    const catchSchema = Joi.object({
      pokemon_name: Joi.string().required(),
    });
    const { error } = catchSchema.validate(req.params);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const response = await axios.get(
      `https://pokeapi.co/api/v2/pokemon-species/${req.params.pokemon_name}`
    );
    const name = response.data.name;
    const pokemonName = name.charAt(0).toUpperCase() + name.slice(1);
    const catchRate = response.data.capture_rate;

    var cost;
    if (catchRate >= 3 && catchRate < 75) {
      cost = 3000;
    } else if (catchRate >= 75 && catchRate < 150) {
      cost = 2000;
    } else {
      cost = 1000;
    }
    const findUser = await User.findOne({ _id: req.user.id });
    if (findUser.pokeDollar < cost) {
      return res.status(400).json({ message: "PokeDollars tidak cukup!" });
    }
    findUser.pokeDollar = Number(findUser.pokeDollar) - Number(cost);
    const catchProbability = catchRate / 255;
    if (Math.random() > catchProbability) {
      await findUser.save();
      return res.status(200).json({
        harga: `${cost} PokeDollar`,
        message: `${pokemonName} berhasil kabur!`,
        pokeDollar: `PokeDollar anda sekarang: ${findUser.pokeDollar}`,
      });
    }
    var pokemonLevel = 1;
    if (cost === 3000) {
      pokemonLevel = Math.floor(Math.random() * (100 - 50 + 1)) + 50;
    } else if (cost === 2000) {
      pokemonLevel = Math.floor(Math.random() * (30 - 15 + 1)) + 15;
    } else {
      pokemonLevel = Math.floor(Math.random() * 15);
    }

    const newPokemon = {
      pokemon_name: pokemonName,
      pokedex_entries: response.data.id,
      pokemon_level: pokemonLevel,
    };

    if (!findUser.pokemon) {
      findUser.pokemon = [];
    }

    findUser.pokemon.push(newPokemon);
    if (findUser.pokemon.length > findUser.role.pokemon_storage) {
      return res.status(400).json({
        message: `Penyimpanan Pokemon anda sudah penuh!`,
      });
    }

    await findUser.save();
    return res.status(200).json({
      harga: `${cost} PokeDollar`,
      message: `${pokemonName} berhasil ditangkap!`,
      pokeDollar: `PokeDollar anda sekarang: ${findUser.pokeDollar}`,
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
