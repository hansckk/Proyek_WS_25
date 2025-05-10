const express = require("express");
const router = express.Router();
const Joi = require("joi");
const User = require("../models/User");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const { authenticateToken } = require("../middleware/authenticate");
dotenv.config();

function generateTokens(user) {
  const accessToken = jwt.sign(
    {
      id: user._id,
      username: user.username,
      role: user.role.role_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRATION }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id,
      username: user.username,
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
      password: Joi.string().min(10).required(),
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
    newUser.role.role_name = "Free";
    newUser.role.pokemon_storage = 10;
    newUser.pokeDollar = 5000;
    const { refreshToken, accessToken } = generateTokens(newUser);
    newUser.refresh_token = refreshToken;

    const createUser = await User.create(newUser);

    return res.status(201).json({
      message: "Berhasil daftar!",
      username: createUser.username,
    });
  } catch (error) {
    return res.status(500).json(error.message);
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

    const findUser = await User.findOne({ username: req.body.username });
    if (!findUser) {
      return res.status(400).json({ error: "Username tidak ditemukan!" });
    }

    const isPasswordValid = await argon2.verify(
      findUser.password,
      req.body.password
    );
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Password salah!" });
    }

    const { accessToken, refreshToken } = generateTokens(findUser);
    findUser.refresh_token = refreshToken;
    await findUser.save();

    return res.status(200).json({
      message: "Berhasil login!",
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

router.post("/forget-password", authenticateToken, async (req, res) => {
  try {
    const passwordSchema = Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: Joi.string().min(10).required(),
      confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required()
        .messages({ 'any.only': 'Konfirmasi password harus sama dengan password baru' }),
    });

    const { error } = passwordSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User tidak ditemukan!" });
    }

    const isPasswordValid = await argon2.verify(
      user.password,
      req.body.currentPassword
    );
    
    if (!isPasswordValid) {
      return res.status(400).json({ error: "Password saat ini salah!" });
    }

    user.password = await argon2.hash(req.body.newPassword);
    user.updatedAt = new Date();
    
    const { accessToken, refreshToken } = generateTokens(user);
    user.refresh_token = refreshToken;
    
    await user.save();

    return res.status(200).json({
      message: "Password berhasil diubah!",
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
