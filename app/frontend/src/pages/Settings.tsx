import { useState, type FormEvent } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  brandingAssetLimits,
  type AppearanceKey,
  type BrandingAssetKind,
  type Me,
  type SettingField,
  type SettingsAssetView,
  type SettingsView,
  type SystemStatus,
} from "@requirements/contracts";
import { ApiFailure, api, uploadBrandingAsset } from "../api";
import { formatDate } from "../branding";
import { Alert, Button, ErrorState, Input, LoadingState } from "../ui";
import { PageHeader, StatusChip } from "../ui/semantic";
import { ParticipantIcon } from "./ParticipantIcon";
import {
  AccentInput,
  BrandingPreview,
  ExternalInput,
  LocaleSelect,
  TimezoneSelect,
} from "./SettingsFields";
import "./setup.css";

const sections = [
  { id: "general", label: "General", icon: "building" },
  { id: "appearance", label: "Apariencia", icon: "image" },
  { id: "storage", label: "Almacenamiento", icon: "server" },
  { id: "system", label: "Sistema", icon: "info" },
] as const;
const defaultsText: Record<AppearanceKey, string> = {
  appName: "Acta",
  shortName: "Acta",
  accent: "#2b4d7c",
  locale: "es-MX",
  timezone: "UTC",
  secondaryName: "",
};

/** Administration of the installation: only for organization administrators. */
export function Settings({ me }: { me: Me }) {
  const { section } = useParams();
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => api("settings"),
    enabled: me.user.isOrganizationAdmin,
  });
  if (!me.user.isOrganizationAdmin)
    return (
      <Alert error>No tienes permiso para administrar la institución.</Alert>
    );
  const current = sections.find((item) => item.id === section);
  if (!current) return <Navigate to="/admin/settings/general" replace />;
  return (
    <>
      <PageHeader
        overline={me.organization.name}
        title="Configuración"
        lead="Personaliza Acta y consulta el estado de la instalación."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Secciones de configuración">
          <ul>
            {sections.map((item) => (
              <li key={item.id}>
                <Link
                  to={`/admin/settings/${item.id}`}
                  aria-current={item.id === current.id ? "page" : undefined}
                >
                  <ParticipantIcon name={item.icon} />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          {current.id === "general" || current.id === "appearance" ? (
            settings.isPending ? (
              <LoadingState />
            ) : settings.error ? (
              <ErrorState
                error={settings.error}
                retry={() => void settings.refetch()}
              />
            ) : current.id === "general" ? (
              <General settings={settings.data} />
            ) : (
              <Appearance settings={settings.data} />
            )
          ) : current.id === "storage" ? (
            <StorageSection />
          ) : (
            <SystemSection />
          )}
        </div>
      </div>
    </>
  );
}

/** Saves what the person changed and nothing else; the server also checks the version they saw. */
function useSettingsSave(version: number) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<ApiFailure | null>(null);
  const [saved, setSaved] = useState("");
  const mutation = useMutation({
    mutationFn: (changes: Record<string, unknown>) =>
      api("updateSettings", {}, { expectedVersion: version, ...changes }),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      void queryClient.invalidateQueries({ queryKey: ["public-branding"] });
      setError(null);
      setSaved("Configuración guardada.");
    },
    onError: (failure) => {
      setSaved("");
      setError(failure as ApiFailure);
    },
  });
  return { mutation, error, saved, setSaved, setError, queryClient };
}
function SaveFeedback({
  error,
  saved,
  onReload,
}: {
  error: ApiFailure | null;
  saved: string;
  onReload: () => void;
}) {
  return (
    <>
      {error && (
        <Alert error>
          <p>{error.message}</p>
          {error.status === 409 && !Object.keys(error.fields).length && (
            <Button tone="secondary" onClick={onReload}>
              Cargar la configuración actual
            </Button>
          )}
        </Alert>
      )}
      {saved && <Alert>{saved}</Alert>}
    </>
  );
}
function ResetButton({
  field,
  name,
  fallback,
  onReset,
  busy,
}: {
  field: SettingField;
  name: string;
  fallback: string;
  onReset: () => void;
  busy: boolean;
}) {
  if (field.source !== "saved") return null;
  return (
    <p className="hint">
      <Button
        tone="tertiary"
        onClick={onReset}
        disabled={busy}
        aria-label={`Usar el valor predeterminado (${fallback}) de ${name}`}
      >
        Usar el valor predeterminado ({fallback})
      </Button>
    </p>
  );
}

