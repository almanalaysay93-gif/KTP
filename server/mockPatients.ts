import { SEED_DOCTORS } from "./seedPatients";

/**
 * Mock recipients and living donors for local demos and UI checks. Runs only when KTP_LOCAL_MODE=1
 * and KTP_MOCK_PATIENTS=<count> are both set, so hosted databases never receive them. HRNs carry the
 * KTP-MOCK- prefix so they can be removed with one DELETE (KTP_MOCK_RESET=1 does that on startup).
 *
 * Every profile is stage-consistent: earlier stages are complete (see mockChecklist.ts), surgery
 * dates exist only after transplant and lie in the past, risk category is set once CDTE is done,
 * and each donor is linked to a recipient at the matching point of the pathway.
 */
export const MOCK_HRN_PREFIX = "KTP-MOCK-";
export const MOCK_PATIENT_LIMIT = 500;
export const MOCK_ANCHOR = Date.UTC(2026, 10, 10);

export const RECIPIENT_STAGES = ["Orientation", "Phase1", "Phase2", "Clearances", "PhilHealthZ", "Phase3", "PostKT"] as const;
export const DONOR_STAGES = ["Orientation", "Phase1", "Phase2", "Clearances", "Phase3", "PostDonation"] as const;
export type MockStage = (typeof RECIPIENT_STAGES)[number] | (typeof DONOR_STAGES)[number];
export type MockType = "Recipient" | "Donor";

export type MockPatient = {
  hrn: string;
  patientType: MockType;
  firstName: string;
  middleName: string;
  lastName: string;
  sex: "M" | "F";
  birthDate: string;
  contactNumber: string;
  stage: MockStage;
  /** ISO start date of every stage up to and including the current one. */
  stageStarts: string[];
  riskCategory: "StandardLow" | "High" | null;
  surgeryDate: string | null;
  linkedRecipientHrn: string | null;
  nephrologistName: string;
  fellowName: string;
};

export type MockSqlClient = {
  unsafe(query: string, parameters?: any[]): PromiseLike<any>;
};

const FEMALE_FIRST_NAMES = ["Maria", "Ana", "Rosario", "Luz", "Teresita", "Corazon", "Marites", "Elena", "Liza", "Jocelyn", "Grace", "Rowena", "Cristina", "Lorna", "Melanie", "Joy", "Nora", "Imelda", "Divina", "Gemma", "Kristine", "Angelica", "Precious", "Mylene"];
const MALE_FIRST_NAMES = ["Jose", "Juan", "Antonio", "Ramon", "Eduardo", "Roberto", "Ricardo", "Manuel", "Rodel", "Jomar", "Arnel", "Dante", "Alfredo", "Wilfredo", "Danilo", "Rolando", "Noel", "Benjamin", "Carlo", "Edgar", "Mark Anthony", "John Paul", "Reynaldo", "Ferdinand"];
const LAST_NAMES = ["Santos", "Reyes", "Cruz", "Bautista", "Ocampo", "Garcia", "Mendoza", "Villanueva", "Ramos", "Aquino", "Dela Cruz", "Torres", "Tolentino", "Pascual", "Lacson", "Navarro", "Castillo", "Domingo", "Macaraeg", "Pangilinan", "Gonzales", "Lim", "Tan", "Uy", "Alcantara", "Pineda", "Serrano", "Abellera", "Ilagan", "Esguerra"];
const MOBILE_PREFIXES = ["0917", "0918", "0919", "0927", "0928", "0935", "0939", "0945", "0947", "0955", "0961", "0966", "0977", "0995", "0998"];
// Recipient pipeline: many early, fewer reach surgery; post-transplant follow-up is the largest group.
const RECIPIENT_WEIGHTS = [14, 16, 14, 16, 8, 8, 24];
// Typical days spent in each pre-transplant stage (min, spread).
const STAGE_DAYS: Record<string, [number, number]> = {
  Orientation: [7, 21], Phase1: [21, 35], Phase2: [28, 42], Clearances: [30, 60], PhilHealthZ: [14, 30], Phase3: [7, 14],
};
const NEPHROLOGISTS = SEED_DOCTORS.filter(d => d.role === "Nephrologist").map(d => d.name);
const FELLOWS = SEED_DOCTORS.filter(d => d.role === "Fellow").map(d => d.name);

// Seeded generator: the same counts always yield the same people, so reruns change nothing.
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(items: readonly T[], next: () => number): T => items[Math.floor(next() * items.length)] as T;
const between = (min: number, max: number, next: () => number) => min + Math.floor(next() * (max - min + 1));
export const dayIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const DAY = 86_400_000;

function weighted<T>(items: readonly T[], weights: number[], next: () => number): T {
  let roll = next() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) if ((roll -= weights[i]!) < 0) return items[i]!;
  return items[items.length - 1]!;
}

