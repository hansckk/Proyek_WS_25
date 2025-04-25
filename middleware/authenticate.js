const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const authenticateToken = async (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = authHeader.startsWith("Bearer")
    ? authHeader.slice(7)
    : authHeader;

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    return res.status(400).json({ error: "Invalid Token" });
  }
};

const isAdmin = async (req, res, next) => {
  if (req.user.role !== "Admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

const isTrainer = async (req, res, next) => {
  if (req.user.role !== "Trainer") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

const isGymLeader = async (req, res, next) => {
  if (req.user.role !== "Gym Leader") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

module.exports = { authenticateToken, isAdmin, isTrainer, isGymLeader };
