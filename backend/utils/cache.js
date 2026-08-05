const cacheStore = {};

exports.set = (key, value, ttlSeconds) => {
  const expiresAt = Date.now() + (ttlSeconds * 1000);
  cacheStore[key] = { value, expiresAt };
};

exports.get = (key) => {
  const item = cacheStore[key];
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    delete cacheStore[key];
    return null;
  }
  return item.value;
};

exports.clear = () => {
  for (const key in cacheStore) {
    delete cacheStore[key];
  }
};
