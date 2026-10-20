import { useId, type CSSProperties } from "react";
import {
  accentContrast,
  localeOptions,
  minimumAccentContrast,
  type SettingField,
} from "@requirements/contracts";
import { Marks } from "../branding";
import { Input, Select } from "../ui";
import { StatusChip } from "../ui/semantic";

/** The text that explains a value the infrastructure controls. */
export function externalHint(field: SettingField) {
  return `Administrado externamente (${field.variable}). Se define en la infraestructura y no se puede cambiar desde Acta.`;
}
/** A value shown but not editable here, with the reason next to it. */
export function ExternalInput({
  label,
  field,
  display,
}: {
  label: string;
  field: SettingField;
  display?: string;
}) {
  return (
    <Input
      label={label}
      value={display ?? field.value}
      readOnly
      hint={externalHint(field)}
    />
  );
}

const zones = (() => {
  const known = new Set<string>(Intl.supportedValuesOf("timeZone"));
  known.add("UTC");
  return [...known].sort();
})();
export function LocaleSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  // A value outside the list can only come from the environment; it is not offered for choosing.
  return (
    <Select
      label="Formato regional"
      hint="Cómo se escriben fechas y números. La interfaz está en español."
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {localeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
export function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      label="Zona horaria"
      hint="Se usa para mostrar las fechas de revisión y de los participantes."
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {zones.map((zone) => (
        <option key={zone} value={zone}>
          {zone}
        </option>
      ))}
    </Select>
  );
}

const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);
/** A color chosen by sight or by code, with the reading contrast stated in words. */
export function AccentInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const id = useId();
  const contrast = isHex(value) ? accentContrast(value) : null;
  const message =
    contrast === null
      ? "Escribe un color hexadecimal, por ejemplo #2b4d7c."
      : contrast >= minimumAccentContrast
        ? `Contraste con texto blanco: ${contrast.toFixed(1)}:1. Es legible (mínimo ${minimumAccentContrast}:1).`
        : `Contraste con texto blanco: ${contrast.toFixed(1)}:1. Es demasiado claro (mínimo ${minimumAccentContrast}:1).`;
  return (
    <div className="accent-input">
      <Input
        label="Color principal"
        value={value}
        onChange={(event) => onChange(event.target.value.trim())}
        maxLength={7}
        spellCheck={false}
        autoComplete="off"
        error={error}
        hint={error ? undefined : message}
      />
      <label htmlFor={id} className="accent-picker">
        <span className="sr-only">Elegir el color con el selector</span>
        <input
          id={id}
          type="color"
          value={isHex(value) ? value.toLowerCase() : "#2b4d7c"}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <p className="accent-status" role="status">
        {contrast !== null && (
          <StatusChip
            tone={contrast >= minimumAccentContrast ? "success" : "danger"}
          >
            {contrast >= minimumAccentContrast ? "Legible" : "Poco legible"}
          </StatusChip>
        )}
      </p>
    </div>
  );
}

/**
 * What the installation will look like with these choices: the browser tab, the
 * sign-in screen and the side navigation, drawn with the same marks and
 * proportions as the real ones. Nothing here is interactive.
 */
export function BrandingPreview({
  appName,
  shortName,
  organizationName,
  secondaryName = "",
  accent,
  logo,
  logoSecondary = "",
  favicon = "",
}: {
  appName: string;
  shortName: string;
  organizationName: string;
  secondaryName?: string;
  accent: string;
  logo: string;
  logoSecondary?: string;
  favicon?: string;
}) {
  const style = (isHex(accent) ? { "--preview-accent": accent } : undefined) as
    CSSProperties | undefined;
  return (
    <figure className="brand-preview" style={style}>
      <figcaption>Vista previa</figcaption>
      <div className="brand-preview-card" data-testid="branding-preview">
        <div className="brand-preview-tab">
          {favicon ? (
            <img src={favicon} alt="" />
          ) : (
            <span className="brand-preview-tab-empty" aria-hidden="true" />
          )}
          <span>{appName}</span>
        </div>
        <div className="brand-preview-body">
          <div className="brand-preview-side">
            <div className="brand-preview-bar">
              {logo && <img src={logo} alt="" />}
              <strong>{shortName || appName}</strong>
            </div>
            <span className="brand-preview-nav" data-current="">
              Mis proyectos
            </span>
            <span className="brand-preview-nav">Administración</span>
          </div>
          <div className="brand-preview-login">
            <Marks logo={logo} logoSecondary={logoSecondary} name="" />
            <p className="brand-preview-institution">{organizationName}</p>
            {secondaryName && (
              <p className="brand-preview-secondary">{secondaryName}</p>
            )}
            <p>{appName} · Questions. Evidence. Decisions.</p>
            <p>
              <span className="brand-preview-link">Un enlace de ejemplo</span>
            </p>
            <span className="button primary" aria-hidden="true">
              Iniciar sesión
            </span>
          </div>
        </div>
      </div>
    </figure>
  );
}
