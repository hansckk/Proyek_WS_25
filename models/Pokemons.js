const mongoose = require("mongoose");

const pokemonSchema = new mongoose.Schema({
  pokemon_name: { type: String, required: true },
  pokedex_entries: { type: Number, required: true },
  pokemon_level: { type: Number, default: 1 },
  pokemon_exp: { type: Number, default: 1 },
  pokemon_owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
    required: true,
  },
  caught_at: { type: Date, default: Date.now },
  trade_history: [
    {
      trade_id: { type: mongoose.Schema.Types.ObjectId, ref: "trades" },
      from_user: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
      traded_at: { type: Date, default: Date.now },
    },
  ],
});

const Pokemon = mongoose.model("pokemons", pokemonSchema);
module.exports = Pokemon;
