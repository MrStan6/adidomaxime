import { z } from "zod";
import { CONTACT_TOPICS, EQUIPMENT_OPTIONS, EVENT_TYPES, LAYOUTS } from "../labels";
import {
  consentField,
  dateField,
  emailField,
  optionalEmail,
  optionalPhone,
  optionalText,
  phoneField,
  requiredText,
  timeField,
  todayIso,
} from "./common";

/** Formulaire public de demande de devis / de disponibilité d'une salle. */
export const quoteRequestSchema = z
  .object({
    request_type: z.enum(["quote", "availability"]).default("quote"),
    full_name: requiredText("Votre nom", 2, 120),
    organization: optionalText(160),
    phone: phoneField,
    email: emailField,
    event_type: z.enum(EVENT_TYPES, { errorMap: () => ({ message: "Choisissez un type d'événement." }) }),
    venue: z.string({ required_error: "Choisissez une salle ou demandez une recommandation." }).min(1, "Choisissez une salle ou demandez une recommandation."),
    event_date: dateField("La date souhaitée").refine((v) => v >= todayIso(), "La date doit être aujourd'hui ou ultérieure."),
    start_time: timeField("L'heure de début"),
    end_time: timeField("L'heure de fin"),
    participants: z.coerce
      .number({ invalid_type_error: "Indiquez un nombre de participants." })
      .int("Indiquez un nombre entier.")
      .min(1, "Indiquez au moins 1 participant.")
      .max(10000, "Nombre trop élevé."),
    layout: z
      .union([z.enum(LAYOUTS), z.literal("")])
      .optional()
      .transform((v) => (v ? v : undefined)),
    equipment: z.array(z.enum(EQUIPMENT_OPTIONS)).max(EQUIPMENT_OPTIONS.length).default([]),
    catering: optionalText(1000),
    budget: optionalText(100),
    message: optionalText(3000),
    privacy: consentField,
  })
  .refine((d) => d.end_time > d.start_time, {
    path: ["end_time"],
    message: "L'heure de fin doit être après l'heure de début. Pour un événement sur plusieurs jours, précisez-le dans le message.",
  })
  .refine((d) => d.venue === "recommend" || z.string().uuid().safeParse(d.venue).success, {
    path: ["venue"],
    message: "Choisissez une salle ou demandez une recommandation.",
  });

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>;

/** Formulaire de contact. */
export const contactSchema = z
  .object({
    full_name: requiredText("Le nom", 2, 120),
    email: optionalEmail,
    phone: optionalPhone,
    topic: z.enum(CONTACT_TOPICS, { errorMap: () => ({ message: "Choisissez un sujet." }) }),
    message: requiredText("Le message", 10, 3000),
    privacy: consentField,
  })
  .refine((d) => d.email || d.phone, {
    path: ["email"],
    message: "Indiquez au moins une adresse électronique ou un numéro de téléphone.",
  });

export type ContactInput = z.infer<typeof contactSchema>;

/** Recherche de disponibilités (hébergement). */
export const roomSearchSchema = z
  .object({
    check_in: dateField("La date d'arrivée").refine((v) => v >= todayIso(), "La date d'arrivée doit être aujourd'hui ou ultérieure."),
    check_out: dateField("La date de départ"),
    adults: z.coerce.number().int().min(1, "Au moins 1 adulte.").max(20),
    children: z.coerce.number().int().min(0).max(20).default(0),
    rooms: z.coerce.number().int().min(1, "Au moins 1 chambre.").max(10),
  })
  .refine((d) => d.check_out > d.check_in, { path: ["check_out"], message: "La date de départ doit être après la date d'arrivée." })
  .refine((d) => (Date.parse(d.check_out) - Date.parse(d.check_in)) / 86_400_000 <= 30, {
    path: ["check_out"],
    message: "Séjour limité à 30 nuits en ligne. Contactez-nous pour un séjour plus long.",
  })
  .refine((d) => d.adults >= d.rooms, { path: ["rooms"], message: "Chaque chambre doit accueillir au moins un adulte." });

export type RoomSearchInput = z.infer<typeof roomSearchSchema>;

/** Finalisation d'une réservation de chambre (informations client). */
export const roomBookingSchema = z.object({
  room_type_id: z.string().uuid(),
  check_in: dateField("La date d'arrivée"),
  check_out: dateField("La date de départ"),
  adults: z.coerce.number().int().min(1).max(20),
  children: z.coerce.number().int().min(0).max(20).default(0),
  rooms: z.coerce.number().int().min(1).max(10),
  full_name: requiredText("Votre nom", 2, 120),
  phone: phoneField,
  email: emailField,
  special_requests: optionalText(1000),
  expected_total: z.string().regex(/^\d+(\.\d{1,2})?$/, "Montant invalide."),
  terms: z
    .union([z.literal("on"), z.literal("true")], {
      errorMap: () => ({ message: "Vous devez accepter les conditions de réservation et d'annulation." }),
    }),
  privacy: consentField,
});

export type RoomBookingInput = z.infer<typeof roomBookingSchema>;
