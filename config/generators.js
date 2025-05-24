const { faker } = require("@faker-js/faker");
const argon2 = require("argon2");

async function createRandomUser() {
  const plainPassword = faker.internet.password();

  const minStorage = 5;
  const maxStorage = 100;

  const minMultiplier = Math.ceil(minStorage / 5);
  const maxMultiplier = Math.floor(maxStorage / 5);

  try {
    const hashedPassword = await argon2.hash(plainPassword);

    const randomMultiplier = faker.number.int({
      min: minMultiplier,
      max: maxMultiplier,
    });

    const pokemonStorage = randomMultiplier * 5;

    return {
      name: faker.person.fullName(),
      username: faker.internet.username(),
      password: hashedPassword,
      email: faker.internet.email(),
      age: faker.number.int({ min: 6, max: 100 }),
      pokemon_storage: pokemonStorage,
      pokeDollar: faker.number.int({ min: 0, max: 100000 }),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      role: "user",
    };
  } catch (error) {
    console.error("Error hashing password:", error);
    return null;
  }
}

async function generateRandomUser(n) {
  const usersPromises = [];
  for (let i = 0; i < n; i++) {
    usersPromises.push(createRandomUser());
  }
  const users = await Promise.all(usersPromises);
  return users.filter((user) => user !== null);
}

module.exports = {
  createRandomUser,
  generateRandomUser,
};
