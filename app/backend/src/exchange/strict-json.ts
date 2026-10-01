/** Parse bounded JSON without accepting duplicate keys or prototype-bearing properties. */
export class FileIssue extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(message);
  }
}
export function parseExactJson(
  bytes: Buffer,
  maxBytes = 5 * 1024 * 1024,
  maxDepth = 20,
): unknown {
  if (bytes.length > maxBytes)
    throw new FileIssue("", "El archivo supera el límite de 5 MiB.");
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new FileIssue("", "El archivo debe usar UTF-8.");
  }
  let i = 0;
  const fail = (
    path: string,
    message = "El archivo no contiene JSON válido.",
  ): never => {
    throw new FileIssue(path, message);
  };
  const ws = () => {
    while (/[\x20\t\r\n]/.test(text[i] ?? "x")) i++;
  };
  const str = (path: string): string => {
    const start = i++;
    while (i < text.length) {
      if (text[i] === '"') {
        i++;
        try {
          return JSON.parse(text.slice(start, i)) as string;
        } catch {
          return fail(path);
        }
      }
      if (text[i] === "\\") i++;
      i++;
    }
    return fail(path);
  };
  const pointer = (s: string) => s.replaceAll("~", "~0").replaceAll("/", "~1");
  const value = (path: string, depth: number): unknown => {
    if (depth > maxDepth)
      fail(path, "El archivo excede la profundidad permitida.");
    ws();
    const ch = text[i];
    if (ch === '"') return str(path);
    if (ch === "{") {
      i++;
      ws();
      const result: Record<string, unknown> = Object.create(null);
      const keys = new Set<string>();
      if (text[i] === "}") {
        i++;
        return result;
      }
      while (i < text.length) {
        ws();
        if (text[i] !== '"') fail(path);
        const key = str(path),
          p = path + "/" + pointer(key);
        if (keys.has(key)) fail(p, "Esta propiedad aparece más de una vez.");
        if (["__proto__", "prototype", "constructor"].includes(key))
          fail(p, "Propiedad no permitida.");
        keys.add(key);
        ws();
        if (text[i++] !== ":") fail(p);
        result[key] = value(p, depth + 1);
        ws();
        const end = text[i++];
        if (end === "}") return result;
        if (end !== ",") fail(path);
      }
      return fail(path);
    }
    if (ch === "[") {
      i++;
      ws();
      const result: unknown[] = [];
      if (text[i] === "]") {
        i++;
        return result;
      }
      while (i < text.length) {
        result.push(value(path + "/" + result.length, depth + 1));
        ws();
        const end = text[i++];
        if (end === "]") return result;
        if (end !== ",") fail(path);
      }
      return fail(path);
    }
    const match =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(i),
      );
    if (!match) return fail(path);
    i += match[0].length;
    const result: unknown = JSON.parse(match[0]);
    if (typeof result === "number" && !Number.isFinite(result))
      fail(path, "Número fuera de rango.");
    return result;
  };
  const result = value("", 1);
  ws();
  if (i !== text.length) fail("");
  return result;
}
