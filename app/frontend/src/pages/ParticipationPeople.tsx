import type { ParticipationView } from "@requirements/contracts";
import { formatDate } from "../branding";
import { Button, DataTable } from "../ui";
import "../participation-people.css";

type Person = ParticipationView["participants"][number];

export function ParticipationSent({ person }: { person: Person }) {
  if (person.assigned === 0) return <span>—</span>;
  // Rounded for readability, but 100% is reserved for all assigned questions.
  const percent =
    person.sent === person.assigned
      ? 100
      : Math.min(99, Math.round((person.sent / person.assigned) * 100));
  const label = `Enviadas ${person.sent} de ${person.assigned} · ${percent} %`;
  return (
    <div className="participation-sent">
      <span>{label}</span>
      <div
        className="participation-sent-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuenow={person.sent}
        aria-valuemax={person.assigned}
      >
        <span style={{ width: `${(person.sent / person.assigned) * 100}%` }} />
      </div>
    </div>
  );
}

export function ParticipationPeople({
  people,
  remind,
}: {
  people: Person[];
  remind: (person: Person) => void;
}) {
  return (
    <div className="participation-people">
      <DataTable
        caption="Participación por persona"
        columns={[
          "Nombre",
          "Área",
          "Enviadas",
          "Pendientes y cambios",
          "Última actividad",
          "Estado",
          "Recordatorio",
        ].map((label) => ({ label }))}
        rows={people.map((person) => ({
          key: person.memberId,
          cells: [
            person.name,
            person.area ?? "Sin área",
            <ParticipationSent person={person} />,
            <div className="participation-counts">
              <span>Obligatorias pendientes: {person.pending}</span>
              <span>Con cambios sin enviar: {person.drafts}</span>
            </div>,
            person.lastActivity
              ? formatDate(person.lastActivity)
              : "Sin actividad",
            person.state,
            <Button
              tone="secondary"
              disabled={person.pending === 0}
              aria-label={`Copiar recordatorio para ${person.name}`}
              onClick={() => remind(person)}
            >
              <span className="participation-reminder-text">
                Copiar recordatorio
              </span>
              <svg
                className="participation-reminder-icon"
                aria-hidden="true"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <rect x="8" y="8" width="12" height="13" rx="2" />
                <path d="M15 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" />
              </svg>
            </Button>,
          ],
        }))}
      />
    </div>
  );
}
