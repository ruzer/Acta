import type { OrganizeContext } from "./questionnaire-presentation";
const modes = ["write", "organize", "publish"];
const keys = ["mode", "q", "topic", "publication", "area", "approach", "page"];
const empty: OrganizeContext = {
  topic: "",
  search: "",
  publication: "",
  area: "",
  approach: "prepare",
  page: 0,
  collapsed: [],
  selectedIds: [],
};
export function readEditorLocation(
  params: URLSearchParams,
  saved?: { mode?: number; organize?: OrganizeContext },
  returningFromView = false,
) {
  const present = keys.some((key) => params.has(key));
  const base = { ...empty, ...saved?.organize };
  // A link back from review may reuse the editor context. Browser history and
  // reload restore the URL itself, including an entry with no filters.
  if (!present && returningFromView)
    return { mode: saved?.mode ?? 1, organize: base };
  const index = modes.indexOf(params.get("mode") ?? "organize");
  const page = params.get("page") ?? "1";
  return {
    mode: index < 0 ? 1 : index,
    organize: {
      ...base,
      topic: params.get("topic") ?? "",
      search: params.get("q") ?? "",
      publication: ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(
        params.get("publication") ?? "",
      )
        ? params.get("publication")!
        : "",
      area: params.get("area") ?? "",
      approach:
        params.get("approach") === "analyze"
          ? ("analyze" as const)
          : ("prepare" as const),
      page: /^\d{1,6}$/.test(page) ? Math.max(0, Number(page) - 1) : 0,
    },
  };
}
export function writeEditorLocation(
  params: URLSearchParams,
  mode: number,
  context: OrganizeContext,
) {
  const next = new URLSearchParams(params);
  for (const key of keys) next.delete(key);
  next.set("mode", modes[mode] ?? "organize");
  next.set("approach", context.approach);
  for (const [key, value] of Object.entries({
    q: context.search,
    topic: context.topic,
    publication: context.publication,
    area: context.area,
  }))
    if (value) next.set(key, value);
  if (context.page > 0) next.set("page", String(context.page + 1));
  return next;
}
