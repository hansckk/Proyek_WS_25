const cache = new Map();

/**
 * @param {string} key
 * @param {*} value
 * @param {number} [ttlInSeconds=60]
 */
const set = (key, value, ttlInSeconds = 60) => {
  if (typeof key !== "string") {
    console.error("Cache key must be a string.");
    return;
  }
  const expiresAt = Date.now() + ttlInSeconds * 1000;
  cache.set(key, { value, expiresAt });
  console.log(`CACHE SET: key="${key}", ttl=${ttlInSeconds}s`);
};

/**
 * @param {string} key
 * @returns {*}
 */
const get = (key) => {
  if (typeof key !== "string") {
    console.error("Cache key must be a string.");
    return null;
  }
  const cachedItem = cache.get(key);
  if (cachedItem) {
    if (Date.now() < cachedItem.expiresAt) {
      console.log(`CACHE HIT: key="${key}"`);
      return cachedItem.value;
    } else {
      console.log(`CACHE EXPIRED: key="${key}"`);
      cache.delete(key);
    }
  }
  console.log(`CACHE MISS: key="${key}"`);
  return null;
};

/**
 * @param {string} [key]
 */
const clear = (key) => {
  if (key && typeof key === "string") {
    const deleted = cache.delete(key);
    if (deleted) {
      console.log(`CACHE CLEARED: key="${key}"`);
    } else {
      console.log(`CACHE CLEAR ATTEMPTED: key="${key}" not found.`);
    }
  } else if (!key) {
    cache.clear();
    console.log(`CACHE CLEARED: All keys`);
  } else {
    console.error(
      "Cache key for clear must be a string or undefined (to clear all)."
    );
  }
};

/**
 * @returns {string[]}
 */
const getKeys = () => {
  return Array.from(cache.keys());
};

/**
 * @returns {number}
 */
const getSize = () => {
  return cache.size;
};

module.exports = {
  set,
  get,
  clear,
  getKeys,
  getSize,
};
