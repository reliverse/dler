export type KeyType = "string" | "email" | "password" | "number" | "boolean" | "database";

export type KeyVar =
  | "NEXT_PUBLIC_APP_URL"
  | "DATABASE_URL"
  | "AUTH_SECRET"
  | "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  | "CLERK_SECRET_KEY"
  | "CLERK_ENCRYPTION_KEY"
  | "UPLOADTHING_TOKEN"
  | "UPLOADTHING_SECRET"
  | "RESEND_API_KEY"
  | "EMAIL_FROM_ADDRESS"
  | "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  | "STRIPE_API_KEY"
  | "STRIPE_WEBHOOK_SECRET"
  | "STRIPE_PRO_MONTHLY_PRICE_ID";

export type DefaultValue =
  | "http://localhost:3000"
  | "onboarding@resend.dev"
  | "pk_test_"
  | "postgresql://postgres:postgres@localhost:5432/myapp"
  | "price_"
  | "re_"
  | "generate-64-chars"
  | "replace-me-with-token-from-dashboard"
  | "sk_live_"
  | "sk_test_"
  | "ut_app_"
  | "whsec_";

export interface ServiceKey {
  key: KeyVar;
  type: KeyType;
  instruction: string;
  defaultValue: DefaultValue;
  optional?: boolean;
}

export type DashboardUrl =
  | "none"
  | "https://clerk.com"
  | "https://neon.tech"
  | "https://dashboard.stripe.com"
  | "https://uploadthing.com/dashboard"
  | "https://resend.com/api-keys"
  | "https://dashboard.stripe.com/test/apikeys";

export interface KnownService {
  name: string;
  dashboardUrl: DashboardUrl;
  keys: ServiceKey[];
}

export const KNOWN_SERVICES: Record<string, KnownService> = {
  GENERAL: {
    name: "General",
    dashboardUrl: "none",
    keys: [
      {
        key: "NEXT_PUBLIC_APP_URL",
        type: "string",
        instruction:
          "The public URL where your app will be hosted. Use http://localhost:3000 for development.",
        defaultValue: "http://localhost:3000",
        optional: true,
      },
    ],
  },
  DATABASE: {
    name: "Database",
    dashboardUrl: "https://neon.tech",
    keys: [
      {
        key: "DATABASE_URL",
        type: "database",
        instruction:
          "For Neon, create a new project there and copy the connection string. Should start with: postgresql://",
        defaultValue: "postgresql://postgres:postgres@localhost:5432/myapp",
        optional: false,
      },
    ],
  },
  CLERK: {
    name: "Clerk",
    keys: [
      {
        key: "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
        type: "string",
        instruction:
          "- Your Clerk publishable key starting with 'pk_test_' or 'pk_live_'\n- If you already have an account, you can easily find it here: https://clerk.com/docs/quickstarts/nextjs",
        defaultValue: "pk_test_",
        optional: false,
      },
      {
        key: "CLERK_SECRET_KEY",
        type: "string",
        instruction:
          "- Your Clerk secret key starting with 'sk_test_' or 'sk_live_'\n- If you already have an account, you can easily find it here: https://clerk.com/docs/quickstarts/nextjs",
        defaultValue: "sk_test_",
        optional: false,
      },
      {
        key: "CLERK_ENCRYPTION_KEY",
        type: "string",
        instruction:
          "Your Clerk encryption key (must be a secure random string). Generate it on your own or via custom scripts if needed.",
        defaultValue: "generate-64-chars",
        optional: true,
      },
    ],
    dashboardUrl: "https://clerk.com",
  },
  STRIPE: {
    name: "Stripe",
    keys: [
      {
        key: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        type: "string",
        instruction:
          "- Developers > API keys > Publishable key\n- Starts with 'pk_test_' or 'pk_live_'",
        defaultValue: "pk_test_",
        optional: false,
      },
      {
        key: "STRIPE_API_KEY",
        type: "string",
        instruction: "- Developers > API keys > Secret key\n- Starts with 'sk_test_' or 'sk_live_'",
        defaultValue: "sk_test_",
        optional: false,
      },
      {
        key: "STRIPE_WEBHOOK_SECRET",
        type: "string",
        instruction: "Your Stripe webhook signing secret starting with 'whsec_'",
        defaultValue: "whsec_",
        optional: true,
      },
      {
        key: "STRIPE_PRO_MONTHLY_PRICE_ID",
        type: "string",
        instruction: "The price ID for your monthly pro plan starting with 'price_'",
        defaultValue: "price_",
        optional: true,
      },
    ],
    dashboardUrl: "https://dashboard.stripe.com/test/apikeys",
  },
  UPLOADTHING: {
    name: "Uploadthing",
    keys: [
      {
        key: "UPLOADTHING_TOKEN",
        type: "string",
        instruction: "Your Uploadthing app token from the dashboard",
        defaultValue: "replace-me-with-token-from-dashboard",
        optional: false,
      },
      {
        key: "UPLOADTHING_SECRET",
        type: "string",
        instruction: "Your Uploadthing secret key from the dashboard.\nStarts with 'sk_live_'",
        defaultValue: "sk_live_",
        optional: false,
      },
    ],
    dashboardUrl: "https://uploadthing.com/dashboard",
  },
  RESEND: {
    name: "Resend",
    keys: [
      {
        key: "RESEND_API_KEY",
        type: "string",
        instruction: "Your Resend API key starting with 're_'",
        defaultValue: "re_",
        optional: false,
      },
      {
        key: "EMAIL_FROM_ADDRESS",
        instruction: "The email address you want to send emails from",
        type: "email",
        defaultValue: "onboarding@resend.dev",
        optional: true,
      },
    ],
    dashboardUrl: "https://resend.com/api-keys",
  },
  AUTHJS: {
    name: "Auth.js",
    dashboardUrl: "none",
    keys: [
      {
        key: "AUTH_SECRET",
        type: "string",
        instruction:
          "The secret key used for Auth.js sessions. Generate it on your own or via custom scripts if needed.",
        defaultValue: "generate-64-chars",
        optional: false,
      },
    ],
  },
} as const;
