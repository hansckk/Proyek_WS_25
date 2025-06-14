// utils/simpleCache.js

/**
 * Cache in-memory sederhana menggunakan Map JavaScript.
 * Cocok untuk development atau aplikasi skala kecil.
 * Untuk produksi dengan skala lebih besar, pertimbangkan Redis atau Memcached.
 */
const cache = new Map();

/**
 * Menyimpan nilai ke dalam cache dengan Time-To-Live (TTL).
 * @param {string} key - Kunci unik untuk item cache.
 * @param {*} value - Nilai yang akan disimpan.
 * @param {number} [ttlInSeconds=60] - Waktu hidup cache dalam detik. Default 60 detik.
 */
const set = (key, value, ttlInSeconds = 60) => {
  if (typeof key !== 'string') {
    console.error('Cache key must be a string.');
    return;
  }
  const expiresAt = Date.now() + ttlInSeconds * 1000;
  cache.set(key, { value, expiresAt });
  console.log(`CACHE SET: key="${key}", ttl=${ttlInSeconds}s`);
};

/**
 * Mengambil nilai dari cache.
 * Jika item tidak ada atau sudah kedaluwarsa, akan mengembalikan null.
 * @param {string} key - Kunci item cache yang akan diambil.
 * @returns {*} Nilai dari cache, atau null jika tidak ditemukan atau kedaluwarsa.
 */
const get = (key) => {
  if (typeof key !== 'string') {
    console.error('Cache key must be a string.');
    return null;
  }
  const cachedItem = cache.get(key);
  if (cachedItem) {
    if (Date.now() < cachedItem.expiresAt) {
      console.log(`CACHE HIT: key="${key}"`);
      return cachedItem.value;
    } else {
      console.log(`CACHE EXPIRED: key="${key}"`);
      cache.delete(key); // Hapus item yang sudah kedaluwarsa dari cache
    }
  }
  console.log(`CACHE MISS: key="${key}"`);
  return null;
};

/**
 * Menghapus item tertentu dari cache, atau semua item jika tidak ada kunci yang diberikan.
 * @param {string} [key] - Kunci item cache yang akan dihapus. Jika kosong, semua cache akan dihapus.
 */
const clear = (key) => {
  if (key && typeof key === 'string') {
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
    console.error('Cache key for clear must be a string or undefined (to clear all).');
  }
};

/**
 * Mendapatkan semua kunci yang saat ini ada di cache (untuk debugging).
 * @returns {string[]} Array dari kunci cache.
 */
const getKeys = () => {
  return Array.from(cache.keys());
};

/**
 * Mendapatkan ukuran cache (jumlah item yang disimpan) (untuk debugging).
 * @returns {number} Jumlah item dalam cache.
 */
const getSize = () => {
  return cache.size;
};

module.exports = {
  set,
  get,
  clear,
  getKeys, // Opsional, untuk debugging
  getSize, // Opsional, untuk debugging
};