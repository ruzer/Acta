import {
  UnprocessableEntityException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  Worker,
  isMainThread,
  parentPort,
  workerData,
} from "node:worker_threads";
import { PDFDocument, PDFDict, PDFName, PDFArray, PDFStream } from "pdf-lib";
import sharp from "sharp";
import { fromBuffer, Entry, ZipFile } from "yauzl";
import { XMLValidator, XMLParser } from "fast-xml-parser";
import { crc32 } from "node:zlib";
export function evidenceLimits() {
  const fileBytes = Number(process.env.EVIDENCE_MAX_BYTES || 20 * 1024 * 1024);
  const attachments = Number(process.env.EVIDENCE_MAX_ATTACHMENTS || 10);
  const projectBytes = Number(
    process.env.EVIDENCE_PROJECT_BYTES || 2 * 1024 * 1024 * 1024,
  );
  if (
    ![fileBytes, attachments, projectBytes].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    ) ||
    fileBytes > 100 * 1024 * 1024 ||
    attachments > 100
  )
    throw new Error("InvalidEvidenceLimits");
  return { fileBytes, attachments, projectBytes };
}
export function validateFilename(name: string) {
  if (
    [...name].some(
      (c) =>
        c.charCodeAt(0) < 32 ||
        (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159),
    ) ||
    name.length > 180 ||
    name !== name.trim() ||
    name.startsWith(".") ||
    /[/\\:<>|?*%\u202a-\u202e\u2066-\u2069]/u.test(name) ||
    name.includes("..") ||
    !/\.(pdf|docx|xlsx|png|jpe?g)$/i.test(name)
  )
    throw new UnprocessableEntityException(
      "Usa un nombre sencillo y un archivo PDF, DOCX, XLSX, PNG o JPEG.",
    );
}
async function office(bytes: Buffer, ext: string) {
  const zip = await new Promise<ZipFile>((resolve, reject) =>
    fromBuffer(
      bytes,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (e, z) => (e || !z ? reject(e) : resolve(z)),
    ),
  );
  const files = new Map<string, Buffer>();
  let total = 0,
    count = 0;
  await new Promise<void>((resolve, reject) => {
    const fail = (e: unknown) => {
      zip.close();
      reject(e);
    };
    zip.on("error", fail);
    zip.on("end", resolve);
    zip.on("entry", (entry: Entry) => {
      void (async () => {
        const name = entry.fileName;
        if (
          ++count > 2000 ||
          entry.isEncrypted() ||
          ![0, 8].includes(entry.compressionMethod) ||
          name.startsWith("/") ||
          name.includes("..") ||
          name.includes("\\") ||
          files.has(name) ||
          /vba|macro|activeX|embeddings/i.test(name)
        )
          throw new Error("UnsafeOfficeEntry");
        total += entry.uncompressedSize;
        if (
          total > 64 * 1024 * 1024 ||
          entry.uncompressedSize > 16 * 1024 * 1024 ||
          (entry.uncompressedSize > 1024 * 1024 &&
            entry.uncompressedSize > entry.compressedSize * 100)
        )
          throw new Error("ZipLimits");
        if (name.endsWith("/")) {
          zip.readEntry();
          return;
        }
        if (!/\.(xml|rels|png|jpg|jpeg)$/i.test(name))
          throw new Error("UninspectableOfficePart");
        const stream = await new Promise<NodeJS.ReadableStream>((res, rej) =>
          zip.openReadStream(entry, (e, s) => (e || !s ? rej(e) : res(s))),
        );
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of stream) {
          const b = Buffer.from(chunk);
          size += b.length;
          if (size > entry.uncompressedSize) throw new Error("ZipSize");
          chunks.push(b);
        }
        const data = Buffer.concat(chunks);
        if (crc32(data) !== entry.crc32) throw new Error("ZipCRC");
        if (/\.(xml|rels)$/i.test(name)) {
          const xml = data.toString("utf8");
          if (
            /<!DOCTYPE|<!ENTITY|macroEnabled|vbaProject|TargetMode\s*=\s*["']External/i.test(
              xml,
            ) ||
            XMLValidator.validate(xml) !== true
          )
            throw new Error("UnsafeOfficeXML");
        }
        if (/\.(png|jpe?g)$/i.test(name)) await inspectFile(data, name);
        files.set(name, data);
        zip.readEntry();
      })().catch(fail);
    });
    zip.readEntry();
  });
  const content = files.get("[Content_Types].xml")?.toString("utf8") || "";
  const main = ext === "docx" ? "word/document.xml" : "xl/workbook.xml";
  const mime =
    ext === "docx"
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (
    !files.has("_rels/.rels") ||
    !files.has(main) ||
    !content.includes(
      ext === "docx"
        ? "wordprocessingml.document.main+xml"
        : "spreadsheetml.sheet.main+xml",
    )
  )
    throw new Error("OfficeStructure");
  const parser = new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    processEntities: false,
  });
  const namespaceParser = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
  });
  function requireRoot(path: string, localName: string, namespace: string) {
    const data = files.get(path);
    if (!data) throw new Error("OfficeMissingPart");
    const xml = namespaceParser.parse(data.toString("utf8")) as Record<
      string,
      unknown
    >;
    const roots = Object.keys(xml).filter((key) => !key.startsWith("?"));
    if (roots.length !== 1) throw new Error("OfficeRoot");
    const key = roots[0]!;
    const parts = key.split(":");
    const node = xml[key] as Record<string, unknown> | undefined;
    const nsKey = parts.length === 2 ? "@_xmlns:" + parts[0] : "@_xmlns";
    if (parts.at(-1) !== localName || !node || node[nsKey] !== namespace)
      throw new Error("OfficeNamespace");
    return (
      parser.parse(data.toString("utf8")) as Record<
        string,
        Record<string, unknown>
      >
    )[localName]!;
  }
  const packageNamespace = "http://schemas.openxmlformats.org/package/2006/";
  requireRoot(
    "[Content_Types].xml",
    "Types",
    packageNamespace + "content-types",
  );
  requireRoot(
    "_rels/.rels",
    "Relationships",
    packageNamespace + "relationships",
  );
  const types = parser.parse(content) as {
    Types?: { Override?: Record<string, string> | Record<string, string>[] };
  };
  const overrides = types.Types?.Override;
  const list = overrides
    ? Array.isArray(overrides)
      ? overrides
      : [overrides]
    : [];
  if (
    !list.some(
      (x) =>
        x["@_PartName"] === "/" + main &&
        x["@_ContentType"] === mime + ".main+xml",
    )
  )
    throw new Error("OfficeContentType");
  const relationships = parser.parse(
    files.get("_rels/.rels")!.toString("utf8"),
  ) as {
    Relationships?: {
      Relationship?: Record<string, string> | Record<string, string>[];
    };
  };
  const rels = relationships.Relationships?.Relationship;
  const rootLinks = rels ? (Array.isArray(rels) ? rels : [rels]) : [];
  if (
    !rootLinks.some(
      (x) =>
        x["@_Type"] ===
          "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" &&
        x["@_Target"] === main,
    )
  )
    throw new Error("OfficeRootRelationship");
  const namespace =
    "http://schemas.openxmlformats.org/" +
    (ext === "docx" ? "wordprocessingml/2006/main" : "spreadsheetml/2006/main");
  const mainXml = requireRoot(
    main,
    ext === "docx" ? "document" : "workbook",
    namespace,
  );
  if (ext === "docx") {
    if (!Object.hasOwn(mainXml, "body")) throw new Error("OfficeBody");
  } else {
    const sheets = mainXml.sheets as
      { sheet?: Record<string, string> | Record<string, string>[] } | undefined;
    const sheetList = sheets?.sheet
      ? Array.isArray(sheets.sheet)
        ? sheets.sheet
        : [sheets.sheet]
      : [];
    const links = requireRoot(
      "xl/_rels/workbook.xml.rels",
      "Relationships",
      packageNamespace + "relationships",
    );
    const relations = links.Relationship as
      Record<string, string> | Record<string, string>[] | undefined;
    const list = relations
      ? Array.isArray(relations)
        ? relations
        : [relations]
      : [];
    if (!sheetList.length) throw new Error("OfficeSheets");
    for (const sheet of sheetList) {
      const relation = list.find(
        (r) =>
          r["@_Id"] === sheet["@_id"] &&
          r["@_Type"] ===
            "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet",
      );
      const target = relation?.["@_Target"];
      if (!target || target.includes("..") || target.includes("\\"))
        throw new Error("OfficeWorksheet");
      const worksheet = requireRoot(
        target.startsWith("/") ? target.slice(1) : "xl/" + target,
        "worksheet",
        namespace,
      );
      if (!Object.hasOwn(worksheet, "sheetData"))
        throw new Error("OfficeSheetData");
    }
  }
  return mime;
}
export async function inspectFile(
  bytes: Buffer,
  name: string,
): Promise<string> {
  const ext = name.split(".").at(-1)!.toLowerCase();
  if (ext === "pdf") {
    if (
      !bytes.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
      !/%%EOF\s*$/.test(bytes.subarray(-1024).toString("latin1"))
    )
      throw new Error("PDFStructure");
    const pdf = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    if (pdf.isEncrypted || pdf.getPageCount() < 1 || pdf.getPageCount() > 10000)
      throw new Error("PDFStructure");
    const forbidden = new Set([
      "JavaScript",
      "JS",
      "Launch",
      "EmbeddedFiles",
      "EmbeddedFile",
      "RichMedia",
      "XFA",
      "OpenAction",
      "AA",
    ]);
    const visited = new Set<unknown>();
    function check(obj: unknown) {
      if (visited.has(obj)) return;
      visited.add(obj);
      if (obj instanceof PDFName && forbidden.has(obj.decodeText()))
        throw new Error("ActivePDF");
      if (obj instanceof PDFStream) check(obj.dict);
      if (obj instanceof PDFDict)
        for (const [key, val] of obj.entries()) {
          check(key);
          check(val);
        }
      if (obj instanceof PDFArray) for (const val of obj.asArray()) check(val);
    }
    for (const [, obj] of pdf.context.enumerateIndirectObjects()) check(obj);
    return "application/pdf";
  }
  if (["png", "jpg", "jpeg"].includes(ext)) {
    const isPng = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg =
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes.at(-2) === 255 &&
      bytes.at(-1) === 217;
    if (ext === "png" ? !isPng : !isJpeg) throw new Error("ImageSignature");
    const im = sharp(bytes, {
      limitInputPixels: 16_000_000,
      failOn: "warning",
    });
    const meta = await im.metadata();
    if (
      meta.format !== (ext === "png" ? "png" : "jpeg") ||
      (meta.pages || 1) > 1
    )
      throw new Error("ImageStructure");
    await im.raw().toBuffer(); // Decode pixels, metadata alone does not detect truncation.
    return ext === "png" ? "image/png" : "image/jpeg";
  }
  if (
    ["docx", "xlsx"].includes(ext) &&
    bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
  )
    return office(bytes, ext);
  throw new Error("UnsupportedFile");
}
let activeInspections = 0;
export async function validateFile(bytes: Buffer, name: string) {
  validateFilename(name);
  if (bytes.length > evidenceLimits().fileBytes)
    throw new PayloadTooLargeException(
      "El archivo excede el tamaño permitido.",
    );
  if (!bytes.length)
    throw new UnprocessableEntityException("El archivo está vacío.");
  if (activeInspections >= 2)
    throw new ServiceUnavailableException(
      "Hay otras cargas en proceso. Inténtalo de nuevo en un momento.",
    );
  activeInspections++;
  try {
    return await new Promise<string>((resolve, reject) => {
      const worker = new Worker(new URL(import.meta.url), {
        workerData: { bytes, name },
        resourceLimits: { maxOldGenerationSizeMb: 128 },
      });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error("InspectionTimeout"));
      }, 15000);
      worker.once("message", (message: { mime?: string }) => {
        clearTimeout(timer);
        void worker.terminate();
        if (message.mime) resolve(message.mime);
        else reject(new Error("InvalidFile"));
      });
      worker.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0) reject(new Error("InspectionFailed"));
      });
    });
  } catch {
    throw new UnprocessableEntityException(
      "No se pudo comprobar el archivo. Usa un documento sin cifrado, macros, contenido activo o daños.",
    );
  } finally {
    activeInspections--;
  }
}
if (!isMainThread) {
  const data = workerData as { bytes: Uint8Array; name: string };
  inspectFile(Buffer.from(data.bytes), data.name)
    .then((mime) => parentPort?.postMessage({ mime }))
    .catch(() => parentPort?.postMessage({ error: true }));
}
