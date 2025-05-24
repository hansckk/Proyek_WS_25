const { connectDatabase, disconnectDatabase } = require("./database");
const Users = require("../models/User");
const Media = require("../models/Media");
const Trades = require("../models/Trades");

const models = [Users, Media, Trades];

const runMigration = async () => {
  try {
    await connectDatabase();

    for (const model of models) {
      await model.createIndexes();
    }
  } catch (error) {
    console.error("Error migration:", error);
  } finally {
    await disconnectDatabase();
    process.exit(0);
  }
};

runMigration();
