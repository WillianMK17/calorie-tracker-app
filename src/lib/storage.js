// Substitui o window.storage que só existe dentro do artifact do Claude.
// Guarda tudo no localStorage do navegador, sob uma única chave raiz.
const ROOT_KEY = "calorie-tracker:data:v1";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(ROOT_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(data) {
  localStorage.setItem(ROOT_KEY, JSON.stringify(data));
}

export function installStoragePolyfill() {
  window.storage = {
    async get(key) {
      const data = readAll();
      if (!(key in data)) return null;
      return { key, value: data[key], shared: false };
    },
    async set(key, value) {
      const data = readAll();
      data[key] = value;
      writeAll(data);
      return { key, value, shared: false };
    },
    async delete(key) {
      const data = readAll();
      const existed = key in data;
      delete data[key];
      writeAll(data);
      return { key, deleted: existed, shared: false };
    },
    async list(prefix) {
      const data = readAll();
      const keys = Object.keys(data).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}
