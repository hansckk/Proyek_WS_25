const express = require("express");
const router = express.Router();
const Joi = require("joi");
const axios = require("axios");
const { authenticateToken, isAdmin } = require("../middleware/authenticate");
const User = require("../models/User");

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
router.get("/user-purchases", authenticateToken, isAdmin, async (req, res) => {
  try {
    const usersWithItems = await User.find({
      "items.0": { $exists: true },
    }).select("username name email pokeDollar items _id");

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
      pokeDollarBalance: user.pokeDollar,
      purchasedItems: user.items.map((item) => ({
        name: item.name,
        type: item.type,
        effect: item.effect,
        price: item.price,
        quantity: item.quantity,
        rarity: item.rarity,
      })),
    }));

    res.status(200).json(purchaseData);
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
  "/user-purchases/:userId",
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
          return res
            .status(404)
            .json({
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

module.exports = router;
