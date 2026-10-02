export type SeedPatient = {
  hrn: string;
  patientType: "Recipient" | "Donor";
  firstName: string;
  lastName: string;
  sex: "M" | "F";
  birthDate: string;
  contactNumber: string;
  accountEmail: string;
  stage: "Orientation" | "Phase1" | "Phase2" | "Clearances" | "PhilHealthZ" | "Phase3" | "PostKT";
  status: "Active";
  riskCategory: "StandardLow" | "High";
  surgeryDate: string | null;
  nephrologistName: string;
  fellowName: string;
};

export const SEED_DOCTORS = [
  { name: "Dr. Maria Santos", role: "Nephrologist" },
  { name: "Dr. Roberto Cruz", role: "Nephrologist" },
  { name: "Dr. Juan Reyes", role: "Fellow" },
  { name: "Dr. Ana Lim", role: "Fellow" },
] as const;

export const SEED_PATIENTS: readonly SeedPatient[] = [
  {
    hrn: "KTP-2026-0001",
    patientType: "Recipient",
    firstName: "Alai",
    lastName: "Patient",
    sex: "F",
    birthDate: "1988-03-14",
    contactNumber: "0917-555-0101",
    accountEmail: "alai12152201@gmail.com",
    stage: "PostKT",
    status: "Active",
    riskCategory: "StandardLow",
    surgeryDate: "2026-01-15",
    nephrologistName: "Dr. Maria Santos",
    fellowName: "Dr. Juan Reyes",
  },
  {
    hrn: "KTP-2026-0002",
    patientType: "Recipient",
    firstName: "Nestor",
    lastName: "Abellera",
    sex: "M",
    birthDate: "1965-08-30",
    contactNumber: "0917-555-0102",
    accountEmail: "nestor.abellera.ktp@gmail.com",
    stage: "Phase1",
    status: "Active",
    riskCategory: "StandardLow",
    surgeryDate: null,
    nephrologistName: "Dr. Roberto Cruz",
    fellowName: "Dr. Ana Lim",
  },
  {
    hrn: "KTP-2026-0003",
    patientType: "Recipient",
    firstName: "Marilou",
    lastName: "Bautista",
    sex: "F",
    birthDate: "1982-11-20",
    contactNumber: "0917-555-0103",
    accountEmail: "marilou.bautista.ktp@gmail.com",
    stage: "Phase2",
    status: "Active",
    riskCategory: "StandardLow",
    surgeryDate: null,
    nephrologistName: "Dr. Maria Santos",
    fellowName: "Dr. Juan Reyes",
  },
  {
    hrn: "KTP-2026-0004",
    patientType: "Recipient",
    firstName: "Maricar",
    lastName: "Gallardo",
    sex: "F",
    birthDate: "1992-04-03",
    contactNumber: "0917-555-0104",
    accountEmail: "maricar.gallardo.ktp@gmail.com",
    stage: "Clearances",
    status: "Active",
    riskCategory: "StandardLow",
    surgeryDate: null,
    nephrologistName: "Dr. Maria Santos",
    fellowName: "Dr. Ana Lim",
  },
  {
    hrn: "KTP-2026-0005",
    patientType: "Recipient",
    firstName: "Bernardo",
    lastName: "Ilagan",
    sex: "M",
    birthDate: "1979-07-21",
    contactNumber: "0917-555-0105",
    accountEmail: "bernardo.ilagan.ktp@gmail.com",
    stage: "PhilHealthZ",
    status: "Active",
    riskCategory: "High",
    surgeryDate: null,
    nephrologistName: "Dr. Roberto Cruz",
    fellowName: "Dr. Juan Reyes",
  },
  {
    hrn: "KTP-2026-0006",
    patientType: "Recipient",
    firstName: "Charito",
    lastName: "Esguerra",
    sex: "F",
    birthDate: "1970-02-11",
    contactNumber: "0917-555-0106",
    accountEmail: "charito.esguerra.ktp@gmail.com",
    stage: "Phase3",
    status: "Active",
    riskCategory: "StandardLow",
    surgeryDate: null,
    nephrologistName: "Dr. Roberto Cruz",
    fellowName: "Dr. Ana Lim",
  },
  {
    hrn: "KTP-2026-0007",
    patientType: "Recipient",
    firstName: "Eduardo",
    lastName: "Ramos",
    sex: "M",
    birthDate: "1985-05-12",
    contactNumber: "0917-555-0107",
    accountEmail: "eduardo.ramos.ktp@gmail.com",
    stage: "Orientation",
    status: "Active",
    riskCategory: "StandardLow",
    surgeryDate: null,
    nephrologistName: "Dr. Maria Santos",
    fellowName: "Dr. Juan Reyes",
  },
];