/** A text the infrastructure may control: read-only with its variable named, or editable with a way back to the default. */
function TextSetting({
  label,
  name,
  field,
  value,
  onChange,
  error,
  hint,
  maxLength,
  fallback,
  onReset,
  busy,
}: {
  label: string;
  /** Lower-case name used in the reset button's accessible name. */
  name: string;
  field: SettingField;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  maxLength: number;
  fallback: string;
  onReset: () => void;
  busy: boolean;
}) {
  if (field.source === "external")
    return <ExternalInput label={label} field={field} />;
  return (
    <>
      <Input
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        hint={hint}
        maxLength={maxLength}
      />
      <ResetButton
        field={field}
        name={name}
        fallback={fallback}
        onReset={onReset}
        busy={busy}
      />
    </>
  );
}

function General({ settings }: { settings: SettingsView }) {
  const [locale, setLocale] = useState(settings.locale.value);
  const [timezone, setTimezone] = useState(settings.timezone.value);
  // New data (after a save or a reload) replaces what is in the form; the notice of a save stays.
  const [synced, setSynced] = useState(settings.version);
  if (synced !== settings.version) {
    setSynced(settings.version);
    setLocale(settings.locale.value);
    setTimezone(settings.timezone.value);
  }
  const { mutation, error, saved, setSaved, setError, queryClient } =
    useSettingsSave(settings.version);

  function submit(event: FormEvent) {
    event.preventDefault();
    const changes: Record<string, string> = {};
    if (
      settings.locale.source !== "external" &&
      locale !== settings.locale.value
    )
      changes.locale = locale;
    if (
      settings.timezone.source !== "external" &&
      timezone !== settings.timezone.value
    )
      changes.timezone = timezone;
    if (!Object.keys(changes).length) {
      setSaved("");
      setError(new ApiFailure(0, "No hay cambios que guardar."));
      return;
    }
    mutation.mutate(changes);
  }
  const reset = (key: AppearanceKey) => mutation.mutate({ reset: [key] });
  return (
    <section className="settings-panel" aria-labelledby="general-title">
      <h2 id="general-title">General</h2>
      <p className="hint">
        Cómo se escriben las fechas y en qué zona horaria se muestran. El nombre
        y las imágenes de la institución están en Apariencia.
      </p>
      <form onSubmit={submit} noValidate>
        {settings.locale.source === "external" ? (
          <ExternalInput label="Formato regional" field={settings.locale} />
        ) : (
          <>
            <LocaleSelect value={locale} onChange={setLocale} />
            <ResetButton
              field={settings.locale}
              name="formato regional"
              fallback={defaultsText.locale}
              onReset={() => reset("locale")}
              busy={mutation.isPending}
            />
          </>
        )}
        {settings.timezone.source === "external" ? (
          <ExternalInput label="Zona horaria" field={settings.timezone} />
        ) : (
          <>
            <TimezoneSelect value={timezone} onChange={setTimezone} />
            <ResetButton
              field={settings.timezone}
              name="zona horaria"
              fallback={defaultsText.timezone}
              onReset={() => reset("timezone")}
              busy={mutation.isPending}
            />
          </>
        )}
        <SaveFeedback
          error={error}
          saved={saved}
          onReload={() =>
            void queryClient.invalidateQueries({ queryKey: ["settings"] })
          }
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </section>
  );
}

/**
 * Identity and look in one place: names, color and images, with a preview that
 * follows what is typed and what is chosen before anything is saved.
 */