function birthDate(minAge: number, maxAge: number, next: () => number): string {
  return dayIso(MOCK_ANCHOR - (between(minAge, maxAge, next) * 365 + between(0, 364, next)) * DAY);
}

function phone(next: () => number): string {
  return `${pick(MOBILE_PREFIXES, next)}-${between(100, 999, next)}-${String(between(0, 9999, next)).padStart(4, "0")}`;
}

/**
 * Lays stage start dates backwards from an end point. For surgery stages the end point is the
 * surgery date; otherwise it is the day the current stage began.
 */
function timeline(stages: readonly string[], currentIndex: number, currentStart: number, next: () => number): string[] {
  const starts = new Array<number>(currentIndex + 1);
  starts[currentIndex] = currentStart;
  for (let i = currentIndex - 1; i >= 0; i--) {
    const [min, spread] = STAGE_DAYS[stages[i]!]!;
    starts[i] = starts[i + 1]! - between(min, min + spread, next) * DAY;
  }
  return starts.map(dayIso);
}

export function mockDonorCount(env: NodeJS.ProcessEnv, recipients: number): number {
  const raw = env.KTP_MOCK_DONORS;
  if (raw === undefined || raw === "") return Math.floor(recipients / 3);
  const count = Number(raw);
  return Number.isInteger(count) && count >= 0 && count <= recipients ? count : Math.floor(recipients / 3);
}

export function buildMockPatients(recipientCount: number, donorCount: number): MockPatient[] {
  const next = random(20260930);
  const recipients: MockPatient[] = Array.from({ length: recipientCount }, (_, index) => {
    const sex = next() < 0.45 ? "F" : "M";
    const stageIndex = RECIPIENT_STAGES.indexOf(weighted(RECIPIENT_STAGES, RECIPIENT_WEIGHTS, next));
    const stage = RECIPIENT_STAGES[stageIndex]!;
    const surgery = stage === "PostKT" ? MOCK_ANCHOR - between(21, 900, next) * DAY : null;
    const currentStart = surgery ?? MOCK_ANCHOR - between(3, 40, next) * DAY;
    return {
      hrn: `${MOCK_HRN_PREFIX}${String(index + 1).padStart(4, "0")}`,
      patientType: "Recipient",
      firstName: pick(sex === "F" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES, next),
      middleName: pick(LAST_NAMES, next),
      lastName: pick(LAST_NAMES, next),
      sex,
      birthDate: birthDate(19, 68, next),
      contactNumber: phone(next),
      stage,
      stageStarts: timeline(RECIPIENT_STAGES, stageIndex, currentStart, next),
      // CDTE (end of Clearances) sets the risk category; before that it is unknown.
      riskCategory: stageIndex > RECIPIENT_STAGES.indexOf("Clearances") ? (next() < 0.2 ? "High" : "StandardLow") : null,
      surgeryDate: surgery === null ? null : dayIso(surgery),
      linkedRecipientHrn: null,
      nephrologistName: pick(NEPHROLOGISTS, next),
      fellowName: pick(FELLOWS, next),
    };
  });

  // Each donor works up alongside one recipient; related donors usually share the surname.
  const donors = recipients.slice(0, donorCount).map((recipient, index): MockPatient => {
    const sex = next() < 0.6 ? "F" : "M";
    const stage: MockStage =
      recipient.stage === "PostKT" ? "PostDonation" : recipient.stage === "PhilHealthZ" ? "Clearances" : recipient.stage;
    const stageIndex = DONOR_STAGES.indexOf(stage as (typeof DONOR_STAGES)[number]);
    const currentStart = recipient.surgeryDate ? Date.parse(recipient.surgeryDate) : MOCK_ANCHOR - between(3, 40, next) * DAY;
    return {
      hrn: `${MOCK_HRN_PREFIX}D${String(index + 1).padStart(4, "0")}`,
      patientType: "Donor",
      firstName: pick(sex === "F" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES, next),
      middleName: pick(LAST_NAMES, next),
      lastName: next() < 0.7 ? recipient.lastName : pick(LAST_NAMES, next),
      sex,
      birthDate: birthDate(21, 58, next),
      contactNumber: phone(next),
      stage,
      stageStarts: timeline(DONOR_STAGES, stageIndex, currentStart, next),
      riskCategory: null,
      surgeryDate: recipient.surgeryDate,
      linkedRecipientHrn: recipient.hrn,
      nephrologistName: recipient.nephrologistName,
      fellowName: recipient.fellowName,
    };
  });
  return [...recipients, ...donors];
}

