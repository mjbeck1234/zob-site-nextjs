export const site = {
  name: process.env.NEXT_PUBLIC_FACILITY_NAME ?? 'Cleveland ARTCC (ZOB)',
  domain: process.env.NEXT_PUBLIC_SITE_DOMAIN ?? 'clevelandcenter.org',
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL ?? '/logo.png',
  brandColor: process.env.NEXT_PUBLIC_BRAND_COLOR ?? '#0f172a',
};

export const links = {
  discord: process.env.NEXT_PUBLIC_DISCORD_URL,
  vatsimFacility: process.env.NEXT_PUBLIC_VATSIM_FACILITY_URL,
  github: process.env.NEXT_PUBLIC_GITHUB_URL,
};