function Appearance({ settings }: { settings: SettingsView }) {
  const [organizationName, setOrganizationName] = useState(
    settings.organizationName,
  );
  const [appName, setAppName] = useState(settings.appName.value);
  const [shortName, setShortName] = useState(settings.shortName.value);
  const [secondaryName, setSecondaryName] = useState(
    settings.secondaryName.value,
  );
  const [accent, setAccent] = useState(settings.accent.value);
  // Images chosen but not saved yet, as data addresses (the page only allows those and its own).
  const [pending, setPending] = useState<
    Partial<Record<BrandingAssetKind, string>>
  >({});
  const [synced, setSynced] = useState(settings.version);
  if (synced !== settings.version) {
    setSynced(settings.version);
    setOrganizationName(settings.organizationName);
    setAppName(settings.appName.value);
    setShortName(settings.shortName.value);
    setSecondaryName(settings.secondaryName.value);
    setAccent(settings.accent.value);
  }
  const { mutation, error, saved, setSaved, setError, queryClient } =
    useSettingsSave(settings.version);
  const fieldError = (key: string) => error?.fields[key];
  const edit = (apply: () => void) => {
    apply();
    setSaved("");
    setError(null);
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    setSaved("");
    const changes: Record<string, string> = {};
    if (organizationName.trim() !== settings.organizationName)
      changes.organizationName = organizationName.trim();
    const edits: [AppearanceKey, string, SettingField][] = [
      ["appName", appName.trim(), settings.appName],
      ["shortName", shortName.trim(), settings.shortName],
      ["secondaryName", secondaryName.trim(), settings.secondaryName],
      ["accent", accent, settings.accent],
    ];
    for (const [key, value, field] of edits)
      if (field.source !== "external" && value !== field.value)
        changes[key] = value;
    if (!Object.keys(changes).length) {
      setError(new ApiFailure(0, "No hay cambios que guardar."));
      return;
    }
    mutation.mutate(changes);
  }
  const reset = (key: AppearanceKey, restore: () => void) => {
    restore();
    mutation.mutate({ reset: [key] });
  };
  const preview = (kind: BrandingAssetKind) => (url: string | null) =>
    setPending((current) => {
      const next = { ...current };
      if (url) next[kind] = url;
      else delete next[kind];
      return next;
    });
  return (
    <section className="settings-panel" aria-labelledby="appearance-title">
      <h2 id="appearance-title">Apariencia</h2>
      <BrandingPreview
        appName={appName}
        shortName={shortName}
        organizationName={organizationName}
        secondaryName={secondaryName}
        accent={accent}
        logo={pending.logo ?? settings.logo.url}
        logoSecondary={pending.logoSecondary ?? settings.logoSecondary.url}
        favicon={pending.favicon ?? settings.favicon.url}
      />
      <form onSubmit={submit} noValidate className="settings-identity">
        <h3>Identidad</h3>
        <Input
          label="Nombre de la institución"
          value={organizationName}
          onChange={(event) =>
            edit(() => setOrganizationName(event.target.value))
          }
          error={fieldError("organizationName")}
          hint="Aparece en la pantalla de acceso y en el encabezado."
          maxLength={200}
        />
        <TextSetting
          label="Nombre de la aplicación"
          name="nombre de la aplicación"
          field={settings.appName}
          value={appName}
          onChange={(value) => edit(() => setAppName(value))}
          error={fieldError("appName")}
          maxLength={100}
          fallback={defaultsText.appName}
          onReset={() =>
            reset("appName", () => setAppName(defaultsText.appName))
          }
          busy={mutation.isPending}
        />
        <TextSetting
          label="Nombre corto"
          name="nombre corto"
          field={settings.shortName}
          value={shortName}
          onChange={(value) => edit(() => setShortName(value))}
          error={fieldError("shortName")}
          hint="Se usa en la barra lateral."
          maxLength={40}
          fallback={defaultsText.shortName}
          onReset={() =>
            reset("shortName", () => setShortName(defaultsText.shortName))
          }
          busy={mutation.isPending}
        />
        <TextSetting
          label="Entidad del segundo logotipo (opcional)"
          name="entidad del segundo logotipo"
          field={settings.secondaryName}
          value={secondaryName}
          onChange={(value) => edit(() => setSecondaryName(value))}
          error={fieldError("secondaryName")}
          hint="El área o entidad que acompaña a la institución. Se muestra bajo su nombre en la pantalla de acceso."
          maxLength={200}
          fallback="vacío"
          onReset={() => reset("secondaryName", () => setSecondaryName(""))}
          busy={mutation.isPending}
        />
        {settings.accent.source === "external" ? (
          <ExternalInput label="Color principal" field={settings.accent} />
        ) : (
          <>
            <AccentInput
              value={accent}
              onChange={(value) => edit(() => setAccent(value))}
              error={fieldError("accent")}
            />
            <ResetButton
              field={settings.accent}
              name="color principal"
              fallback={defaultsText.accent}
              onReset={() =>
                reset("accent", () => setAccent(defaultsText.accent))
              }
              busy={mutation.isPending}
            />
          </>
        )}
        <SaveFeedback
          error={error}
          saved={saved}
          onReload={() =>
            void queryClient.invalidateQueries({ queryKey: ["settings"] })
          }
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Guardando…" : "Guardar identidad"}
        </Button>
      </form>
      <div className="settings-images">
        <h3>Imágenes</h3>
        <p className="hint">
          El logotipo principal es la identidad de la institución. El segundo es
          opcional y se muestra más pequeño, en la pantalla de acceso y en las
          invitaciones externas; sin él, Acta funciona igual. Se guardan al
          elegirlos y se ven al instante, sin reiniciar nada.
        </p>
        <AssetControl
          kind="logo"
          settings={settings}
          onPreview={preview("logo")}
        />
        <AssetControl
          kind="logoSecondary"
          settings={settings}
          onPreview={preview("logoSecondary")}
        />
        <AssetControl
          kind="favicon"
          settings={settings}
          onPreview={preview("favicon")}
        />
      </div>
      <p className="settings-note">
        Los colores se validan para que el texto blanco siga siendo legible. No
        se admite CSS ni JavaScript personalizado.
      </p>
    </section>
  );
}

