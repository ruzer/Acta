// Retain notices for the production dependency closure when bundling the UI.
import {
  readFileSync,
  readdirSync,
  realpathSync,
  existsSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seen = new Set(),
  notices = [];
function dependency(name, from) {
  for (let dir = from; dir.startsWith(root); dir = dirname(dir)) {
    const candidate = join(dir, "node_modules", name, "package.json");
    if (existsSync(candidate)) return dirname(realpathSync(candidate));
  }
  throw Error(`Missing dependency for notice collection: ${name}`);
}
function collect(dir) {
  if (seen.has(dir)) return;
  seen.add(dir);
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  // Workspace code is not assigned a license by this collector.
  if (!pkg.private) {
    const files = readdirSync(dir, { withFileTypes: true }).filter(
      (f) => f.isFile() && /^(licen[cs]e|copying|notice)(\.|$)/i.test(f.name),
    );
    if (!files.length) throw Error(`No license text found for ${pkg.name}`);
    notices.push(
      `\n## ${pkg.name}@${pkg.version}\n` +
        files
          .map((f) => `\n${f.name}\n${readFileSync(join(dir, f.name), "utf8")}`)
          .join("\n"),
    );
  }
  for (const name of Object.keys(pkg.dependencies || {}))
    collect(dependency(name, dir));
}
collect(join(root, "app/frontend"));
writeFileSync(
  join(root, "app/frontend/public/third-party-notices.txt"),
  "Third-party dependency notices. These terms do not license the application's own code.\n" +
    notices.sort().join("\n"),
);
console.log(
  `Collected notices for ${notices.length} frontend production dependencies.`,
);
