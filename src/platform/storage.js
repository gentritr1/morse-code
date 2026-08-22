export function createStorage(storage = window.localStorage) {
  function get(key, fallback = null) {
    try {
      return storage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getNumber(key, fallback = 0) {
    const value = Number(get(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  function getJson(key, fallback) {
    try {
      const value = get(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      storage.setItem(key, String(value));
      return true;
    } catch {
      return false;
    }
  }

  function setJson(key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  return Object.freeze({ get, getNumber, getJson, set, setJson });
}
