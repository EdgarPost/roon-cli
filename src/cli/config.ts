import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Config } from "../shared/types.js";

const CONFIG_DIR = join(homedir(), ".config", "roon-cli");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

let cachedConfig: Config | null = null;

export function getConfig(): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const defaultConfig: Config = {
    defaultZone: undefined,
    coreHost: undefined,
    corePort: undefined,
    socketPath: undefined,
  };

  if (!existsSync(CONFIG_FILE)) {
    cachedConfig = defaultConfig;
    return defaultConfig;
  }

  try {
    const fileContent = readFileSync(CONFIG_FILE, "utf-8");
    const userConfig = JSON.parse(fileContent) as Partial<Config>;

    cachedConfig = {
      ...defaultConfig,
      ...userConfig,
    };

    return cachedConfig;
  } catch (err) {
    console.error(`Warning: Failed to read config file: ${err}`);
    cachedConfig = defaultConfig;
    return defaultConfig;
  }
}

export function getConfigPath(): string {
  return CONFIG_FILE;
}

export function getConfigDir(): string {
  return CONFIG_DIR;
}
