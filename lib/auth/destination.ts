import type { Locale } from "@/i18n/config";

const destinations = {
  cv: "/app/cv?mode=new",
  import: "/app/cv?mode=import",
  tailor: "/app/application",
  letter: "/app/application?mode=letter",
} as const;

export type Destination = keyof typeof destinations;

export function selectDestination(value: unknown): Destination | undefined {
  return typeof value === "string" && Object.hasOwn(destinations, value) ? value as Destination : undefined;
}

export function workspacePath(locale: Locale, destination?: Destination) {
  const key = selectDestination(destination);
  return "/" + locale + (key ? destinations[key] : "/app");
}

export function entryPath(locale: Locale, signedIn: boolean, destination: Destination) {
  return signedIn ? workspacePath(locale, destination) : `/${locale}/signup?next=${destination}`;
}
