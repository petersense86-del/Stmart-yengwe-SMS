// Zambian Provinces and Districts
export const PROVINCES: Record<string, { capital: string; districts: string[] }> = {
  "Central Province": {
    capital: "Kabwe",
    districts: ["Chibombo", "Chisamba", "Chitambo", "Itezhi-Tezhi", "Kabwe", "Kapiri Mposhi", "Luano", "Mkushi", "Mumbwa", "Ngabwe", "Serenje"],
  },
  "Copperbelt Province": {
    capital: "Ndola",
    districts: ["Chililabombwe", "Chingola", "Kalulushi", "Kitwe", "Luanshya", "Lufwanyama", "Masaiti", "Mpongwe", "Mufulira", "Ndola"],
  },
  "Eastern Province": {
    capital: "Chipata",
    districts: ["Chadiza", "Chasefu", "Chipangali", "Chipata", "Kasenengwa", "Katete", "Lumezi", "Lundazi", "Lusangazi", "Mambwe", "Nyimba", "Petauke", "Sinda", "Vubwi", "Lumezi New District"],
  },
  "Luapula Province": {
    capital: "Mansa",
    districts: ["Chembe", "Chiengi", "Chifunabuli", "Chipili", "Kawambwa", "Lunga", "Mansa", "Milenge", "Mwansabombwe", "Mwense", "Nchelenge", "Samfya"],
  },
  "Lusaka Province": {
    capital: "Lusaka",
    districts: ["Chilanga", "Chirundu", "Chongwe", "Kafue", "Luangwa", "Lusaka", "Rufunsa", "Shibuyunji"],
  },
  "Muchinga Province": {
    capital: "Chinsali",
    districts: ["Chama", "Chinsali", "Isoka", "Kanchibiya", "Lavushimanda", "Mafinga", "Mpika", "Nakonde", "Shiwang'andu"],
  },
  "Northern Province": {
    capital: "Kasama",
    districts: ["Chilubi", "Kaputa", "Kasama", "Lunte", "Lupososhi", "Luwingu", "Mbala", "Mporokoso", "Mpulungu", "Mungwi", "Nsama", "Senga Hill"],
  },
  "North-Western Province": {
    capital: "Solwezi",
    districts: ["Chavuma", "Ikelenge", "Kabompo", "Kalumbila", "Kasempa", "Manyinga", "Mufumbwe", "Mushindamo", "Mwinilunga", "Solwezi", "Zambezi"],
  },
  "Southern Province": {
    capital: "Choma",
    districts: ["Chikankata", "Choma", "Gwembe", "Kalomo", "Kazungula", "Livingstone", "Mazabuka", "Monze", "Namwala", "Pemba", "Siavonga", "Sinazongwe", "Zimba", "Itezhi-Tezhi", "Kalomo New District"],
  },
  "Western Province": {
    capital: "Mongu",
    districts: ["Kalabo", "Kaoma", "Limulunga", "Luampa", "Lukulu", "Mitete", "Mongu", "Mulobezi", "Mwandi", "Nalolo", "Nkeyema", "Senanga", "Sesheke", "Shangombo", "Sikongo", "Sioma"],
  },
};

// ---------------------------------------------------------------------------
// Forms (Zambian secondary curriculum). Forms 1–4 are Ordinary Level, Forms 5–6
// Advanced Level. Older records may still hold legacy grades such as "10A".
// ---------------------------------------------------------------------------
export const FORMS = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6"] as const;
export type Form = (typeof FORMS)[number];
export type Grade = string;

export const FORM_INFO: Record<Form, { level: "Ordinary Level" | "Advanced Level"; qualification: string }> = {
  "Form 1": { level: "Ordinary Level", qualification: "O-Level" },
  "Form 2": { level: "Ordinary Level", qualification: "O-Level" },
  "Form 3": { level: "Ordinary Level", qualification: "O-Level" },
  "Form 4": { level: "Ordinary Level", qualification: "National School Certificate" },
  "Form 5": { level: "Advanced Level", qualification: "A-Level" },
  "Form 6": { level: "Advanced Level", qualification: "A-Level" },
};

export function isForm(g?: string): g is Form {
  return !!g && (FORMS as readonly string[]).includes(g);
}
export function isALevel(g?: string) {
  return g === "Form 5" || g === "Form 6";
}
/** "Form 3" stays as is; a legacy grade such as "10A" reads "Grade 10A". */
export function formLabel(g?: string) {
  if (!g) return "";
  return isForm(g) ? g : `Grade ${g}`;
}

