/**
 * 区分正式 /api/tg-search 与测试 /api/test/tg-search 请求上下文（AsyncLocalStorage）
 */
const { AsyncLocalStorage } = require("async_hooks");

const store = new AsyncLocalStorage();

/**
 * @param {"prod"|"test"} scope
 * @param {() => T} fn
 * @returns {T}
 * @template T
 */
function runWithTgSearchScope(scope, fn) {
  return store.run({ scope }, fn);
}

/** @returns {"prod"|"test"|null} */
function getTgSearchRequestScope() {
  return store.getStore()?.scope ?? null;
}

function isProdTgSearchRequest() {
  return getTgSearchRequestScope() === "prod";
}

/**
 * @param {Request} request
 * @param {() => T | Promise<T>} fn
 * @returns {T | Promise<T>}
 * @template T
 */
function runWithTgSearchScopeFromRequest(request, fn) {
  const path = new URL(request.url).pathname;
  const scope = path.includes("/api/test/tg-search") ? "test" : "prod";
  return runWithTgSearchScope(scope, fn);
}

module.exports = {
  runWithTgSearchScope,
  runWithTgSearchScopeFromRequest,
  getTgSearchRequestScope,
  isProdTgSearchRequest
};
