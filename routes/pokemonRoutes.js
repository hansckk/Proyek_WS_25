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
    const findUser = await User.findOne({ _id: req.user.id, deletedAt: null });
    if (!findUser) {
      return res.status(404).json({ message: "User tidak ditemukan!" });
    }

    const findPokemon = await Pokemon.find({
      pokemon_owner: findUser._id,
    }).populate({
      path: "trade_history",
      populate: [
        {
          path: "from_user",
          select: "username",
        },
        {
          path: "to_user",
          select: "username",
        },
      ],
    });

    if (findPokemon.length === 0) {
      return res
        .status(200)
        .json({ message: `${findUser.username} belum ada pokemon!` });
    }

    const pokemonUser = findPokemon.map((pokemon) => {
      const tradeHistory = pokemon.trade_history.map((historyEntry) => {
        return {
          trade_id: historyEntry.trade_id,
          from_user: historyEntry.from_user
            ? {
                id: historyEntry.from_user._id,
                username: historyEntry.from_user.username,
              }
            : null,
          to_user: historyEntry.to_user
            ? {
                id: historyEntry.to_user._id,
                username: historyEntry.to_user.username,
              }
            : null,
          traded_at: historyEntry.traded_at,
        };
      });

      return {
        id: pokemon._id,
        pokemon_name: pokemon.pokemon_name,
        pokedex_entries: pokemon.pokedex_entries,
        pokemon_level: pokemon.pokemon_level,
        pokemon_exp: pokemon.pokemon_exp,
        caught_at: pokemon.caught_at,
        trade_history: tradeHistory,
        pokemon_types: pokemon.pokemon_types,
        sprite_url: pokemon.sprite_url,
      };
    });

    return res.status(200).json(pokemonUser);
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

router.get(
  "/pokemon-sprite/:pokemonId",
  authenticateToken,
  async (req, res) => {
    try {
      const { pokemonId } = req.params;

      const pokemon = await Pokemon.findOne({
        _id: pokemonId,
        pokemon_owner: req.user.id,
      });

      if (!pokemon) {
        return res
          .status(404)
          .json({ message: "Pokémon tidak ditemukan atau bukan milik Anda." });
      }

      if (!pokemon.sprite_url) {
        return res
          .status(404)
          .json({ message: "Sprite URL untuk Pokémon ini tidak tersedia." });
      }

      const imageResponse = await axios({
        method: "get",
        url: pokemon.sprite_url,
        responseType: "stream",
      });

      const contentType = imageResponse.headers["content-type"] || "image/png";
      res.setHeader("Content-Type", contentType);

      imageResponse.data.pipe(res);
    } catch (error) {
      console.error("Error fetching Pokémon sprite:", error.message);
      if (error.response && error.response.status === 404) {
        return res
          .status(404)
          .json({ message: "Gagal mengambil sprite dari URL sumber." });
      }
      return res.status(500).json({
        message: "Terjadi kesalahan pada server saat mengambil sprite Pokémon.",
      });
    }
  }
);

router.post("/catch/:pokemon", authenticateToken, async (req, res) => {
  try {
    const catchSchema = Joi.object({
      pokemon: Joi.alternatives()
        .try(
          Joi.string().regex(/^[a-zA-Z0-9\-]+$/i),
          Joi.number().integer().min(1)
        )
        .required(),
    });
    const { error } = catchSchema.validate(req.params);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const findUser = await User.findOne({ _id: req.user.id, deletedAt: null });
    if (!findUser) {
      return res
        .status(404)
        .json({ message: "User tidak ditemukan atau tidak aktif!" });
    }

    const searchParam = req.params.pokemon.toString().toLowerCase();
    const speciesResponse = await axios.get(
      `https://pokeapi.co/api/v2/pokemon-species/${searchParam}`
    );
    const pokemonDataResponse = await axios.get(
      `https://pokeapi.co/api/v2/pokemon/${speciesResponse.data.id}`
    );

    const name = speciesResponse.data.name;
    const pokemonName = name.charAt(0).toUpperCase() + name.slice(1);
    const catchRate = speciesResponse.data.capture_rate;

    var cost;
    if (catchRate <= 45) {
      cost = 5000;
    } else if (catchRate <= 100) {
      cost = 3000;
    } else if (catchRate <= 180) {
      cost = 2000;
    } else {
      cost = 1000;
    }

    if (findUser.pokeDollar < cost) {
      return res.status(400).json({
        message: `PokeDollars tidak cukup! Anda memerlukan ${cost}, PokeDollars Anda: ${findUser.pokeDollar}`,
      });
    }

    const countPokemon = await Pokemon.countDocuments({
      pokemon_owner: findUser._id,
    });

    if (countPokemon >= findUser.pokemon_storage) {
      return res.status(400).json({
        message: `Penyimpanan Pokemon Anda sudah penuh! (${countPokemon}/${findUser.pokemon_storage})`,
      });
    }

    findUser.pokeDollar -= cost;

    const catchProbability = catchRate / 255;

    if (Math.random() > catchProbability) {
      await findUser.save();
      return res.status(200).json({
        harga_percobaan: `${cost} PokeDollar`,
        message: `${pokemonName} berhasil kabur!`,
        pokeDollar_sekarang: findUser.pokeDollar,
      });
    }

    var pokemonLevel = 1;
    if (cost === 5000) {
      pokemonLevel = Math.floor(Math.random() * (70 - 50 + 1)) + 50; // Lvl 50-70
    } else if (cost === 3000) {
      pokemonLevel = Math.floor(Math.random() * (50 - 30 + 1)) + 30; // Lvl 30-50
    } else if (cost === 2000) {
      pokemonLevel = Math.floor(Math.random() * (30 - 15 + 1)) + 15; // Lvl 15-30
    } else {
      pokemonLevel = Math.floor(Math.random() * (15 - 5 + 1)) + 5; // Lvl 5-15
    }

    var newPokemon = {
      pokemon_name: pokemonName,
      pokedex_entries: speciesResponse.data.id,
      pokemon_level: pokemonLevel,
      pokemon_exp: 0,
      pokemon_owner: findUser._id,
      caught_at: new Date(),
      trade_history: [],
      pokemon_types: pokemonDataResponse.data.types.map((t) => t.type.name),
      sprite_url: pokemonDataResponse.data.sprites.front_default,
    };

    await Pokemon.create(newPokemon);
    await findUser.save();

    return res.status(200).json({
      message: `${pokemonName} (Lv. ${pokemonLevel}) berhasil ditangkap!`,
      pokeDollar_sekarang: findUser.pokeDollar,
    });
  } catch (error) {
    console.error("Catch Pokemon Error:", error);
    if (error.response && error.response.status === 404) {
      return res
        .status(404)
        .json({ message: "Spesies Pokemon tidak ditemukan" });
    } else {
      return res.status(500).json({
        message:
          "Terjadi kesalahan pada server saat mencoba menangkap Pokemon.",
        error: error.message,
      });
    }
  }
});

