import path from "path";
import { createRequire } from "module";

/** 从项目根加载 collector（避免 API 目录层级不同导致相对路径错误） */
export function loadJisouSearchService<T = Record<string, unknown>>(): T {
  const rootRequire = createRequire(path.join(process.cwd(), "package.json"));
  return rootRequire(path.join(process.cwd(), "collector", "jisou-search-service.js")) as T;
}
