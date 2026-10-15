import type { Metadata } from "next";
import { clientEnv } from "./env.client";

function resolveBaseUrl() {
  const configured = clientEnv.NEXT_PUBLIC_BASE_URL;
  if (configured && configured !== "undefined") {
    return configured;
  }
  return "http://localhost:3000";
}

const baseUrl = resolveBaseUrl();

const description =
  "Modelry is an interactive AI laboratory where developers experiment with language models, understand their behavior, and learn how AI-powered software actually works.";

export const siteConfig = {
  name: "Modelry",
  wordmark: "modelry",
  tagline: "See what happens inside AI.",
  domain: "modelry.app",
  description,
  brand: {
    navy: "#172554",
  },
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
    base: baseUrl,
    website: baseUrl,
    support: `${baseUrl}/auth`,
    privacy: `${baseUrl}/privacy`,
    terms: `${baseUrl}/terms`,
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
  wordmark: siteConfig.wordmark,
  tagline: siteConfig.tagline,
  address: `${siteConfig.contact.address.line1}, ${siteConfig.contact.address.city}, ${siteConfig.contact.address.state} ${siteConfig.contact.address.postalCode}`,
  phone: siteConfig.contact.phone,
  email: siteConfig.contact.email,
  description: siteConfig.description,
  url: baseUrl,
  legalUpdate: siteConfig.legal.lastUpdated,
  apiTitle: `${siteConfig.name} API`,
  apiVersion: "1.0.0",
  socialLinks: [],
};

export const siteMetadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary",
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export type SiteConfig = typeof siteConfig;
