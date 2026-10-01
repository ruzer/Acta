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
    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (q.data.favicon) {
      if (!icon) {
        icon = document.createElement("link");
        icon.rel = "icon";
        document.head.append(icon);
      }
      icon.href = q.data.favicon;
    }
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
export function Brand({ short = false }: { short?: boolean }) {
  const b = useBranding();
  return (
    <>
      {b.logo && <img className="installation-logo" src={b.logo} alt="" />}
      {short ? b.shortName : b.appName}
    </>
  );
}
