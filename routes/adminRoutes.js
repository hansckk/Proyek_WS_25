const express = require("express");
const router = express.Router();
const Joi = require("joi");
const axios = require("axios");
const mongoose = require("mongoose");
const Pokemons = require("../models/Pokemons");
const { authenticateToken, isAdmin } = require("../middleware/authenticate");
const User = require("../models/User");
const simpleCache = require("../utils/simpleCache");

/**
 * @swagger
 * tags:
 *   name: Admin - Purchases
 *   description: Admin routes for monitoring user purchases
 */

/**
 * @swagger
 * /admin/user-purchases:
 *   get:
 *     summary: (ADMIN) Get all user purchases from the shop
 *     tags: [Admin - Purchases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users and their purchased items.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                     description: The user ID.
 *                   username:
 *                     type: string
 *                     description: The username of the user.
 *                   name:
 *                     type: string
 *                     description: The real name of the user.
 *                   email:
 *                      type: string
 *                      format: email
 *                      description: The email of the user.
 *                   pokeDollarBalance:
 *                      type: number
 *                      description: Current PokeDollar balance of the user.
 *                   purchasedItems:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         type:
 *                           type: string
 *                         effect:
 *                           type: string
 *                         price:
 *                           type: number
 *                         quantity:
 *                           type: number
 *                         rarity:
 *                           type: string
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       403:
 *         description: Forbidden (user is not an admin)
 *       404:
 *         description: No users with purchase history found.
 *       500:
 *         description: Internal server error
 */

