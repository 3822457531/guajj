const { startServer } = require("next/dist/server/lib/start-server");
const fs = require("fs");
const path = require("path");

const devDist = path.join(process.cwd(), ".next", "dev");
fs.mkdirSync(devDist, { recursive: true });
const requiredFiles = path.join(devDist, "required-server-files.json");
function ensureRequiredFiles() {
  fs.mkdirSync(devDist, { recursive: true });
  fs.writeFileSync(path.join(devDist, "BUILD_ID"), "development");
  fs.writeFileSync(
    requiredFiles,
    JSON.stringify(
      {
        version: 1,
        config: {
          distDir: ".next/dev",
          cleanDistDir: true,
          trailingSlash: false,
          reactStrictMode: null,
          images: { unoptimized: false },
          experimental: {}
        },
        appDir: process.cwd(),
        relativeAppDir: "",
        files: [],
        ignore: []
      },
      null,
      2
    )
  );
}
ensureRequiredFiles();
setInterval(ensureRequiredFiles, 1000).unref();

startServer({
  dir: process.cwd(),
  isDev: true,
  hostname: "127.0.0.1",
  port: Number(process.env.PORT || 3000),
  allowRetry: false
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
