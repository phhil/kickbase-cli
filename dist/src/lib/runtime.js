const runtimeOptions = {
    json: !process.stdout.isTTY,
    verbose: false,
};
export function setRuntimeOptions(updates) {
    Object.assign(runtimeOptions, updates);
}
export function getRuntimeOptions() {
    return { ...runtimeOptions };
}
export function isJsonMode() {
    return runtimeOptions.json;
}
export function isVerboseMode() {
    return runtimeOptions.verbose;
}
