const { execFileSync, spawn } = require("child_process");
const path = require("path");

const args = process.argv.slice(2);
const shouldClear = args.includes("--clear");

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
const expoArgs = [expoCli, "start", "--lan"];

if (shouldClear) {
  expoArgs.push("--clear");
}

const child = spawn(process.execPath, expoArgs, {
  cwd: path.join(__dirname, ".."),
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
