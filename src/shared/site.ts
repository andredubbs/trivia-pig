import { APP_NAME } from "./app";

/** Public address of this site (APP_URL), used for canonical links, the sitemap and share cards. */
export function siteUrl(): URL {
  try {
    return new URL(process.env.APP_URL || "https://triviapig.lol");
  } catch {
    return new URL("https://triviapig.lol");
  }
}

export const TAGLINE = "Plant pathology on the projector, with one phone per team";
export const DESCRIPTION =
  "A plant pathology classroom quiz with 2–6 teams, a shared projector, and one phone per team. Discuss, diagnose, buzz in, and answer together.";
export const SITE_TITLE = `${APP_NAME}: plant pathology on the projector`;
