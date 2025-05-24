const express = require("express");
const router = express.Router();
const Joi = require("joi");
const axios = require("axios");
const { authenticateToken } = require("../middleware/authenticate");
const User = require("../models/User");
const Pokemon = require("../models/Pokemons");

router.get("/get-pokemon/:pokemon", authenticateToken, async (req, res) => {
  try {
    const getPokemonSchema = Joi.object({
      pokemon: Joi.alternatives().try(
        Joi.string().regex(/^[a-zA-Z\-]+$/),
        Joi.number().integer().min(1)
      ),
    });

    const { error } = getPokemonSchema.validate(req.params);
    if (error) {
      return res
        .status(400)
        .json({ message: "Pokemon name atau Pokedex entries harus diisi!" });
    }

    const search = req.params.pokemon.toLowerCase();
    const getPokemon = await axios.get(
      `https://pokeapi.co/api/v2/pokemon/${search}`
    );

    const pokemonTypes = getPokemon.data.types.map((t) => t.type.name);

    return res.status(200).json({
      pokemon_name: getPokemon.data.name,
      pokedex_entries: getPokemon.data.id,
      pokemon_types: pokemonTypes,
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

router.get("/get-pokemon/", authenticateToken, async (req, res) => {
  try {
    const findUser = await User.findOne({ _id: req.user.id });
    if (!findUser) {
      return res.status(404).json({ message: "User tidak ditemukan!" });
    }
    if (!findUser.pokemon) {
      return res
        .status(400)
        .json({ message: `${findUser.username} belum ada pokemon!` });
    }
    return res.status(200).json(findUser.pokemon);
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

router.post("/catch/:pokemon", authenticateToken, async (req, res) => {
  try {
    const catchSchema = Joi.object({
      pokemon: Joi.alternatives().try(
        Joi.string().regex(/^[a-zA-Z\-]+$/),
        Joi.number().integer().min(1)
      ),
    });
    const { error } = catchSchema.validate(req.params);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const response = await axios.get(
      `https://pokeapi.co/api/v2/pokemon-species/${req.params.pokemon}`
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

    if (!findUser) {
      return res.status(404).json({ message: "User tidak ditemukan!" });
    }

    if (findUser.pokeDollar < cost) {
      return res
        .status(400)
        .json({
          message: `PokeDollars tidak cukup!, pokedollars anda: ${findUser.pokeDollar}`,
        });
    }

    const countPokemon = await Pokemon.countDocuments({
      pokemon_owner: findUser._id,
    });
    console.log(countPokemon);

    if (Number(countPokemon) + 1 > findUser.pokemon_storage) {
      return res.status(400).json({
        message: "Penyimpanan Pokemon anda sudah penuh!",
      });
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
      pokemonLevel = Math.floor(Math.random() * 15) + 1;
    }

    var newPokemon = {
      pokemon_name: pokemonName,
      pokedex_entries: response.data.id,
      pokemon_level: pokemonLevel,
      pokemon_exp: 1,
      pokemon_owner: findUser._id,
      caught_at: new Date(),
      trade_history: [],
    };

    await Pokemon.create(newPokemon);
    await findUser.save();

    return res.status(200).json({
      message: `${pokemonName} berhasil ditangkap!`,
      pokemon_level: pokemonLevel,
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
