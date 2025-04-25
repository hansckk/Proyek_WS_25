const express = require("express");
const router = express.Router();
const Joi = require("joi");
const axios = require("axios");
const Role = require("../models/Role");
const User = require("../models/User");
const { generateApiKey } = require("generate-api-key");

router.post("/register", async (req, res) => {
  try {
    const schema = Joi.object({
      name: Joi.string().required(),
      username: Joi.string().required(),
      password: Joi.string().required(),
      email: Joi.string().email().required(),
      age: Joi.number().integer().min(0).required(),
    });
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const existingUser = await User.findOne({ username: req.body.username });
    if (existingUser) {
      return res.status(400).json({ error: "Username sudah ada!" });
    }

    const getRole = await Role.findOne({ role_name: "Free" });

    var newUser = new User();
    newUser.name = req.body.name;
    newUser.username = req.body.username;
    newUser.password = req.body.password;
    newUser.email = req.body.email;
    newUser.age = req.body.age;
    newUser.createdAt = new Date();
    newUser.updatedAt = new Date();
    newUser.deletedAt = null;
    newUser.role = getRole._id;
    newRole.api_key = newUser.save(function (err, user) {
      if (err) {
        return res.status(500).json(err.message);
      }
    });
    
    return res.status(201).json({ message: "User terdaftar!" });
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

router.post("/login", async (req, res) => {});

module.exports = router;
