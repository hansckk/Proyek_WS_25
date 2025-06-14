const express = require("express");
const path = require("path");
const { connectDatabase } = require("./config/database");
const mediaRoutes = require("./routes/media");
const helmet = require("helmet");
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(helmet());

const pokemonRoutes = require("./routes/pokemonRoutes");
const userRoutes = require("./routes/userRoutes");
const itemshopRoutes = require("./routes/itemshopRoutes");
const adminRoutes = require("./routes/adminRoutes");
const buddyRoutes = require("./routes/buddyRoutes");

const startServer = async () => {
  await connectDatabase();

  app.use("/api/v1/pokemon", pokemonRoutes);
  app.use("/api/v1/user", userRoutes);
  app.use("/api/v1/items", itemshopRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1/media", mediaRoutes);
  app.use("/api/v1/buddy", buddyRoutes);

  app.listen(port, () =>
    console.log(`Server running at http://localhost:${port}!`)
  );
};

startServer();