const assetLabels: Record<
  BrandingAssetKind,
  { label: string; accepts: string; hint?: string }
> = {
  logo: { label: "Logotipo principal", accepts: "PNG o JPEG" },
  logoSecondary: {
    label: "Segundo logotipo",
    accepts: "PNG o JPEG",
    hint: "Opcional: un área o entidad que acompaña a la institución.",
  },
  favicon: { label: "Favicon", accepts: "PNG cuadrado o ICO" },
};

function AssetControl({
  kind,
  settings,
  onPreview,
}: {
  kind: BrandingAssetKind;
  settings: SettingsView;
  /** Lets the preview show the chosen image before it is saved. */
  onPreview: (url: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const asset: SettingsAssetView = settings[kind];
  const limits = brandingAssetLimits[kind];
  const { label, accepts, hint } = assetLabels[kind];
  const lower = label.toLowerCase();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = `asset-${kind}`;

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    setDone("");
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      await queryClient.invalidateQueries({ queryKey: ["public-branding"] });
      setFile(null);
      onPreview(null);
      setDone(success);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function choose(next: File | null) {
    setDone("");
    onPreview(null);
    if (next && next.size > limits.maxBytes) {
      setFile(null);
      setError(
        `El archivo es demasiado grande: el máximo es ${Math.round(limits.maxBytes / 1024)} KB.`,
      );
      return;
    }
    setError("");
    setFile(next);
    if (!next) return;
    // Only a data address can be shown: the page's policy does not allow blob addresses.
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onPreview(reader.result);
    };
    reader.readAsDataURL(next);
  }
  return (
    <div className="settings-asset">
      <div className="settings-asset-image">
        {asset.url ? <img src={asset.url} alt="" /> : "Sin imagen"}
      </div>
      <div>
        <p>
          <strong>{label}</strong>{" "}
          {asset.source === "external" && (
            <StatusChip tone="neutral" icon="server">
              Administrado externamente
            </StatusChip>
          )}
        </p>
        {asset.source === "external" ? (
          <p className="hint">
            Se define en la infraestructura ({asset.variable}) y no se puede
            cambiar desde Acta.
          </p>
        ) : (
          <>
            <div className="field">
              <label htmlFor={inputId}>
                {asset.source === "saved"
                  ? `Reemplazar ${lower}`
                  : `Subir ${lower}`}
              </label>
              <input
                id={inputId}
                type="file"
                accept={limits.types.join(",")}
                onChange={(event) => choose(event.target.files?.[0] ?? null)}
                aria-describedby={`${inputId}-hint`}
              />
              <p id={`${inputId}-hint`} className="hint">
                {hint ? `${hint} ` : ""}
                {accepts}, hasta {Math.round(limits.maxBytes / 1024)} KB. No se
                admiten SVG.
              </p>
            </div>
            <div className="actions">
              <Button
                disabled={busy || !file}
                onClick={() =>
                  file &&
                  void run(
                    () => uploadBrandingAsset(kind, settings.version, file),
                    `${label} guardado.`,
                  )
                }
              >
                {busy ? "Guardando…" : `Guardar ${lower}`}
              </Button>
              {asset.source === "saved" && (
                <Button
                  tone="danger"
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        api(
                          "removeBrandingAsset",
                          { kind },
                          { expectedVersion: settings.version },
                        ),
                      `${label} eliminado.`,
                    )
                  }
                >
                  Eliminar {lower}
                </Button>
              )}
            </div>
          </>
        )}
        {error && <Alert error>{error}</Alert>}
        {done && <Alert>{done}</Alert>}
      </div>
    </div>
  );
}

