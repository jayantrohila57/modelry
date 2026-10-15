import { clientEnv } from "./env.client";

export const siteConfig = {
  name: "Modelry",
  tagline: "See what happens inside AI.",
  domain: "modelry.app",
  description:
    "Modelry is an interactive AI laboratory where developers experiment with language models, understand their behavior, and learn how AI-powered software actually works.",
  contact: {
    email: "support@modelry.app",
    supportEmail: "support@modelry.app",
    noreplyEmail: "noreply@modelry.app",
    phone: "+1 (555) 000-0000",
    address: {
      line1: "Modelry Labs",
      line2: "Developer Education",
      city: "Remote",
      state: "NA",
      postalCode: "00000",
      country: "Internet",
    },
  },
  urls: {
    base: clientEnv.NEXT_PUBLIC_BASE_URL,
    website: clientEnv.NEXT_PUBLIC_BASE_URL,
    support: `${clientEnv.NEXT_PUBLIC_BASE_URL}/auth`,
    privacy: `${clientEnv.NEXT_PUBLIC_BASE_URL}/privacy`,
    terms: `${clientEnv.NEXT_PUBLIC_BASE_URL}/terms`,
  },
  email: {
    from: {
      name: "Modelry",
      address: "noreply@modelry.app",
    },
    support: {
      name: "Modelry Support",
      address: "support@modelry.app",
    },
    replyTo: "support@modelry.app",
    footer: {
      company: "Modelry",
      address: "Modelry Labs, Remote, Internet",
      unsubscribe: "Transactional emails for your Modelry account.",
      privacy: "Privacy",
      terms: "Terms",
    },
  },
  colors: {
    primary: "#152238",
    secondary: "#0f172a",
    success: "#16a34a",
    warning: "#d97706",
    error: "#dc2626",
    info: "#0891b2",
    background: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  legal: {
    companyName: "Modelry",
    taxId: "starter",
    lastUpdated: "October 2026",
  },
};

export const site = {
  name: siteConfig.name,
  tagline: siteConfig.tagline,
  address: `${siteConfig.contact.address.line1}, ${siteConfig.contact.address.city}, ${siteConfig.contact.address.state} ${siteConfig.contact.address.postalCode}`,
  phone: siteConfig.contact.phone,
  email: siteConfig.contact.email,
  description: siteConfig.description,
  url: clientEnv.NEXT_PUBLIC_BASE_URL,
  legalUpdate: siteConfig.legal.lastUpdated,
  apiTitle: `${siteConfig.name} API`,
  apiVersion: "1.0.0",
  socialLinks: [],
};

export type SiteConfig = typeof siteConfig;
