export function ParticipantIcon({ name = "check" }: { name?: string }) {
  const paths: Record<string, string> = {
    check: "m5 12 4 4L19 6",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    back: "M19 12H5m5-5-5 5 5 5",
    clock: "M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    edit: "m15 5 4 4M4 20l4-1L20 7a2 2 0 0 0-4-4L4 15v5Z",
    help: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    send: "m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2",
    flag: "M4 22V3m0 0c6-5 10 5 16 0v11c-6 5-10-5-16 0",
    layers: "m12 2 10 5-10 5L2 7l10-5Zm-10 10 10 5 10-5M2 17l10 5 10-5",
    paperclip:
      "m8 13 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9a7 7 0 0 1 10 10l-8 8",
    chevron: "m9 5 7 7-7 7",
    info: "M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  };
  return (
    <svg
      aria-hidden="true"
      className="participant-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.check} />
    </svg>
  );
}
