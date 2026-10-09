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
    inbox: "M3 13h5l1.5 3h5l1.5-3h5M5.5 5h13L21 13v6H3v-6l2.5-8Z",
    list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
    folder:
      "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z",
    menu: "M4 7h16M4 12h16M4 17h16",
    chat: "M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6A8 8 0 1 1 21 12Z",
    building:
      "M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 9h3a1 1 0 0 1 1 1v11M3 21h18M9 7h2M9 11h2M9 15h2",
    users:
      "M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.5 3.5 0 0 1 0 6.6",
    plus: "M12 5v14M5 12h14",
  };
  return (
    <svg
      aria-hidden="true"
      data-icon={name in paths ? name : "check"}
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
