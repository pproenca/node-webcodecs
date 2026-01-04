#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ffmpeg_paths_lib_1 = require("./ffmpeg-paths-lib");
const mode = process.argv[2] ?? 'lib';
const projectRoot = (0, ffmpeg_paths_lib_1.resolveProjectRoot)();
if (mode === 'lib') {
    const result = (0, ffmpeg_paths_lib_1.resolveLibFlags)(projectRoot, process.env, process.platform);
    if (result) {
        console.log(result);
        process.exit(0);
    }
    process.exit(1);
}
if (mode === 'include') {
    const result = (0, ffmpeg_paths_lib_1.resolveIncludeFlags)(projectRoot, process.env);
    if (result) {
        console.log(result);
        process.exit(0);
    }
    process.exit(1);
}
if (mode === 'rpath') {
    process.exit(0);
}
console.error(`Unknown mode: ${mode}`);
process.exit(1);