// No accountEmail: mock patients get no portal login and no outbound email.
const INSERT_MOCK_PATIENT = `
  INSERT INTO "ktp"."patients" (
    "hrn", "patientType", "firstName", "middleName", "lastName", "sex", "birthDate", "contactNumber",
    "accountEmail", "stage", "status", "riskCategory", "surgeryDate", "nephrologistId", "fellowId",
    "linkedRecipientId", "consentVersion", "consentAcceptedAt"
  ) VALUES (
    $1, $2, $3, $4, $5, $6, CAST($7 AS date), $8,
    NULL, $9, 'Active', $10, CAST($11 AS date),
    (SELECT "id" FROM "ktp"."doctors" WHERE "name" = $12 LIMIT 1),
    (SELECT "id" FROM "ktp"."doctors" WHERE "name" = $13 LIMIT 1),
    (SELECT "id" FROM "ktp"."patients" WHERE "hrn" = $14 LIMIT 1),
    1, CAST($15 AS timestamp)
  ) ON CONFLICT ("hrn") DO NOTHING`;

const MOCK_IDS = `SELECT "id" FROM "ktp"."patients" WHERE "hrn" LIKE '${MOCK_HRN_PREFIX}%'`;
const RESET_STATEMENTS = [
  `DELETE FROM "ktp"."labResults" WHERE "serviceRecordId" IN (SELECT "id" FROM "ktp"."serviceRecords" WHERE "patientId" IN (${MOCK_IDS}))`,
  ...["patientChecklist", "serviceRecords", "appointments", "reminderOutbox", "messageAcknowledgments", "messageRecipients", "notifications", "emailLogs", "activityLog"]
    .map(table => `DELETE FROM "ktp"."${table}" WHERE "patientId" IN (${MOCK_IDS})`),
  `DELETE FROM "ktp"."patients" WHERE "hrn" LIKE '${MOCK_HRN_PREFIX}%'`,
];

export function mockPatientCount(env: NodeJS.ProcessEnv): number {
  const raw = env.KTP_MOCK_PATIENTS;
  if (!raw) return 0;
  if (env.KTP_LOCAL_MODE !== "1") {
    console.warn("[Database] KTP_MOCK_PATIENTS is ignored outside local mode.");
    return 0;
  }
  const count = Number(raw);
  if (!Number.isInteger(count) || count < 1 || count > MOCK_PATIENT_LIMIT) {
    console.warn(`[Database] KTP_MOCK_PATIENTS must be an integer from 1 to ${MOCK_PATIENT_LIMIT}; skipped.`);
    return 0;
  }
  return count;
}

export function mockPatientsFromEnv(env: NodeJS.ProcessEnv): MockPatient[] {
  const count = mockPatientCount(env);
  return count === 0 ? [] : buildMockPatients(count, mockDonorCount(env, count));
}

export async function seedMockPatientsPg(client: MockSqlClient, env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const patients = mockPatientsFromEnv(env);
  if (patients.length === 0) return 0;
  if (env.KTP_MOCK_RESET === "1") {
    for (const statement of RESET_STATEMENTS) await client.unsafe(statement);
    console.log("[Database] Removed previous KTP-MOCK- patients and their records.");
  }
  // Local mode skips the hosted seed, so the doctor directory can be empty; mock patients need it.
  for (const d of SEED_DOCTORS) {
    await client.unsafe(
      `INSERT INTO "ktp"."doctors" ("name", "role") SELECT $1::varchar, $2::varchar
       WHERE NOT EXISTS (SELECT 1 FROM "ktp"."doctors" WHERE "name" = $1::varchar)`,
      [d.name, d.role],
    );
  }
  // Recipients come first in the list, so donor links always resolve.
  for (const p of patients) {
    await client.unsafe(INSERT_MOCK_PATIENT, [
      p.hrn, p.patientType, p.firstName, p.middleName, p.lastName, p.sex, p.birthDate, p.contactNumber,
      p.stage, p.riskCategory, p.surgeryDate, p.nephrologistName, p.fellowName, p.linkedRecipientHrn,
      `${p.stageStarts[0]}T09:00:00Z`,
    ]);
    // Rows seeded before the doctor directory existed: fill the missing links only.
    await client.unsafe(
      `UPDATE "ktp"."patients" SET
         "nephrologistId" = COALESCE("nephrologistId", (SELECT "id" FROM "ktp"."doctors" WHERE "name" = $2::varchar LIMIT 1)),
         "fellowId" = COALESCE("fellowId", (SELECT "id" FROM "ktp"."doctors" WHERE "name" = $3::varchar LIMIT 1))
       WHERE "hrn" = $1::varchar AND ("nephrologistId" IS NULL OR "fellowId" IS NULL)`,
      [p.hrn, p.nephrologistName, p.fellowName],
    );
  }
  const donors = patients.filter(p => p.patientType === "Donor").length;
  console.log(`[Database] Mock patients ready: ${patients.length - donors} recipients, ${donors} donors`);
  return patients.length;
}