// router.post("/catch/:pokemon", authenticateToken, async (req, res) => {
//   try {
//     const catchSchema = Joi.object({
//       pokemon: Joi.alternatives()
//         .try(
//           Joi.string().regex(/^[a-zA-Z0-9\-]+$/i),
//           Joi.number().integer().min(1)
//         )
//         .required(),
//     });
//     const { error } = catchSchema.validate(req.params);
//     if (error) {
//       return res.status(400).json({ message: error.details[0].message });
//     }

//     const response = await axios.get(
//       `https://pokeapi.co/api/v2/pokemon-species/${req.params.pokemon}`
//     );
//     const name = response.data.name;
//     const pokemonName = name.charAt(0).toUpperCase() + name.slice(1);
//     const catchRate = response.data.capture_rate;

//     var cost;
//     if (catchRate >= 3 && catchRate < 75) {
//       cost = 3000;
//     } else if (catchRate >= 75 && catchRate < 150) {
//       cost = 2000;
//     } else {
//       cost = 1000;
//     }
//     const findUser = await User.findOne({ _id: req.user.id, deletedAt: null });

//     if (!findUser) {
//       return res.status(404).json({ message: "User tidak ditemukan!" });
//     }

//     if (findUser.pokeDollar < cost) {
//       return res.status(400).json({
//         message: `PokeDollars tidak cukup!, pokedollars anda: ${findUser.pokeDollar}`,
//       });
//     }

//     const countPokemon = await Pokemon.countDocuments({
//       pokemon_owner: findUser._id,
//     });
//     console.log(countPokemon);

//     if (Number(countPokemon) + 1 > findUser.pokemon_storage) {
//       return res.status(400).json({
//         message: "Penyimpanan Pokemon anda sudah penuh!",
//       });
//     }

//     findUser.pokeDollar = Number(findUser.pokeDollar) - Number(cost);
//     const catchProbability = catchRate / 255;
//     if (Math.random() > catchProbability) {
//       await findUser.save();
//       return res.status(200).json({
//         harga: `${cost} PokeDollar`,
//         message: `${pokemonName} berhasil kabur!`,
//         pokeDollar: `PokeDollar anda sekarang: ${findUser.pokeDollar}`,
//       });
//     }
//     var pokemonLevel = 1;
//     if (cost === 3000) {
//       pokemonLevel = Math.floor(Math.random() * (100 - 50 + 1)) + 50;
//     } else if (cost === 2000) {
//       pokemonLevel = Math.floor(Math.random() * (30 - 15 + 1)) + 15;
//     } else {
//       pokemonLevel = Math.floor(Math.random() * 15) + 1;
//     }

//     var newPokemon = {
//       pokemon_name: pokemonName,
//       pokedex_entries: response.data.id,
//       pokemon_level: pokemonLevel,
//       pokemon_exp: 1,
//       pokemon_owner: findUser._id,
//       caught_at: new Date(),
//       trade_history: [],
//     };

//     await Pokemon.create(newPokemon);
//     await findUser.save();

//     return res.status(200).json({
//       message: `${pokemonName} berhasil ditangkap!`,
//       pokemon_level: pokemonLevel,
//       pokeDollar: `PokeDollar anda sekarang: ${findUser.pokeDollar}`,
//     });
//   } catch (error) {
//     if (error.response && error.response.status === 404) {
//       return res.status(404).json({ message: "Pokemon tidak ditemukan!" });
//     } else {
//       return res.status(500).json(error.message);
//     }
//   }
// });

module.exports = router;
