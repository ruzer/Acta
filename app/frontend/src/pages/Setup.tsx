import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  appearanceChoices,
  setupAdministratorInput,
  type AppearanceKey,
  type SetupChecks,
  type SetupDefaults,
} from "@requirements/contracts";
import { ApiFailure, api } from "../api";
import { Alert, Button, Input, LoadingState } from "../ui";
import { StatusChip } from "../ui/semantic";
import {
  AccentInput,
  BrandingPreview,
  ExternalInput,
  LocaleSelect,
  TimezoneSelect,
} from "./SettingsFields";
import "./setup.css";

const steps = [
  { id: "welcome", label: "Bienvenida" },
  { id: "administrator", label: "Administrador" },
  { id: "organization", label: "Organización" },
  { id: "storage", label: "Almacenamiento" },
  { id: "appearance", label: "Personalización" },
  { id: "verify", label: "Verificación" },
  { id: "finish", label: "Finalizar" },
] as const;
type StepId = (typeof steps)[number]["id"];
const command = "docker compose exec backend node scripts/setup-token.mjs";
/** What the wizard asks about; the logos and the second entity are set later in Configuración. */
const wizardKeys = [
  "appName",
  "shortName",
  "accent",
  "locale",
  "timezone",
] as const satisfies readonly AppearanceKey[];

type Values = {
  username: string;
  displayName: string;
  password: string;
  confirm: string;
  organizationName: string;
} & Record<AppearanceKey, string>;

/** The code arrives in the address fragment so it never reaches a server log; it is removed at once. */
function codeFromAddress() {
  const match = /^#setup=([A-Za-z0-9_-]+)$/.exec(window.location.hash);
  if (match)
    window.history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
  return match?.[1] ?? "";
}
function stepOf(field: string): StepId {
  if (field.startsWith("administrator")) return "administrator";
  if (field.startsWith("organization")) return "organization";
  if (field.startsWith("appearance")) return "appearance";
  return "verify";
}

/**
 * First-run setup. It only exists while the installation has no administrator
 * and only works with the one-time code the operator issued; nothing here is
 * needed to run Acta, it is the guided way to what the environment and the
 * bootstrap command also do.
 */
