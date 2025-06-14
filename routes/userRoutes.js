const express = require("express");
const router = express.Router();
const Joi = require("joi");
const User = require("../models/User");
const Trade = require("../models/Trades.js");
const Pokemon = require("../models/Pokemons.js");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const {
  authenticateToken,
  authenticateRefreshToken,
} = require("../middleware/authenticate");
dotenv.config();

function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRATION }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRATION }
  );

  return { accessToken, refreshToken };
}

router.post("/register", async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      username: Joi.string().min(5).required(),
      password: Joi.string().min(6).required(),
      email: Joi.string().email().required(),
      age: Joi.number().integer().min(6).required(),
    });
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingUser = await User.findOne({ username: req.body.username });
    if (existingUser) {
      return res.status(400).json({ error: "Username sudah ada!" });
    }

    const existingEmail = await User.findOne({ email: req.body.email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email sudah terdaftar!" });
    }
    var newUser = new User();
    newUser.name = req.body.name;
    newUser.username = req.body.username;
    newUser.password = await argon2.hash(req.body.password);
    newUser.email = req.body.email;
    newUser.age = req.body.age;
    newUser.createdAt = new Date();
    newUser.updatedAt = new Date();
    newUser.deletedAt = null;
    newUser.pokemon_storage = 10;
    newUser.pokeDollar = 5000;
    newUser.role = "user";

    const createUser = await User.create(newUser);

    return res.status(201).json({
      message: `Registrasi berhasil! Akun untuk username '${createUser.username}' telah dibuat. Selamat datang!`,
      data: {
        id: createUser._id,
        username: createUser.username,
        email: createUser.email,
        role: createUser.role,
      }
    });
  } catch (error) {
    return res.status(500).json(error.message);
  }
});


router.post("/register/admin", async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      username: Joi.string().min(5).required(),
      password: Joi.string().min(6).required(),
      email: Joi.string().email().required(),
      age: Joi.number().integer().min(6).required(), // Admins also have age for consistency, can be adjusted
    });
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingUser = await User.findOne({ username: req.body.username });
    if (existingUser) {
      return res.status(400).json({ error: "Username sudah ada!" });
    }

    const existingEmail = await User.findOne({ email: req.body.email });
    if (existingEmail) {
      return res.status(400).json({ error: "Email sudah terdaftar!" });
    }

    var newAdmin = new User();
    newAdmin.name = req.body.name;
    newAdmin.username = req.body.username;
    newAdmin.password = await argon2.hash(req.body.password);
    newAdmin.email = req.body.email;
    newAdmin.age = req.body.age;
    newAdmin.createdAt = new Date();
    newAdmin.updatedAt = new Date();
    newAdmin.deletedAt = null;
    newAdmin.pokemon_storage = 999999999; 
    newAdmin.pokeDollar = 99999999999999999;      
    newAdmin.role = "Admin";      

    const createAdmin = await User.create(newAdmin);

    return res.status(201).json({
      message: `Registrasi berhasil! Admin untuk username '${createAdmin.username}' telah dibuat. Selamat datang!`,
      data: {
        id: createAdmin._id,
        username: createAdmin.username,
        email: createAdmin.email,
        role: createAdmin.role,
      }
    });
  } catch (error) {
    console.error("Admin registration error:", error);
    return res.status(500).json({ error: error.message || "Internal server error during admin registration." });
  }
});