router.get("/purchases", authenticateToken, isAdmin, async (req, res) => {
  const cacheKey = 'admin_allUserPurchases'; // Kunci cache spesifik
  const cacheTTL = 300; // 5 menit

  try {
    // 1. Coba ambil dari cache
    const cachedData = simpleCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json({
        message: "User purchases fetched successfully from cache.",
        source: "cache",
        data: cachedData
      });
    }

    // 2. Jika tidak ada di cache, ambil dari database
    const usersWithItems = await User.find({
      "items.0": { $exists: true }, // Hanya user yang punya item
      deletedAt: null // Mungkin Anda hanya ingin data dari user aktif
    }).select("username name email pokeDollar items _id").lean(); // .lean() untuk performa

    if (!usersWithItems || usersWithItems.length === 0) {
      return res
        .status(404)
        .json({ message: "No users with purchase history found." });
    }

    const purchaseData = usersWithItems.map((user) => ({
      userId: user._id,
      username: user.username,
      name: user.name,
      email: user.email,
      pokeDollarBalance: user.pokeDollar, // Pastikan field ini benar, di User model Anda 'pokeDollar'
      purchasedItems: user.items.map((item) => ({
        name: item.name,
        type: item.type,
        effect: item.effect,
        price: item.price,
        quantity: item.quantity,
        rarity: item.rarity,
      })),
    }));

    // 3. Simpan hasil ke cache
    simpleCache.set(cacheKey, purchaseData, cacheTTL);

    res.status(200).json({
      message: "User purchases fetched successfully from database.",
      source: "database",
      data: purchaseData
    });

  } catch (error) {
    console.error("Error fetching user purchases for admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
/**
 * @swagger
 * /admin/user-purchases/{userId}:
 *   get:
 *     summary: (ADMIN) Get purchase history for a specific user
 *     tags: [Admin - Purchases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to retrieve purchase history for.
 *     responses:
 *       200:
 *         description: Purchase history for the specified user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 username:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *                 pokeDollarBalance:
 *                   type: number
 *                 purchasedItems:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       type:
 *                         type: string
 *                       effect:
 *                         type: string
 *                       price:
 *                         type: number
 *                       quantity:
 *                         type: number
 *                       rarity:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found or has no purchase history.
 *       500:
 *         description: Internal server error
 */
router.get(
  "/purchases/:userId",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const user = await User.findOne({
        _id: userId,
        "items.0": { $exists: true },
      }).select("username name email pokeDollar items _id");

      if (!user) {
        const userExists = await User.findById(userId);
        if (userExists) {
          return res.status(404).json({
            message: `User ${userExists.username} found, but has no purchase history.`,
          });
        }
        return res
          .status(404)
          .json({ message: "User not found or has no purchase history." });
      }

      const purchaseData = {
        userId: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        pokeDollarBalance: user.pokeDollar,
        purchasedItems: user.items.map((item) => ({
          name: item.name,
          type: item.type,
          effect: item.effect,
          price: item.price,
          quantity: item.quantity,
          rarity: item.rarity,
        })),
      };

      res.status(200).json(purchaseData);
    } catch (error) {
      console.error("Error fetching specific user purchases for admin:", error);
      if (error.name === "CastError") {
        return res.status(400).json({ error: "Invalid user ID format." });
      }
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * @swagger
 * tags:
 *   name: Buddy Pokémon
 *   description: Manage and view buddy Pokémon assignments
 */

/**
 * @swagger
 * /buddyUser:
 *   get:
 *     summary: Get all users and their assigned buddy Pokémon
 *     tags: [Buddy Pokémon]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users and their buddy Pokémon.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       username:
 *                         type: string
 *                       buddy_pokemon:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           name:
 *                             type: string
 *                           pokedex_entries:
 *                             type: number
 *                           level:
 *                             type: number
 *                           exp:
 *                             type: number
 *                           types:
 *                             type: array
 *                             items:
 *                               type: string
 *                           sprite_url:
 *                             type: string
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       500:
 *         description: Internal server error
 */
router.get("/buddyUser", authenticateToken, async (req, res) => {
  try {
    const usersWithBuddies = await User.find({
      buddy_pokemon: { $exists: true, $ne: null },
    })
      .select("username buddy_pokemon _id") // Select necessary fields
      .populate({
        path: "buddy_pokemon",
        select:
          "pokemon_name pokedex_entries pokemon_level pokemon_exp pokemon_types sprite_url", // Select specific fields from Pokemons
      });

    if (usersWithBuddies.length === 0) {
      return res
        .status(200) // Keeping 200 as per original logic for "no users found"
        .json({ message: "No users with buddy Pokémon found." });
    }

    const result = usersWithBuddies.map((user) => ({
      userId: user._id, // Added userId
      username: user.username,
      buddy_pokemon: user.buddy_pokemon
        ? {
            name: user.buddy_pokemon.pokemon_name,
            pokedex_entries: user.buddy_pokemon.pokedex_entries,
            level: user.buddy_pokemon.pokemon_level,
            exp: user.buddy_pokemon.pokemon_exp,
            types: user.buddy_pokemon.pokemon_types,
            sprite_url: user.buddy_pokemon.sprite_url,
          }
        : null,
    }));

    res.status(200).json({
      message: `Found ${result.length} users with buddy Pokémon.`,
      users: result,
    });
  } catch (error) {
    console.error("Error fetching users with buddies:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * /buddyUser/{userId}:
 *   get:
 *     summary: Get buddy Pokémon for a specific user
 *     tags: [Buddy Pokémon]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to retrieve buddy Pokémon for.
 *     responses:
 *       200:
 *         description: Buddy Pokémon details for the specified user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 username:
 *                   type: string
 *                 buddy_pokemon:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     pokedex_entries:
 *                       type: number
 *                     level:
 *                       type: number
 *                     exp:
 *                       type: number
 *                     types:
 *                       type: array
 *                       items:
 *                         type: string
 *                     sprite_url:
 *                       type: string
 *       400:
 *         description: Invalid user ID format.
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       404:
 *         description: User not found, or user has no buddy Pokémon assigned.
 *       500:
 *         description: Internal server error
 */
router.get("/buddyUser/:userId", authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format." });
    }

    const user = await User.findById(userId)
      .select("username buddy_pokemon _id") // Select necessary fields
      .populate({
        path: "buddy_pokemon",
        select:
          "pokemon_name pokedex_entries pokemon_level pokemon_exp pokemon_types sprite_url", // Select specific fields from Pokemons
      });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.buddy_pokemon) {
      return res.status(404).json({
        message: `User ${user.username} has no buddy Pokémon assigned.`,
        userId: user._id,
        username: user.username,
      });
    }

    const responseData = {
      userId: user._id,
      username: user.username,
      buddy_pokemon: {
        name: user.buddy_pokemon.pokemon_name,
        pokedex_entries: user.buddy_pokemon.pokedex_entries,
        level: user.buddy_pokemon.pokemon_level,
        exp: user.buddy_pokemon.pokemon_exp,
        types: user.buddy_pokemon.pokemon_types,
        sprite_url: user.buddy_pokemon.sprite_url,
      },
    };

    res.status(200).json(responseData);
  } catch (error) {
    console.error("Error fetching buddy for specific user:", error);
    if (error.name === "CastError") {
      // Should be caught by the ObjectId.isValid check, but good as a fallback
      return res.status(400).json({ error: "Invalid user ID format." });
    }
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * @swagger
 * tags:
 *   name: Admin - User Management
 *   description: Admin routes for managing users
 */

/**
 * @swagger
 * /admin/user:
 *   get:
 *     summary: (ADMIN) Get all users' information
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of all users with their full details.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                     format: email
 *                   password:
 *                     type: string
 *                     description: Hashed password of the user.
 *                   age:
 *                     type: number
 *                   role:
 *                     type: string
 *                   pokeDollar:
 *                     type: number
 *                   pokemon_storage:
 *                     type: number
 *                   items:
 *                     type: array
 *                     items:
 *                       type: object # Define item structure if known, or keep generic
 *                   buddy_pokemon:
 *                     type: string # Or object if populated
 *                     nullable: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                   deletedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       403:
 *         description: Forbidden (user is not an admin)
 *       500:
 *         description: Internal server error
 */
router.get("/user", authenticateToken, isAdmin, async (req, res) => {
  const cacheKey = 'admin_allActiveUsers';
  const cacheTTL = 600; // 10 menit

  try {
    // 1. Cek cache
    const cachedUsers = simpleCache.get(cacheKey);
    if (cachedUsers) {
      return res.status(200).json({
        message: "All users fetched successfully from cache.",
        source: "cache",
        data: cachedUsers
      });
    }

    // 2. Ambil dari DB
    const users = await User.find({ deletedAt: null }) // Hanya user aktif
      .select("+password") // Sesuai logika Anda
      .lean();

    if (!users || users.length === 0) {
      // Simpan hasil "kosong" ke cache agar tidak query DB terus jika memang kosong
      simpleCache.set(cacheKey, [], cacheTTL);
      return res.status(404).json({ message: "No active users found." });
    }

    // 3. Simpan ke cache
    simpleCache.set(cacheKey, users, cacheTTL);

    res.status(200).json({
      message: "All users fetched successfully from database.",
      source: "database",
      data: users
    });

  } catch (error) {
    console.error("Error fetching all users for admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /admin/user/{userId}:
 *   get:
 *     summary: (ADMIN) Get specific user's information by ID
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to retrieve.
 *     responses:
 *       200:
 *         description: Full details of the specified user.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                   format: email
 *                 password:
 *                   type: string
 *                   description: Hashed password of the user.
 *                 age:
 *                   type: number
 *                 role:
 *                   type: string
 *                 pokeDollar:
 *                   type: number
 *                 pokemon_storage:
 *                   type: number
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object # Define item structure if known, or keep generic
 *                 buddy_pokemon:
 *                   type: string # Or object if populated
 *                   nullable: true
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                 deletedAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *       400:
 *         description: Invalid user ID format.
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       403:
 *         description: Forbidden (user is not an admin)
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error
 */
router.get("/user/:userId", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format." });
    }
    const user = await User.findById(userId).select("+password").lean();

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching specific user for admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /admin/user/{userId}:
 *   delete:
 *     summary: (ADMIN) Soft delete a user by ID
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to delete.
 *     responses:
 *       200:
 *         description: User soft deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *       400:
 *         description: Invalid user ID format.
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       403:
 *         description: Forbidden (user is not an admin)
 *       404:
 *         description: User not found or already deleted.
 *       500:
 *         description: Internal server error
 */
router.delete("/user/:userId", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user ID format." });
    }

    const userToDelete = await User.findById(userId);

    if (!userToDelete) {
      return res.status(404).json({ message: "User not found." });
    }

    if (userToDelete.deletedAt) {
      return res.status(404).json({ message: "User already soft deleted." });
    }

    userToDelete.deletedAt = new Date();
    await userToDelete.save();

    res
      .status(200)
      .json({ message: "User soft deleted successfully.", userId: userId });
  } catch (error) {
    console.error("Error soft deleting user for admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /admin/users/soft-deleted:
 *   get:
 *     summary: (ADMIN) Get all soft-deleted users
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of all soft-deleted users.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserAdminView'
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       403:
 *         description: Forbidden (user is not an admin)
 *       404:
 *         description: No soft-deleted users found.
 *       500:
 *         description: Internal server error
 */
router.get("/softDeleted", authenticateToken, isAdmin, async (req, res) => {
  try {
    const softDeletedUsers = await User.find({ deletedAt: { $ne: null } })
      .select("+password") // Include password for admin view
      .lean();

    if (!softDeletedUsers || softDeletedUsers.length === 0) {
      return res.status(404).json({ message: "No soft-deleted users found." });
    }

    res.status(200).json(softDeletedUsers);
  } catch (error) {
    console.error("Error fetching soft-deleted users for admin:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/**
 * @swagger
 * /admin/user/restore/{userId}:
 *   post:
 *     summary: (ADMIN) Restore a soft-deleted user by ID
 *     tags: [Admin - User Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to restore.
 *     responses:
 *       200:
 *         description: User restored successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/UserAdminView'
 *       400:
 *         description: Invalid user ID format, or user is not soft-deleted.
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       403:
 *         description: Forbidden (user is not an admin)
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error
 */
router.post(
  "/restoreUser/:userId",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid user ID format." });
      }

      const userToRestore = await User.findById(userId).select("+password"); // select password to include it in response

      if (!userToRestore) {
        return res.status(404).json({ message: "User not found." });
      }

      if (!userToRestore.deletedAt) {
        return res.status(400).json({ message: "User is not soft-deleted." });
      }

      userToRestore.deletedAt = null;
      await userToRestore.save();

      res.status(200).json({
        message: "User restored successfully.",
        user: userToRestore.toObject(), // Convert to plain object for response
      });
    } catch (error) {
      console.error("Error restoring user for admin:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

/**
 * @swagger
 * /admin/user/permanent/{userId}:
 *   delete:
 *     summary: (ADMIN) Permanently delete a user by ID
 *     tags: [Admin - User Management]
 *     description: This action is irreversible and will remove the user data from the database.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to permanently delete.
 *     responses:
 *       200:
 *         description: User permanently deleted successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *       400:
 *         description: Invalid user ID format.
 *       401:
 *         description: Unauthorized (token missing or invalid)
 *       403:
 *         description: Forbidden (user is not an admin)
 *       404:
 *         description: User not found.
 *       500:
 *         description: Internal server error
 */
router.delete(
  "/deletePermanent/:userId",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid user ID format." });
      }

      const deletedUser = await User.findByIdAndDelete(userId);

      if (!deletedUser) {
        return res.status(404).json({ message: "User not found." });
      }

      res.status(200).json({
        message: "User permanently deleted successfully.",
        userId: userId,
      });
    } catch (error) {
      console.error("Error permanently deleting user for admin:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

module.exports = router;
