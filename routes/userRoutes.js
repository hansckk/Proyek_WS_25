const express = require("express");
const router = express.Router();
const Joi = require("joi");
const Role = require("../models/Role");
const User = require("../models/User");
const { generateApiKey } = require("generate-api-key");
const argon2 = require("argon2");

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

    const getRole = await Role.findOne({ role_name: "Free" });

    var newUser = new User();
    newUser.name = req.body.name;
    newUser.username = req.body.username;
    newUser.password = await argon2.hash(req.body.password, 10);
    newUser.email = req.body.email;
    newUser.age = req.body.age;
    newUser.createdAt = new Date();
    newUser.updatedAt = new Date();
    newUser.deletedAt = null;
    newUser.role = getRole._id;
    newUser.api_key = await argon2.hash(
      generateApiKey({ method: "uuidv4" }),
      10
    );
    console.log("regular api key" + generateApiKey({ method: "uuidv4" }));

    console.log("pass " + newUser.password);

    console.log("hashed apikey: " + newUser.api_key);

    newUser.save(function (err, user) {
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