export function Setup({ onFinished }: { onFinished: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<StepId>("welcome");
  const [code, setCode] = useState(codeFromAddress);
  const [defaults, setDefaults] = useState<SetupDefaults | null>(null);
  const [values, setValues] = useState<Values | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState<SetupChecks | null>(null);
  const [checking, setChecking] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const index = steps.findIndex((item) => item.id === step);
  // The link may be pasted into a tab that already has Acta open: that only changes the fragment.
  useEffect(() => {
    const onHash = () => {
      const fromLink = codeFromAddress();
      if (fromLink) setCode(fromLink);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  // Moving to another step puts the reader at its heading, announced by name.
  useEffect(() => heading.current?.focus(), [step]);

  // Editing a field withdraws the complaint about it: the next check decides again.
  const errorKeys: Record<string, string> = {
    username: "administrator.username",
    displayName: "administrator.displayName",
    password: "administrator.password",
    confirm: "administrator.confirm",
    organizationName: "organization.name",
  };
  const set = (patch: Partial<Values>) => {
    setValues((current) => (current ? { ...current, ...patch } : current));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) {
        delete next[errorKeys[key] ?? `appearance.${key}`];
        // The password and its confirmation are judged together.
        if (key === "password" || key === "confirm") {
          delete next["administrator.password"];
          delete next["administrator.confirm"];
        }
      }
      return next;
    });
  };
  const external = (key: AppearanceKey) =>
    defaults?.appearance[key].source === "external";

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await api("setupVerify", {}, { token: code.trim() });
      setDefaults(result.defaults);
      const a = result.defaults.appearance;
      setValues({
        username: "",
        displayName: "",
        password: "",
        confirm: "",
        organizationName: result.defaults.organizationName,
        appName: a.appName.value,
        shortName: a.shortName.value,
        accent: a.accent.value,
        locale: a.locale.value,
        timezone: a.timezone.value,
        secondaryName: a.secondaryName.value,
      });
      setStep("administrator");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function validate(current: StepId) {
    if (!values) return true;
    const found: Record<string, string> = {};
    if (current === "administrator") {
      const parsed = setupAdministratorInput.safeParse({
        username: values.username,
        displayName: values.displayName,
        password: values.password,
      });
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          found[`administrator.${issue.path.join(".")}`] = issue.message;
      if (values.password !== values.confirm)
        found["administrator.confirm"] = "Las contraseñas no coinciden.";
      if (
        values.username &&
        values.password.toLowerCase().includes(values.username.toLowerCase())
      )
        found["administrator.password"] =
          "La contraseña no debe contener tu usuario.";
    }
    if (current === "organization" && !values.organizationName.trim())
      found["organization.name"] = "Escribe el nombre de la institución.";
    if (current === "appearance") {
      const open = Object.fromEntries(
        wizardKeys
          .filter((key) => !external(key))
          .map((key) => [key, values[key]]),
      );
      const parsed = appearanceChoices.partial().safeParse(open);
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          found[`appearance.${issue.path.join(".")}`] = issue.message;
    }
    setErrors(found);
    return Object.keys(found).length === 0;
  }
  function next(event?: FormEvent) {
    event?.preventDefault();
    if (!validate(step)) return;
    setMessage("");
    setStep(steps[index + 1]!.id);
  }
  function back() {
    setErrors({});
    setMessage("");
    setStep(steps[index - 1]!.id);
  }

  async function runChecks() {
    setChecking(true);
    setMessage("");
    try {
      setChecks(await api("setupChecks", {}, { token: code.trim() }));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setChecking(false);
    }
  }
  useEffect(() => {
    if ((step === "storage" || step === "verify") && !checks && !checking)
      void runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function finish() {
    if (!values) return;
    setBusy(true);
    setMessage("");
    setErrors({});
    try {
      await api(
        "setupComplete",
        {},
        {
          token: code.trim(),
          administrator: {
            username: values.username,
            displayName: values.displayName.trim(),
            password: values.password,
          },
          organization: { name: values.organizationName.trim() },
          appearance: Object.fromEntries(
            wizardKeys
              .filter((key) => !external(key))
              .map((key) => [key, values[key]]),
          ),
        },
      );
      setValues({ ...values, password: "", confirm: "" });
      void queryClient.invalidateQueries({ queryKey: ["public-branding"] });
      setStep("finish");
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 409) {
        // Someone else finished the installation first: there is nothing left to do here.
        onFinished();
        return;
      }
      if (error instanceof ApiFailure && Object.keys(error.fields).length) {
        setErrors(error.fields);
        setStep(stepOf(Object.keys(error.fields)[0]!));
      }
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = steps[index]!.label;
  return (
    <main className="setup" aria-label="Configuración inicial">
      <header className="setup-head">
        <p className="eyebrow">Acta · Primera configuración</p>
        <h1>Configura tu instalación</h1>
      </header>
      <ol className="setup-steps" aria-label="Pasos de la configuración">
        {steps.map((item, position) => (
          <li
            key={item.id}
            aria-current={item.id === step ? "step" : undefined}
            data-state={
              position < index
                ? "done"
                : position === index
                  ? "current"
                  : "todo"
            }
          >
            <span aria-hidden="true">{position + 1}</span>
            {item.label}
            {position < index && <span className="sr-only"> (hecho)</span>}
          </li>
        ))}
      </ol>
      <section className="setup-panel">
        <h2 tabIndex={-1} ref={heading}>
          {title}
        </h2>
        {message && <Alert error>{message}</Alert>}

        {step === "welcome" && (
          <form onSubmit={verify}>
            <p>
              Esta guía crea a la persona que administrará Acta, nombra a la
              institución y elige su apariencia. Tarda unos minutos y no
              necesitas editar archivos.
            </p>
            <p>
              Para evitar que otra persona tome una instalación nueva, pide al
              operador (quien instaló Acta) el código de instalación:
            </p>
            <pre className="setup-command">
              <code>{command}</code>
            </pre>
            <Input
              label="Código de instalación"
              name="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
              hint="Es de un solo uso y caduca. Si abriste el enlace que muestra el comando, ya viene escrito."
            />
            <Button type="submit" disabled={busy || code.trim().length < 20}>
              {busy ? "Comprobando…" : "Comenzar"}
            </Button>
            <p className="hint">
              ¿Ya configuraste Acta con variables de entorno? Esta guía es
              opcional: crea al administrador con{" "}
              <code>scripts/bootstrap-admin.mjs</code> y no volverá a aparecer.
            </p>
          </form>
        )}

        {values && step === "administrator" && (
          <form onSubmit={next} noValidate>
            <p>
              Esta cuenta administra usuarios, proyectos y la configuración.
              Podrás crear más cuentas después.
            </p>
            <Input
              label="Nombre de usuario"
              name="username"
              value={values.username}
              onChange={(event) => set({ username: event.target.value })}
              autoComplete="username"
              error={errors["administrator.username"]}
              hint="Letras, números, punto, guion o guion bajo."
              required
            />
            <Input
              label="Nombre visible"
              name="displayName"
              value={values.displayName}
              onChange={(event) => set({ displayName: event.target.value })}
              autoComplete="name"
              error={errors["administrator.displayName"]}
              required
            />
            <Input
              label="Contraseña"
              name="password"
              type="password"
              value={values.password}
              onChange={(event) => set({ password: event.target.value })}
              autoComplete="new-password"
              error={errors["administrator.password"]}
              hint="Al menos 12 caracteres. Úsala solo en Acta."
              maxLength={128}
              required
            />
            <Input
              label="Confirma la contraseña"
              name="confirm"
              type="password"
              value={values.confirm}
              onChange={(event) => set({ confirm: event.target.value })}
              autoComplete="new-password"
              error={errors["administrator.confirm"]}
              maxLength={128}
              required
            />
            <Navigation onBack={back} />
          </form>
        )}

        {values && defaults && step === "organization" && (
          <form onSubmit={next} noValidate>
            <Input
              label="Nombre de la institución"
              name="organizationName"
              value={values.organizationName}
              onChange={(event) =>
                set({ organizationName: event.target.value })
              }
              autoComplete="organization"
              error={errors["organization.name"]}
              hint="Aparece en la pantalla de acceso y en el encabezado."
              required
            />
            <Input
              label="Código interno de la instalación"
              value={defaults.organizationCode}
              readOnly
              hint="Lo define la infraestructura (ORGANIZATION_CODE). No es un dato de acceso."
            />
            <Navigation onBack={back} />
          </form>
        )}

        {step === "storage" && (
          <form onSubmit={next}>
            <p>
              Acta guarda la evidencia en un almacenamiento privado. Lo define
              la infraestructura de esta instalación; aquí solo se comprueba que
              responde.
            </p>
            <ChecksList checks={checks} checking={checking} only="storage" />
            <p className="hint">
              El proveedor y sus credenciales se administran fuera de la
              aplicación (variables <code>S3_*</code>) y no se pueden cambiar
              desde Acta.
            </p>
            <div className="actions">
              <Button
                tone="secondary"
                onClick={() => void runChecks()}
                disabled={checking}
              >
                Probar de nuevo
              </Button>
            </div>
            <Navigation onBack={back} />
          </form>
        )}

        {values && defaults && step === "appearance" && (
          <form onSubmit={next} noValidate>
            <p>
              Elige cómo se llama y cómo se ve tu instalación. Podrás cambiarlo
              después en Configuración y añadir el logotipo y el favicon.
            </p>
            <div className="setup-appearance">
              <div>
                {external("appName") ? (
                  <ExternalInput
                    label="Nombre de la aplicación"
                    field={defaults.appearance.appName}
                  />
                ) : (
                  <Input
                    label="Nombre de la aplicación"
                    value={values.appName}
                    onChange={(event) => set({ appName: event.target.value })}
                    error={errors["appearance.appName"]}
                    maxLength={100}
                  />
                )}
                {external("shortName") ? (
                  <ExternalInput
                    label="Nombre corto"
                    field={defaults.appearance.shortName}
                  />
                ) : (
                  <Input
                    label="Nombre corto"
                    value={values.shortName}
                    onChange={(event) => set({ shortName: event.target.value })}
                    error={errors["appearance.shortName"]}
                    hint="Se usa en la barra lateral."
                    maxLength={40}
                  />
                )}
                {external("accent") ? (
                  <ExternalInput
                    label="Color principal"
                    field={defaults.appearance.accent}
                  />
                ) : (
                  <AccentInput
                    value={values.accent}
                    onChange={(accent) => set({ accent })}
                    error={errors["appearance.accent"]}
                  />
                )}
                {external("locale") ? (
                  <ExternalInput
                    label="Formato regional"
                    field={defaults.appearance.locale}
                  />
                ) : (
                  <LocaleSelect
                    value={values.locale}
                    onChange={(locale) => set({ locale })}
                  />
                )}
                {external("timezone") ? (
                  <ExternalInput
                    label="Zona horaria"
                    field={defaults.appearance.timezone}
                  />
                ) : (
                  <TimezoneSelect
                    value={values.timezone}
                    onChange={(timezone) => set({ timezone })}
                  />
                )}
              </div>
              <BrandingPreview
                appName={values.appName}
                shortName={values.shortName}
                organizationName={values.organizationName}
                accent={values.accent}
                logo=""
              />
            </div>
            <Navigation onBack={back} />
          </form>
        )}

        {values && defaults && step === "verify" && (
          <div>
            <p>Revisa los datos antes de crear la instalación.</p>
            <dl className="setup-summary">
              <div>
                <dt>Administrador</dt>
                <dd>
                  {values.displayName} ({values.username.toLowerCase()})
                </dd>
              </div>
              <div>
                <dt>Institución</dt>
                <dd>{values.organizationName}</dd>
              </div>
              <div>
                <dt>Aplicación</dt>
                <dd>
                  {values.appName} · {values.shortName}
                </dd>
              </div>
              <div>
                <dt>Formato y zona horaria</dt>
                <dd>
                  {values.locale} · {values.timezone}
                </dd>
              </div>
            </dl>
            <ChecksList checks={checks} checking={checking} />
            <Navigation
              onBack={back}
              submitLabel={busy ? "Creando…" : "Crear instalación"}
              disabled={busy || checking || checks?.database !== "ok"}
              onSubmit={() => void finish()}
            />
            {checks && checks.storage !== "ok" && (
              <p className="hint">
                El almacenamiento no responde. Puedes terminar la instalación,
                pero no se podrá subir evidencia hasta resolverlo.
              </p>
            )}
          </div>
        )}

        {step === "finish" && (
          <div>
            <Alert>
              <p>
                <strong>La instalación quedó configurada.</strong> El código de
                instalación ya no sirve y esta guía no volverá a aparecer.
              </p>
            </Alert>
            <p>
              Inicia sesión con la cuenta de administración que acabas de crear.
              Desde Administración podrás crear usuarios y proyectos, y en
              Configuración añadir el logotipo y el favicon.
            </p>
            <Button onClick={onFinished}>Ir a iniciar sesión</Button>
          </div>
        )}
        {busy && step !== "verify" && step !== "welcome" && <LoadingState />}
      </section>
    </main>
  );
}

function Navigation({
  onBack,
  submitLabel = "Continuar",
  disabled,
  onSubmit,
}: {
  onBack: () => void;
  submitLabel?: string;
  disabled?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <div className="setup-nav">
      <Button tone="secondary" onClick={onBack}>
        Atrás
      </Button>
      {onSubmit ? (
        <Button disabled={disabled} onClick={onSubmit}>
          {submitLabel}
        </Button>
      ) : (
        <Button type="submit" disabled={disabled}>
          {submitLabel}
        </Button>
      )}
    </div>
  );
}

function ChecksList({
  checks,
  checking,
  only,
}: {
  checks: SetupChecks | null;
  checking: boolean;
  only?: "storage";
}) {
  if (checking || !checks) return <LoadingState />;
  const rows = [
    ...(only
      ? []
      : [
          {
            id: "database",
            label: "Base de datos",
            ok: checks.database === "ok",
          },
        ]),
    {
      id: "storage",
      label: `Almacenamiento (${checks.storageProvider === "S3" ? "S3 privado" : "local"})`,
      ok: checks.storage === "ok",
    },
    ...(only
      ? []
      : [
          {
            id: "origin",
            label: `Dirección de acceso ${checks.origin}`,
            ok: checks.secureOrigin,
            detail: checks.secureOrigin
              ? "Conexión protegida o local."
              : "No es HTTPS: no la uses fuera de pruebas.",
          },
        ]),
  ];
  return (
    <ul className="setup-checks" aria-label="Resultado de las comprobaciones">
      {rows.map((row) => (
        <li key={row.id}>
          <StatusChip tone={row.ok ? "success" : "warning"}>
            {row.ok ? "Correcto" : "Revisar"}
          </StatusChip>
          <span>
            {row.label}
            {"detail" in row && row.detail ? ` — ${row.detail}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
