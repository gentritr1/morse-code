#!/usr/bin/env node
/**
 * Deploy artifact builder. Zero dependencies, Node >= 18.
 *
 * Development stays build-free: `index.html` at the repo root loads unhashed
 * `./src/*.js` and `./styles/*.css` under `python3 -m http.server`. This script
 * only produces `dist/`, the thing Vercel serves, where every asset filename
 * carries a content hash so it can be sent with `immutable` and never
 * revalidated. See ARCHITECTURE.md "Deployment".
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const ENTRY = join(ROOT, "src/app.js");

/** `./features/guide.js` and `import("…")` alike; relative specifiers only. */
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']+)\2/g;
const hash8 = (text) => createHash("sha256").update(text).digest("hex").slice(0, 8);
const hashedName = (path, text) => path.replace(/\.([^.\/]+)$/, `.${hash8(text)}.$1`);
const rel = (path) => relative(ROOT, path).split("\\").join("/");

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : 1))
    .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]));
}

/** Dependency-order walk: a module is emitted only after every module it imports. */
const modules = new Map(); // abs path -> { source, deps: Map<specifier, abs path> }
function load(abs, stack = new Set()) {
  if (modules.has(abs)) return;
  if (stack.has(abs)) throw new Error(`import cycle through ${rel(abs)} — content hashes cannot be ordered`);
  const source = readFileSync(abs, "utf8");
  const deps = new Map();
  for (const [, , , specifier] of source.matchAll(SPECIFIER)) {
    const target = resolve(dirname(abs), specifier);
    if (!existsSync(target)) throw new Error(`${rel(abs)} imports ${specifier}, which does not exist`);
    deps.set(specifier, target);
  }
  stack.add(abs);
  for (const target of [...deps.values()].sort()) load(target, stack);
  stack.delete(abs);
  modules.set(abs, { source, deps }); // insertion order == dependency order
}

rmSync(DIST, { recursive: true, force: true });
load(ENTRY);

const emitted = new Map(); // abs source path -> hashed path relative to dist root
function emit(abs, text) {
  const out = hashedName(join(DIST, rel(abs)), text);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  emitted.set(abs, relative(DIST, out).split("\\").join("/"));
  return text.length;
}

let bytes = 0;
// 1. JS, leaves first, so a module's own hash covers its rewritten imports.
for (const [abs, { source, deps }] of modules) {
  const rewritten = source.replace(SPECIFIER, (whole, lead, quote, specifier) => {
    const hashedTarget = emitted.get(deps.get(specifier));
    if (!hashedTarget) throw new Error(`${rel(abs)}: ${specifier} was not emitted before its importer`);
    // Replace the basename only: `posix.join` would eat the leading "./" and
    // turn a relative specifier into a bare one, which no browser resolves.
    return `${lead}${quote}${specifier.replace(/[^/]+$/, posix.basename(hashedTarget))}${quote}`;
  });
  bytes += emit(abs, rewritten);
}

// 2. Everything else under src/ and styles/, plus the root CSS and the favicon.
const others = [...walk(join(ROOT, "styles")), join(ROOT, "styles.css"), join(ROOT, "favicon.svg")]
  .concat(walk(join(ROOT, "src")).filter((path) => !modules.has(path)));
for (const abs of others) {
  const text = readFileSync(abs, "utf8");
  if (/@import|url\(\s*["']?\.{0,2}\//.test(text)) throw new Error(`${rel(abs)} references another asset; teach the build to rewrite it`);
  bytes += emit(abs, text);
}

// 3. index.html: every local reference hashed, and one modulepreload per module.
const preloads = [...modules.keys()]
  .map((abs) => `    <link rel="modulepreload" href="./${emitted.get(abs)}" />`)
  .join("\n");
let html = readFileSync(join(ROOT, "index.html"), "utf8");
for (const [abs, hashedPath] of emitted) {
  const from = `"./${rel(abs)}"`;
  if (html.includes(from)) html = html.split(from).join(`"./${hashedPath}"`);
}
const scriptTag = `    <script type="module" src="./${emitted.get(ENTRY)}"></script>`;
if (!html.includes(scriptTag)) throw new Error("index.html no longer carries the module entry script tag");
html = html.replace(scriptTag, `${preloads}\n${scriptTag}`);
const unhashed = [...html.matchAll(/"\.\/([^"]+\.(?:js|css|svg))"/g)].filter(([, path]) => !/\.[0-9a-f]{8}\./.test(path));
if (unhashed.length) throw new Error(`unhashed references left in index.html: ${unhashed.map(([, p]) => p).join(", ")}`);
writeFileSync(join(DIST, "index.html"), html);
bytes += html.length;

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`dist/  ${emitted.size + 1} files, ${kb(bytes)} (${kb(statSync(join(DIST, "index.html")).size)} of it index.html)`);
console.log(`hashed ${emitted.size} assets · ${modules.size} modules preloaded in dependency order`);
