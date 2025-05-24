const { faker } = require("@faker-js/faker");

function generateRandomUser() {
  return {
    name: faker.person.fullName(),
    username: faker.internet.username(),
    password: faker.internet.password(),
    email: faker.internet.email(),
    age: faker.datatype.number({ min: 6, max: 100 }),
    pokemon_storage: faker.datatype.number({ min: 1, max: 100 }),
    pokeDollar: faker.datatype.number({ min: 0, max: 100000 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

module.exports = {
  generateRandomUser,
};
