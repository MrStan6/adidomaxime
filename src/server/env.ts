import { z } from "zod";

/**
 * Lecture et validation des variables d'environnement (côté serveur uniquement).
 * Une erreur explicite est levée au démarrage si une variable est invalide.
 */
const boolString = z
  .enum(["true", "false", ""])
  .optional()
  .transform((v) => v === "true");

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    APP_MODE: z.enum(["demo", "production"]).default("demo"),
    SITE_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL est obligatoire"),
    // true : TLS avec vérification du certificat (recommandé) ; no-verify : TLS
    // sans vérification de l'autorité (à éviter, accepté pour un aperçu) ; false : sans TLS.
    DATABASE_SSL: z.enum(["true", "false", "no-verify", ""]).optional().transform((v) => (v === "" || v === undefined ? "false" : v)),
    // Certificat racine (PEM) de l'hébergeur de base, si non reconnu publiquement.
    DATABASE_SSL_CA: z.string().optional(),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    APP_SECRET: z.string().min(32, "APP_SECRET doit contenir au moins 32 caractères"),
    TRUST_PROXY: boolString,
    UPLOAD_DIR: z.string().default("./storage/uploads"),
    UPLOAD_MAX_MB: z.coerce.number().positive().max(50).default(8),
    EMAIL_PROVIDER: z.enum(["none", "smtp"]).default("none"),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: boolString,
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    NOTIFY_EMAIL: z.string().optional(),
    PAYMENT_PROVIDER: z.enum(["none", "demo"]).default("none"),
    DEMO_PAYMENT_WEBHOOK_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.APP_MODE === "production" && env.PAYMENT_PROVIDER === "demo") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PAYMENT_PROVIDER"],
        message: "Le prestataire de paiement de démonstration est interdit en mode production.",
      });
    }
    if (env.APP_MODE === "production" && /remplacer/.test(env.APP_SECRET)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["APP_SECRET"],
        message: "APP_SECRET contient encore la valeur d'exemple.",
      });
    }
    if (env.EMAIL_PROVIDER === "smtp" && (!env.SMTP_HOST || !env.EMAIL_FROM)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMTP_HOST"],
        message: "SMTP_HOST et EMAIL_FROM sont requis lorsque EMAIL_PROVIDER=smtp.",
      });
    }
    if (env.PAYMENT_PROVIDER === "demo" && (env.DEMO_PAYMENT_WEBHOOK_SECRET ?? "").length < 16) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEMO_PAYMENT_WEBHOOK_SECRET"],
        message: "DEMO_PAYMENT_WEBHOOK_SECRET (16 caractères min.) est requis avec PAYMENT_PROVIDER=demo.",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Configuration invalide :\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/** Réinitialise le cache (utilisé par les tests). */
export function resetEnvCache() {
  cached = null;
}

export const isProductionMode = () => env().APP_MODE === "production";
