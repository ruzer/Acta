// Built-in Node APIs only: JSON, streaming hashes and local preflight without Docker.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  chmod,
  lstat,
  readFile,
  readdir,
  rename,
  realpath,
  writeFile,
} from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
const volumes = [
  "pgdata",
  "objectdata",
  "evidence",
  "db-secrets",
  "api-secrets",
  "object-secrets",
  "provision-secrets",
];
const error = (message) => {
  throw Error(message);
};
async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
async function digest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export async function outputPath(value) {
  if (!value || /[\r\n,:]/.test(value)) error("Salida inválida.");
  const path = resolve(value);
  if ((await exists(path)) || (await exists(path + ".INCOMPLETE")))
    error("La salida ya existe (o existe su copia INCOMPLETE).");
  const parent = await realpath(dirname(path)).catch(() =>
    error("El padre de la salida no existe."),
  );
  if (!(await lstat(parent)).isDirectory())
    error("El padre no es un directorio.");
  for (let p = parent; ; p = dirname(p)) {
    if (
      (await exists(join(p, ".git"))) ||
      ((await exists(join(p, "HEAD"))) && (await exists(join(p, "objects"))))
    )
      error("La salida no puede estar dentro de un árbol Git.");
    if (p === dirname(p)) break;
  }
  await access(parent, 2);
  return join(parent, basename(path));
}
export async function helperImage(root) {
  if (/[\r\n,:]/.test(root)) error("Ruta del despliegue no soportada.");
  const dockerfile = await readFile(
    join(root, "app/backend/Dockerfile"),
    "utf8",
  );
  const image = dockerfile.match(/^FROM (node:[^\s]+) AS runtime$/m)?.[1];
  if (!image) error("No se encontró la imagen Node runtime del Dockerfile.");
  return image;
}
export function checkConfig(config, project) {
  for (const suffix of volumes) {
    const v = config.volumes?.[suffix];
    if (!v || v.name !== `${project}_${suffix}` || v.external)
      error("Volúmenes personalizados/externos no soportados.");
  }
  if (Object.keys(config.volumes).length !== 7)
    error("La receta requiere exactamente siete volúmenes.");
  const services = config.services;
  if (
    services.backend?.environment?.STORAGE_PROVIDER !== "S3" ||
    services.backend?.environment?.S3_ENDPOINT !==
      "http://object-storage:9000" ||
    services["object-storage"]?.build?.dockerfile !==
      "docker/versity/Dockerfile"
  )
    error("Solo se admite el despliegue DEFAULT con VersityGW local.");
  if (
    services.postgres?.environment?.POSTGRES_USER !== "requirements_owner" ||
    services.postgres?.environment?.POSTGRES_DB !== "requirements"
  )
    error("Identidad PostgreSQL distinta de la receta.");
  for (const [service, target, source] of [
    ["postgres", "/var/lib/postgresql", "pgdata"],
    ["backend", "/app/.private-evidence", "evidence"],
    ["object-storage", "/data", "objectdata"],
  ]) {
    if (
      !services[service]?.volumes?.some(
        (v) =>
          v.type === "volume" && v.source === source && v.target === target,
      )
    )
      error("Los montajes no corresponden a la receta.");
  }
}
export async function createManifest(directory, metadata) {
  const files = [];
  for (const name of (await readdir(directory)).sort()) {
    if (name === "INCOMPLETE") continue;
    const path = join(directory, name);
    const st = await lstat(path);
    if (!st.isFile() || st.isSymbolicLink() || name === "manifest.json")
      error("Archivo inesperado al crear manifiesto.");
    await chmod(path, 0o600);
    files.push({ path: name, size: st.size, sha256: await digest(path) });
  }
  await writeFile(
    join(directory, "INCOMPLETE"),
    JSON.stringify({ formatVersion: 1, ...metadata, files }, null, 2) + "\n",
    { flag: "w", mode: 0o600 },
  );
  await rename(join(directory, "INCOMPLETE"), join(directory, "manifest.json"));
}
async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "out") console.log(await outputPath(args[0]));
  else if (mode === "helper") console.log(await helperImage(args[0]));
  else if (mode === "config") {
    let text = "";
    for await (const chunk of process.stdin) text += chunk;
    checkConfig(JSON.parse(text), args[0]);
  } else if (mode === "manifest") {
    const [
      directory,
      root,
      project,
      postgresVersion,
      versityVersion,
      images,
      controlCounts,
      runningServices,
    ] = args;
    let commit = null,
      describe = null;
    try {
      commit = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      describe = execFileSync(
        "git",
        ["-C", root, "describe", "--always", "--dirty"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
    } catch {
      /* A deployment archive need not contain Git history. */
    }
    await createManifest(directory, {
      createdAt: new Date().toISOString(),
      project,
      actaVersion: JSON.parse(
        await readFile(join(root, "package.json"), "utf8"),
      ).version,
      commit,
      describe,
      postgresVersion,
      versityVersion,
      images: JSON.parse(images),
      controlCounts: JSON.parse(controlCounts),
      runningServices: runningServices.split(/\s+/).filter(Boolean),
    });
  } else error("Operación de manifiesto desconocida.");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((e) => {
    console.error(`ERROR: ${e.message}`);
    process.exitCode = 1;
  });
}