router.post("/login", async (req, res) => {
  try {
    const loginSchema = Joi.object({
      username: Joi.string().required(),
      password: Joi.string().required(),
    });

    const { error } = loginSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const findUser = await User.findOne({
      username: req.body.username,
      deletedAt: null,
    });
    if (!findUser) {
      return res.status(400).json({ error: "Username atau password salah!" });
    }

    const isPasswordValid = await argon2.verify(
      findUser.password,
      req.body.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Password salah!" });
    }

    const { accessToken, refreshToken } = generateTokens(findUser);

    return res.status(200).json({
      message: "Berhasil login!",
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    return res.status(500).json(error.message);
  }
});


router.put("/changeUser", authenticateToken, async (req, res) => {
  try {
    const updateUserSchema = Joi.object({
      name: Joi.string().optional(),
      username: Joi.string().min(5).optional(),
      password: Joi.string().min(6).optional(), 
      email: Joi.string().email().optional(),
      age: Joi.number().integer().min(6).optional(),
    })
      .min(1) 
      .messages({
        "object.min":
          "Setidaknya satu field (name, username, password, email, age) harus diisi untuk update.",
      });

    const { error, value } = updateUserSchema.validate(req.body); 
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;
    const userToUpdate = await User.findById(userId);

    if (!userToUpdate || userToUpdate.deletedAt) {
      return res
        .status(404)
        .json({ error: "User tidak ditemukan atau telah dihapus." });
    }

    let updated = false;

    if (value.username && value.username !== userToUpdate.username) {
      const existingUser = await User.findOne({ username: value.username });
      if (existingUser) {
        return res.status(400).json({ error: "Username sudah ada!" });
      }
      userToUpdate.username = value.username;
      updated = true;
    }

    if (value.email && value.email !== userToUpdate.email) {
      const existingEmail = await User.findOne({ email: value.email });
      if (existingEmail) {
        return res.status(400).json({ error: "Email sudah terdaftar!" });
      }
      userToUpdate.email = value.email;
      updated = true;
    }

    if (value.name && value.name !== userToUpdate.name) {
      userToUpdate.name = value.name;
      updated = true;
    }

    if (value.password) {
      userToUpdate.password = await argon2.hash(value.password);
      updated = true;
    }

    if (value.age && value.age !== userToUpdate.age) {
      userToUpdate.age = value.age;
      updated = true;
    }

    if (updated) {
      userToUpdate.updatedAt = new Date();
      await userToUpdate.save();

      return res.status(200).json({
        message: "Profil berhasil diperbarui.",
        data: {
          id: userToUpdate._id,
          name: userToUpdate.name,
          username: userToUpdate.username,
          email: userToUpdate.email,
          age: userToUpdate.age,
          role: userToUpdate.role, 
        },
      });
    } else {
      return res.status(200).json({
        message: "Tidak ada data yang diubah.",
        data: {
          id: userToUpdate._id,
          name: userToUpdate.name,
          username: userToUpdate.username,
          email: userToUpdate.email,
          age: userToUpdate.age,
          role: userToUpdate.role,
        }
      });
    }
  } catch (error) {
    console.error("Error updating user profile:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
});


//


router.post("/refresh-token", authenticateRefreshToken, async (req, res) => {
  try {
    const activeUser = await User.findOne({
      _id: req.user.id,
      deletedAt: null,
    });
    if (!activeUser) {
      return res.status(401).json({ error: "User tidak aktif!" });
    }

    const { accessToken, refreshToken } = generateTokens(activeUser);
    return res.status(200).json({
      message: "Berhasil mendapatkan token baru!",
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

router.put("/forgetPassword", async (req, res) => {
  try {
    const passwordSchema = Joi.object({
      username: Joi.string().required(),
      email: Joi.string().email().required(),
      new_password: Joi.string().min(6).required(),
      confirm_new_password: Joi.string()
        .valid(Joi.ref("new_password"))
        .required()
        .messages({
          "any.only": "Konfirmasi password harus sama dengan password baru",
        }),
    });

    const { error } = passwordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const findUser = await User.findOne({
      username: req.body.username,
      deletedAt: null,
    });

    if (!findUser) {
      return res.status(404).json({ error: "User tidak ditemukan!" });
    }

    if (findUser.email !== req.body.email) {
      return res.status(400).json({ error: "Email tidak sesuai!" });
    }

    findUser.password = await argon2.hash(req.body.new_password);
    findUser.updatedAt = new Date();

    await findUser.save();

    return res.status(200).json({
      message: "Password berhasil diubah!",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const userProfile = await User.findById(userId)
      .select("-username -password -__v")
      .lean();

    if (!userProfile) {
      return res.status(404).json({ error: "User profile tidak ditemukan." });
    }
    if (userProfile.deletedAt) {
      return res
        .status(404)
        .json({ error: "User profile tidak ditemukan atau telah dihapus." });
    }

    return res.status(200).json({
      message: "Profil user berhasil didapatkan.",
      data: userProfile,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({ error: "Terjadi kesalahan pada server." });
  }
});

const tradeSchema = Joi.object({
  user_id: Joi.string().required(),
  pokemon_id: Joi.string().required(),
});

router.post("/trade", authenticateToken, async (req, res) => {
  try {
    const { error } = tradeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const findFromTrainer = await User.findOne({
      _id: req.user.id,
      deletedAt: null,
    });
    if (!findFromTrainer) {
      return res.status(404).json({ error: "User tidak ditemukan!" });
    }
    const findToTrainer = await User.findOne({
      _id: req.body.user_id,
      deletedAt: null,
    });
    if (!findToTrainer) {
      return res.status(404).json({ error: "User tidak ditemukan!" });
    }

    if (findFromTrainer._id.toString() === findToTrainer._id.toString()) {
      return res
        .status(400)
        .json({ error: "Tidak bisa trade ke diri sendiri!" });
    }

    const findTradedPokemon = await Pokemon.findOne({
      pokemon_owner: findFromTrainer._id,
      _id: req.body.pokemon_id,
    });
    if (!findTradedPokemon) {
      return res
        .status(404)
        .json({ error: "Pokemon yang ingin ditrade tidak ditemukan!" });
    }

    var newTrade = new Trade();
    newTrade.from_trainer = findFromTrainer._id;
    newTrade.to_trainer = findToTrainer._id;
    newTrade.status = "pending";
    newTrade.createdAt = new Date();
    newTrade.updatedAt = new Date();

    const createTrade = await Trade.create(newTrade);

    return res.status(201).json({
      message: "Trade berhasil dibuat!",
      trade_id: createTrade._id,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put("/trade/:trade_id/:action", authenticateToken, async (req, res) => {
  try {
    const actionSchema = Joi.object({
      trade_id: Joi.string().alphanum().length(24).required(),
      action: Joi.string().valid("accept", "reject").required(),
      receiver_offered_pokemon_id: Joi.string()
        .alphanum()
        .length(24)
        .allow("", null),
    });

    const dataToValidate = { ...req.params, ...req.body };

    const { error } = actionSchema.validate(dataToValidate);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const findTrade = await Trade.findById(req.params.trade_id);
    if (!findTrade) {
      return res.status(404).json({ error: "Trade tidak ditemukan!" });
    }

    if (findTrade.to_trainer.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Anda tidak berhak mengakses trade ini!" });
    }

    if (findTrade.status !== "pending") {
      return res.status(400).json({ error: "Trade sudah tidak valid!" });
    }

    if (req.params.action === "accept") {
      const initiatorPokemon = await Pokemon.findOne(findTrade.from_pokemon_id);

      if (!initiatorPokemon) {
        return res.status(404).json({ error: "Pokemon tidak ditemukan!" });
      }

      if (
        initiatorPokemon.pokemon_owner.toString() !==
        findTrade.from_trainer.toString()
      ) {
        return res.status(400).json({
          error:
            "Kepemilikan Pokémon pengirim telah berubah, trade tidak valid.",
        });
      }

      if (req.body.receiver_offered_pokemon_id) {
        const receiverPokemon = await Pokemon.findOne({
          _id: req.body.receiver_offered_pokemon_id,
          pokemon_owner: req.user.id,
        });

        if (!receiverPokemon) {
          return res.status(404).json({
            error:
              "Pokémon yang Anda tawarkan tidak ditemukan atau bukan milik Anda!",
          });
        }

        if (
          initiatorPokemon._id.toString() === receiverPokemon._id.toString()
        ) {
          return res.status(400).json({
            error: "Tidak bisa menukar Pokémon dengan dirinya sendiri.",
          });
        }

        initiatorPokemon.pokemon_owner = findTrade.to_trainer;
        receiverPokemon.pokemon_owner = findTrade.from_trainer;

        initiatorPokemon.trade_history.push({
          trade_id: findTrade._id,
          from_user: findTrade.from_trainer,
          to_user: findTrade.to_trainer,
          traded_at: new Date(),
        });
        receiverPokemon.trade_history.push({
          trade_id: findTrade._id,
          from_user: findTrade.to_trainer,
          to_user: findTrade.from_trainer,
          traded_at: new Date(),
        });

        await initiatorPokemon.save();
        await receiverPokemon.save();
      } else {
        initiatorPokemon.pokemon_owner = findTrade.to_trainer;

        initiatorPokemon.trade_history.push({
          trade_id: findTrade._id,
          from_user: findTrade.from_trainer,
          to_user: findTrade.to_trainer,
          traded_at: new Date(),
        });
        await initiatorPokemon.save();

        findTrade.status = "accepted";
      }
    } else {
      findTrade.status = "rejected";
    }

    findTrade.updatedAt = new Date();
    await findTrade.save();

    return res
      .status(200)
      .json({ message: `Trade berhasil di-${req.params.action}` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
