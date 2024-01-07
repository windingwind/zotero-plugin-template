import { main as build, esbuildOptions } from "./build.mjs";
import { openDevToolScript, reloadScript } from "./scripts.mjs";
// import { main as startZotero } from "./start.mjs";
import { Logger } from "./utils.mjs";
import cmd from "./zotero-cmd.json" assert { type: "json" };
import { execSync } from "child_process";
import chokidar from "chokidar";
import { context } from "esbuild";
import path from "path";
import { exit } from "process";
import webExt from "web-ext";

process.env.NODE_ENV = "development";

const { zoteroBinPath, profilePath } = cmd.exec;

const startZoteroCmd = `"${zoteroBinPath}" --debugger --purgecaches -profile "${profilePath}"`;

async function watch() {
  const watcher = chokidar.watch(["src/**", "addon/**"], {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
  });

  const esbuildCTX = await context(esbuildOptions);
  let currentTimeout = null;

  watcher
    .on("ready", () => {
      Logger.info("Server Ready! \n");
    })
    .on("change", async (path) => {
      Logger.info(`${path} changed at ${new Date().toLocaleTimeString()}`);

      async function rebuild() {
        if (path.startsWith("src")) {
          await esbuildCTX.rebuild();
        } else if (path.startsWith("addon")) {
          await build();
        }
      }

      clearTimeout(currentTimeout);
      currentTimeout = setTimeout(async () => {
        await rebuild().catch((err) => {
          // Do not abort the watcher when errors occur in builds triggered by the watcher.
          Logger.error(err);
        });
      }, 500);
    })
    .on("error", (err) => {
      Logger.error("Server start failed!", err);
    });
}

async function startWebExt() {
  await webExt.cmd.run(
    {
      firefox: zoteroBinPath,
      firefoxProfile: profilePath,
      sourceDir: path.resolve("build/addon"),
      keepProfileChanges: true,
      args: ["--debugger", "--purgecaches"],
      // browserConsole: true,
    },
    {
      // These are non CLI related options for each function.
      // You need to specify this one so that your NodeJS application
      // can continue running after web-ext is finished.
      shouldExitProgram: false,
    },
  );
}

// function reload() {
//     Logger.debug("Reloading...");
//     const url = `zotero://ztoolkit-debug/?run=${encodeURIComponent(reloadScript)}`;
//     const command = `${startZoteroCmd} -url "${url}"`;
//     execSync(command, { timeout: 8000 });
// }

function openDevTool() {
  Logger.debug("Open dev tools...");
  const url = `zotero://ztoolkit-debug/?run=${encodeURIComponent(
    openDevToolScript,
  )}`;
  const command = `${startZoteroCmd} -url "${url}"`;
  execSync(command);
}

async function main() {
  // build
  await build();

  // start Zotero
  // startZotero(openDevTool);
  await startWebExt();

  // watch
  await watch();
}

main().catch((err) => {
  Logger.error(err);
  // execSync("node scripts/stop.mjs");
  exit(1);
});

process.on("SIGINT", (code) => {
  execSync("node scripts/stop.mjs");
  Logger.info(`Server terminated with signal ${code}.`);
  exit(0);
});
