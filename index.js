const express = require("express");
const { connectDatabase } = require("./config/database");
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const pokemonRoutes = require("./routes/pokemonRoutes");
const userRoutes = require("./routes/userRoutes");

connectDatabase();
app.use("/api/v1/pokemon", pokemonRoutes);
app.use("api/v1/user", userRoutes);

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
