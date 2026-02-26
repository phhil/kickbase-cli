export interface RuntimeOptions {
  json: boolean;
  verbose: boolean;
}

const runtimeOptions: RuntimeOptions = {
  json: !process.stdout.isTTY,
  verbose: false,
};

export function setRuntimeOptions(updates: Partial<RuntimeOptions>): void {
  Object.assign(runtimeOptions, updates);
}

export function getRuntimeOptions(): RuntimeOptions {
  return { ...runtimeOptions };
}

export function isJsonMode(): boolean {
  return runtimeOptions.json;
}

export function isVerboseMode(): boolean {
  return runtimeOptions.verbose;
}
