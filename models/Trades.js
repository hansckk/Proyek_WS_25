const mongoose = require("mongoose");

const tradeSchema = new mongoose.Schema({
    from_trainer: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    to_trainer: { type: mongoose.Schema.Types.ObjectId, ref: "users", required: true },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
});