// Ordinary Level subject catalogue (Forms 1–4). Schools choose which they offer.
export const O_LEVEL_SUBJECTS = [
  "English Language",
  "Mathematics",
  "Biology",
  "Chemistry",
  "Physics",
  "Agricultural Science",
  "Computer Science",
  "Information and Communication Technology (ICT)",
  "Civic Education",
  "Geography",
  "History",
  "Religious Education",
  "Literature in English",
  "Zambian Languages",
  "French",
  "Commerce",
  "Principles of Accounts",
  "Design and Technology Studies",
  "Art and Design",
  "Music Arts",
  "Physical Education",
  "Fashion and Fabrics",
  "Food and Nutrition",
  "Hospitality Management",
  "Travel and Tourism",
];

// Advanced Level pathways (Forms 5–6). Associated subjects are indicative.
export const A_LEVEL_PATHWAYS: { name: string; subjects: string[] }[] = [
  { name: "Natural Sciences", subjects: ["Biology", "Chemistry", "Physics", "Mathematics"] },
  { name: "Agricultural Science", subjects: ["Agricultural Science", "Biology", "Chemistry"] },
  { name: "Computer Science", subjects: ["Computer Science", "Mathematics", "Physics"] },
  { name: "Design and Technology", subjects: ["Design and Technology", "Mathematics"] },
  { name: "Business Studies", subjects: ["Commerce", "Accounting", "Economics"] },
  { name: "Social Sciences and Languages", subjects: ["Geography", "History", "Civic Education", "Languages"] },
  { name: "Performing and Creative Arts", subjects: ["Art and Design", "Music"] },
  { name: "Physical Education and Sports", subjects: ["Physical Education", "Sports Science"] },
  { name: "Hospitality Management", subjects: ["Hospitality Management", "Food and Nutrition"] },
  { name: "Travel and Tourism", subjects: ["Travel and Tourism", "Geography"] },
  { name: "Textile Design and Technology", subjects: ["Fashion and Fabrics", "Design and Technology"] },
  { name: "Nutrition and Food Technology", subjects: ["Food and Nutrition", "Biology", "Chemistry"] },
];

export const A_LEVEL_SUBJECTS = Array.from(new Set(A_LEVEL_PATHWAYS.flatMap((p) => p.subjects)));
export const A_LEVEL_MIN_SUBJECTS = 3;
export const A_LEVEL_MAX_SUBJECTS = 4;

export const DEFAULT_STREAMS = ["A", "B"];

// ---------------------------------------------------------------------------
// Assessments: three tests per term; the third is the end-of-term (or year) test.
// A result's `term` field holds the assessment name.
// ---------------------------------------------------------------------------
export const TERMS = ["Term 1", "Term 2", "Term 3"] as const;
export const ASSESSMENTS: { term: (typeof TERMS)[number]; name: string }[] = [
  { term: "Term 1", name: "Term 1 Test 1" },
  { term: "Term 1", name: "Term 1 Test 2" },
  { term: "Term 1", name: "End of Term 1 Test" },
  { term: "Term 2", name: "Term 2 Test 1" },
  { term: "Term 2", name: "Term 2 Test 2" },
  { term: "Term 2", name: "End of Term 2 Test" },
  { term: "Term 3", name: "Term 3 Test 1" },
  { term: "Term 3", name: "Term 3 Test 2" },
  { term: "Term 3", name: "End of Year Test" },
];

/** Position for sorting; legacy values such as "Term 2" sort with their term. */
export function assessmentOrder(name: string) {
  const i = ASSESSMENTS.findIndex((a) => a.name === name);
  if (i >= 0) return i;
  const t = TERMS.findIndex((term) => name.startsWith(term));
  return t >= 0 ? t * 3 + 2.5 : -1;
}

export const DEPARTMENTS = [
  "Mathematics",
  "Sciences",
  "Languages",
  "Social Studies",
  "Business Studies",
  "Technical Subjects",
  "Creative Arts",
  "Physical Education",
  "Agriculture",
  "Home Economics",
  "IT Department",
  "Religious Education",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export type Role = "headteacher" | "deputy" | "hod" | "teacher" | "pupil";

// The school logo as base64 will be managed dynamically; we use the provided one.
export const SCHOOL_MOTTO = "RISE & SHINE";
export const SCHOOL_NAME = "YENGWE SECONDARY SCHOOL";
export const SCHOOL_EMAIL = "info@yengwesecondary.edu.zm";