function useSystem(): UseQueryResult<SystemStatus> {
  return useQuery({
    queryKey: ["system-status"],
    queryFn: () => api("systemStatus"),
    staleTime: 0,
  });
}
const checkChip = (ok: boolean, good = "Correcto", bad = "Revisar") => (
  <StatusChip tone={ok ? "success" : "warning"}>{ok ? good : bad}</StatusChip>
);

function StorageSection() {
  const system = useSystem();
  const queryClient = useQueryClient();
  const test = useMutation({
    mutationFn: () => api("storageTest", {}, {}),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["system-status"] }),
  });
  if (system.isPending) return <LoadingState />;
  if (system.error)
    return (
      <ErrorState error={system.error} retry={() => void system.refetch()} />
    );
  const { storage } = system.data;
  return (
    <section className="settings-panel" aria-labelledby="storage-title">
      <h2 id="storage-title">Almacenamiento</h2>
      <p>
        <StatusChip tone="neutral" icon="server">
          Administrado externamente
        </StatusChip>
      </p>
      <dl className="settings-facts">
        <div>
          <dt>Estado</dt>
          <dd>
            {checkChip(storage.status === "ok", "Responde", "No responde")}
          </dd>
        </div>
        <div>
          <dt>Proveedor</dt>
          <dd>
            {storage.provider === "S3" ? "S3 privado" : "Almacenamiento local"}
          </dd>
        </div>
        {storage.provider === "S3" && (
          <>
            <div>
              <dt>Servidor</dt>
              <dd>{storage.endpointHost || "—"}</dd>
            </div>
            <div>
              <dt>Bucket</dt>
              <dd>{storage.bucket}</dd>
            </div>
            <div>
              <dt>Región</dt>
              <dd>{storage.region}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Evidencia guardada</dt>
          <dd>
            {storage.evidenceByBackend.length
              ? storage.evidenceByBackend
                  .map(
                    (row) =>
                      `${row.files} ${row.files === 1 ? "archivo" : "archivos"} en ${row.backend}`,
                  )
                  .join(" · ")
              : "Todavía no hay evidencia."}
          </dd>
        </div>
      </dl>
      <div className="actions">
        <Button
          tone="secondary"
          onClick={() => test.mutate()}
          disabled={test.isPending}
        >
          {test.isPending ? "Probando…" : "Probar conexión"}
        </Button>
      </div>
      {test.data && (
        <Alert error={test.data.status !== "ok"}>
          {test.data.status === "ok"
            ? "El almacenamiento respondió correctamente."
            : "El almacenamiento no respondió. Revisa el servicio y sus variables."}{" "}
          ({formatDate(test.data.checkedAt)})
        </Alert>
      )}
      {test.error && <Alert error>{test.error.message}</Alert>}
      <p className="settings-note">
        El proveedor, el servidor y las credenciales se definen en la
        infraestructura (variables <code>S3_*</code>) y no se cambian desde
        Acta. Cambiar de proveedor no traslada la evidencia ya guardada; esa
        migración y la rotación de credenciales son procedimientos aparte (ver
        la guía de proveedores S3).
      </p>
    </section>
  );
}

function SystemSection() {
  const system = useSystem();
  if (system.isPending) return <LoadingState />;
  if (system.error)
    return (
      <ErrorState error={system.error} retry={() => void system.refetch()} />
    );
  const s = system.data;
  const environment = {
    production: "Producción",
    development: "Desarrollo",
    test: "Pruebas",
  }[s.environment];
  return (
    <section className="settings-panel" aria-labelledby="system-title">
      <h2 id="system-title">Sistema</h2>
      <p>
        <StatusChip tone="neutral" icon="server">
          Administrado externamente
        </StatusChip>
      </p>
      <dl className="settings-facts">
        <div>
          <dt>Versión</dt>
          <dd>Acta {s.version}</dd>
        </div>
        <div>
          <dt>Entorno</dt>
          <dd>{environment}</dd>
        </div>
        <div>
          <dt>Base de datos</dt>
          <dd>
            {checkChip(s.database.status === "ok", "Responde", "No responde")}
          </dd>
        </div>
        <div>
          <dt>Dirección de acceso</dt>
          <dd>
            {s.security.origin}{" "}
            {checkChip(s.security.https, "HTTPS", "Sin HTTPS")}
          </dd>
        </div>
        <div>
          <dt>Cookies seguras</dt>
          <dd>
            {s.security.secureCookies ? "Sí" : "No (solo pruebas locales)"}
          </dd>
        </div>
        <div>
          <dt>Sesión</dt>
          <dd>
            Se cierra tras {s.security.sessionIdleMinutes} minutos sin uso y
            dura como máximo {s.security.sessionMaxHours} horas.
          </dd>
        </div>
        <div>
          <dt>Invitaciones externas</dt>
          <dd>
            Identidad registrada: {s.security.invitationIdentity}; vigencia
            predeterminada {s.security.invitationDefaultDays} días, máximo{" "}
            {s.security.invitationMaxDays}.
          </dd>
        </div>
        <div>
          <dt>Límites de evidencia</dt>
          <dd>
            {Math.round(s.limits.evidenceMaxBytes / 1048576)} MiB por archivo,{" "}
            {s.limits.evidenceMaxAttachments} adjuntos por respuesta,{" "}
            {Math.round(s.limits.evidenceProjectBytes / 1048576)} MiB por
            proyecto.
          </dd>
        </div>
        <div>
          <dt>Importación</dt>
          <dd>Hasta {Math.round(s.limits.importMaxBytes / 1048576)} MiB.</dd>
        </div>
        <div>
          <dt>Revisado</dt>
          <dd>{formatDate(s.checkedAt)}</dd>
        </div>
      </dl>
      <div className="actions">
        <Button
          tone="secondary"
          onClick={() => void system.refetch()}
          disabled={system.isFetching}
        >
          {system.isFetching ? "Actualizando…" : "Actualizar"}
        </Button>
      </div>
      <p className="settings-note">
        Estos valores se definen en la infraestructura (archivo{" "}
        <code>.env</code>, Docker Compose o tu gestor de secretos). Acta los
        muestra, pero no los modifica ni muestra credenciales.
      </p>
    </section>
  );
}
