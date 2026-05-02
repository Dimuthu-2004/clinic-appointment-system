const { execFileSync, spawn } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const shouldClear = args.includes("--clear");
const shouldUseTunnel = args.includes("--tunnel");
const shouldUseLocalhost = args.includes("--localhost");
const requestedMode = shouldUseTunnel ? "tunnel" : shouldUseLocalhost ? "localhost" : "lan";

function clearMetroPort() {
  if (process.platform !== "win32") {
    return;
  }

  const command = [
    "$pids = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique",
    "foreach ($id in $pids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }",
  ].join("; ");

  try {
    execFileSync("powershell.exe", ["-NoProfile", "-Command", command], {
      stdio: "ignore",
    });
  } catch {
    // If port cleanup fails, Expo will still prompt with the port conflict details.
  }
}

clearMetroPort();

const expoCli = path.join(__dirname, "..", "node_modules", "expo", "bin", "cli");
const projectRoot = path.join(__dirname, "..");
const tunnelFailurePatterns = [
  "failed to start tunnel",
  "remote gone away",
  "ngrok",
];

function buildExpoArgs(mode) {
  const expoArgs = [expoCli, "start", `--${mode}`];

  if (shouldClear) {
    expoArgs.push("--clear");
  }

  return expoArgs;
}

function runExpo(mode, { allowFallback = false } = {}) {
  const expoArgs = buildExpoArgs(mode);
  const child = spawn(process.execPath, expoArgs, {
    cwd: projectRoot,
    stdio: ["inherit", "pipe", "pipe"],
  });

  let combinedOutput = "";

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    process.stdout.write(text);
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    combinedOutput += text;
    process.stderr.write(text);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    const normalizedOutput = combinedOutput.toLowerCase();
    const shouldFallbackToLan =
      allowFallback &&
      code !== 0 &&
      tunnelFailurePatterns.some((pattern) => normalizedOutput.includes(pattern));

    if (shouldFallbackToLan) {
      process.stdout.write(
        "\nTunnel startup failed because Ngrok is unavailable, so the project is automatically falling back to LAN mode.\n" +
          "Use this repo's launcher with `npm run start:tunnel` or `npm run start:tunnel:clear` when you want tunnel mode with automatic LAN fallback.\n"
      );
      clearMetroPort();
      runExpo("lan");
      return;
    }

    process.exit(code ?? 0);
  });
}

runExpo(requestedMode, { allowFallback: shouldUseTunnel });
