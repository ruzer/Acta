import { createContext, useContext, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PublicBranding } from "@requirements/contracts";
import type { ReactNode } from "react";
import { api } from "./api";
import { ErrorState, LoadingState } from "./ui";
const defaults: PublicBranding = {
  appName: "Acta",
  shortName: "Acta",
  organizationName: "My organization",
  logo: "",
  logoSecondary: "",
  secondaryName: "",
  favicon: "",
  accent: "#2b4d7c",
  locale: "es-MX",
  timezone: "UTC",
};
const BrandingContext = createContext(defaults);
let formatting = { locale: defaults.locale, timezone: defaults.timezone };
export function formatDate(date: string) {
  return new Intl.DateTimeFormat(formatting.locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: formatting.timezone,
  }).format(new Date(date));
}
export function useBranding() {
  return useContext(BrandingContext);
}
export function BrandingProvider({ children }: { children: ReactNode }) {
  const q = useQuery({
    queryKey: ["public-branding"],
    queryFn: () => api("branding"),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!q.data) return;
    document.title = q.data.appName;
    document.documentElement.lang = q.data.locale;
    document.documentElement.style.setProperty(
      "--installation-accent",
      q.data.accent,
    );
    formatting = { locale: q.data.locale, timezone: q.data.timezone };
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (q.data.favicon) {
      const link = icon ?? document.createElement("link");
      link.rel = "icon";
      link.href = q.data.favicon;
      if (!icon) document.head.append(link);
    } else icon?.remove();
  }, [q.data]);
  if (q.isPending) return <LoadingState />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  formatting = { locale: q.data.locale, timezone: q.data.timezone };
  return (
    <BrandingContext.Provider value={q.data}>
      {children}
    </BrandingContext.Provider>
  );
}
export function Brand({
  short = false,
  logo = true,
}: {
  short?: boolean;
  /** False where the logos are shown on their own (the sign-in): the name alone follows. */
  logo?: boolean;
}) {
  const b = useBranding();
  return (
    <>
      {logo && b.logo && (
        <img className="installation-logo" src={b.logo} alt="" />
      )}
      <span className="brand-name">{short ? b.shortName : b.appName}</span>
    </>
  );
}

/**
 * The institution's marks. The main logo is the institution's identity; the
 * optional second one is a collaborating entity or responsible area and stays
 * visibly subordinate (smaller, after a divider). Nothing is reserved for a
 * logo that does not exist: with none, this renders nothing.
 */
export function Marks({
  logo,
  logoSecondary,
  name = "",
}: {
  logo: string;
  logoSecondary: string;
  /** The entity of the second logo; text beside it carries the name, so the image adds none. */
  name?: string;
}) {
  if (!logo && !logoSecondary) return null;
  return (
    <div className="institution-marks">
      {logo && <img className="institution-mark" src={logo} alt="" />}
      {logo && logoSecondary && (
        <span className="institution-mark-divider" aria-hidden="true" />
      )}
      {logoSecondary && (
        <img
          className="institution-mark institution-mark-secondary"
          src={logoSecondary}
          alt={name}
        />
      )}
    </div>
  );
}
export function InstitutionMarks({
  nameShown = false,
}: {
  nameShown?: boolean;
}) {
  const b = useBranding();
  // When the name is written out next to the marks the image repeats nothing.
  return (
    <Marks
      logo={b.logo}
      logoSecondary={b.logoSecondary}
      name={nameShown ? "" : b.secondaryName}
    />
  );
}
