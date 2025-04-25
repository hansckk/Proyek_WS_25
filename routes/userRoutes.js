const express = require("express");
const router = express.Router();
const Joi = require("joi");
const User = require("../models/User");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

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
    newUser.api_key = jwt.sign(
      {
        id: newUser._id,
        username: newUser.username,
        role: getRole.role_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.API_EXPIRATION_TIME }
    );

    const createUser = await User.create(newUser);

    return res.status(201).json({
      message: "Berhasil daftar!",
      username: createUser.username,
      api_key: createUser.api_key,
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

    const loginToken = jwt.sign(
      {
        id: findUser._id,
        username: findUser.username,
        role: findUser.role.role_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION }
    );

    return res.status(200).json({
      message: "Berhasil login!",
      token: loginToken,
    });
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

router.put("/refresh", async (req, res) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const refreshToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const findUser = await User.findById(decoded.id);
    if (!findUser) {
      return res.status(404).json({ error: "User not found!" });
    }

    const newToken = jwt.sign({
      id: findUser._id,
      username: findUser.username,
      role: findUser.role.role_name,
    });
    return res.status(200).json({ token: newToken });
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

module.exports = router;
