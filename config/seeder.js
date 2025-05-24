const { connectDatabase, disconnectDatabase } = require("./database.js");
const { generateRandomUser } = require("./generators.js");
const User = require("../models/User.js");

const accountsToSeed = 10;

const runSeeder = async () => {
  try {
    await connectDatabase();
    await User.deleteMany({});
    const users = await generateRandomUser(accountsToSeed);
    await User.insertMany(users);
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
};

runSeeder();
