import { A_LEVEL_PATHWAYS, A_LEVEL_SUBJECTS, DEFAULT_STREAMS, FORMS, O_LEVEL_SUBJECTS, isALevel, isForm } from "../data/constants";
import { YENGWE_GRADES, type SchoolSettings, type User, type YengweGrade } from "../types";

/*
 * The school's academic setup: grading scale, and the subjects, streams and
 * pathways each form offers. Everything falls back to sensible defaults until
 * an administrator changes it on the Forms & Grading page.
 */

type Settings = Pick<SchoolSettings, "gradingScale" | "passMark" | "goodMark" | "formSubjects" | "formStreams" | "formPathways">;

/** Bands from highest to lowest minimum. */
export function gradingScale(s: Settings): YengweGrade[] {
  const scale = s.gradingScale?.length ? s.gradingScale : YENGWE_GRADES;
  return [...scale].sort((a, b) => b.min - a.min);
}

/** The band a score falls in. Uses minimums only, so averages like 74.5 never fall between bands. */
export function gradeFor(score: number, s: Settings): YengweGrade {
  const scale = gradingScale(s);
  return scale.find((g) => score >= g.min) || scale[scale.length - 1];
}

export function performanceColor(score: number, s: Settings): "red" | "yellow" | "green" {
  if (score < (s.passMark ?? 40)) return "red";
  if (score < (s.goodMark ?? 60)) return "yellow";
  return "green";
}

/** The full catalogue a form chooses from. */
export function subjectCatalogue(form?: string): string[] {
  return isALevel(form) ? A_LEVEL_SUBJECTS : O_LEVEL_SUBJECTS;
}

/** Subjects the school offers in a form. Legacy grades see every subject. */
export function formSubjects(s: Settings, form?: string): string[] {
  if (!isForm(form)) return allOfferedSubjects(s);
  return s.formSubjects?.[form] ?? subjectCatalogue(form);
}

export function allOfferedSubjects(s: Settings): string[] {
  return Array.from(new Set(FORMS.flatMap((f) => formSubjects(s, f))));
}

export function formStreams(s: Settings, form?: string): string[] {
  const streams = form ? s.formStreams?.[form] : undefined;
  return streams?.length ? streams : DEFAULT_STREAMS;
}

export function formPathways(s: Settings, form?: string) {
  if (!isALevel(form)) return [];
  const enabled = s.formPathways?.[form!];
  return enabled ? A_LEVEL_PATHWAYS.filter((p) => enabled.includes(p.name)) : A_LEVEL_PATHWAYS;
}

/** What a pupil studies: their chosen combination at A-Level, otherwise the form's subjects. */
export function pupilSubjects(pupil: Pick<User, "grade" | "subjects">, s: Settings): string[] {
  if (isALevel(pupil.grade) && pupil.subjects?.length) return pupil.subjects;
  return formSubjects(s, pupil.grade);
}
