import { useMemo, useState } from "react";
import { Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card, Button, Input, Badge, PageHeader, Alert } from "../components/ui";
import { toast, confirmDialog } from "../components/feedback";
import { getDb, saveDb, logActivity, useDbVersion } from "../utils/db";
import { A_LEVEL_MAX_SUBJECTS, A_LEVEL_MIN_SUBJECTS, A_LEVEL_PATHWAYS, FORMS, FORM_INFO, isALevel, type Form } from "../data/constants";
import { YENGWE_GRADES, type SchoolSettings, type YengweGrade } from "../types";
import { formPathways, formStreams, formSubjects, gradingScale, performanceColor, subjectCatalogue } from "../utils/academics";

const TABS = ["grading", ...FORMS] as const;
type Tab = (typeof TABS)[number];

const BAND_TONE = { green: "bg-green-50 text-green-900", yellow: "bg-yellow-50 text-yellow-900", red: "bg-red-50 text-red-900" };

function useSaveSettings() {
  const { user } = useAuth();
  return (patch: Partial<SchoolSettings>, action: string, message: string) => {
    const db = getDb();
    db.settings = { ...db.settings, ...patch };
    saveDb(db);
    if (user) logActivity(user.id, user.fullName, user.role, action);
    toast.success(message);
  };
}

export default function AcademicSetup() {
  const [tab, setTab] = useState<Tab>("grading");
  return (
    <div className="space-y-5 max-w-5xl">
      <PageHeader title="Forms & Grading" subtitle="Your school's grading system, and the subjects, streams and pathways each form offers" />
      <div role="tablist" aria-label="Setup sections" className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((t) => (
          <button
            key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`whitespace-nowrap px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-emerald-700 text-white shadow-sm" : "bg-white ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50"}`}
          >
            {t === "grading" ? "Grading system" : t}
          </button>
        ))}
      </div>
      {tab === "grading" ? <GradingEditor /> : <FormSetup key={tab} form={tab} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grading system
// ---------------------------------------------------------------------------
type BandDraft = { grade: string; name: string; min: string };

function toDrafts(scale: YengweGrade[]): BandDraft[] {
  return scale.map((b) => ({ grade: b.grade, name: b.name, min: String(b.min) }));
}

function GradingEditor() {
  const save = useSaveSettings();
  const settings = getDb().settings;
  const [bands, setBands] = useState<BandDraft[]>(() => toDrafts(gradingScale(settings)));
  const [passMark, setPassMark] = useState(String(settings.passMark ?? 40));
  const [goodMark, setGoodMark] = useState(String(settings.goodMark ?? 60));
  const [error, setError] = useState("");

  const sorted = [...bands].map((b, i) => ({ ...b, i, n: Number(b.min) })).sort((a, b) => b.n - a.n);
  const marks = { passMark: Number(passMark), goodMark: Number(goodMark) };

  function update(i: number, patch: Partial<BandDraft>) {
    setBands((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  function handleSave() {
    setError("");
    if (bands.length === 0) return setError("Add at least one grade.");
    const mins = bands.map((b) => Number(b.min));
    if (bands.some((b) => !b.grade.trim())) return setError("Every band needs a grade label (e.g. 1, A, Distinction).");
    if (bands.some((b) => b.min.trim() === "") || mins.some((m) => !Number.isInteger(m) || m < 0 || m > 100)) return setError("Minimum marks must be whole numbers from 0 to 100.");
    if (new Set(mins).size !== mins.length) return setError("Two bands have the same minimum mark.");
    if (!mins.includes(0)) return setError("The lowest band must start at 0 so every mark gets a grade.");
    const p = Number(passMark), g = Number(goodMark);
    if (!Number.isFinite(p) || !Number.isFinite(g) || p < 0 || g > 100 || p > g) return setError("The pass mark must be between 0 and the good mark, and the good mark at most 100.");

    const ordered = [...bands].sort((a, b) => Number(b.min) - Number(a.min));
    const scale: YengweGrade[] = ordered.map((b, i) => ({
      grade: b.grade.trim(), name: b.name.trim() || b.grade.trim(), min: Number(b.min), max: i === 0 ? 100 : Number(ordered[i - 1].min) - 1,
    }));
    save({ gradingScale: scale, passMark: p, goodMark: g }, "Updated the grading system", "Grading system saved. Results and report cards now use it.");
    setBands(toDrafts(scale));
  }

  async function restoreDefault() {
    if (!await confirmDialog({ title: "Restore the default scale?", message: "Your bands will be replaced by the standard 9-point scale (1–9) when you save.", confirmLabel: "Restore" })) return;
    setBands(toDrafts(YENGWE_GRADES));
    setPassMark("40");
    setGoodMark("60");
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Grade bands</h3>
            <p className="text-sm text-gray-500">Each band starts at its minimum mark and runs up to the next band. Used on the results pages and every report card.</p>
          </div>
          <Button variant="ghost" onClick={restoreDefault}><RotateCcw className="w-4 h-4" />Default 9-point scale</Button>
        </div>
        {error && <Alert tone="error" className="mb-3">{error}</Alert>}
        <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-3 py-2.5 text-left w-28">Grade</th>
                <th className="px-3 py-2.5 text-left min-w-[160px]">Remark</th>
                <th className="px-3 py-2.5 text-left w-28">From (%)</th>
                <th className="px-3 py-2.5 text-left w-28">Range</th>
                <th className="px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((b, pos) => {
                const top = pos === 0 ? 100 : sorted[pos - 1].n - 1;
                const valid = b.min.trim() !== "" && Number.isInteger(b.n) && b.n >= 0 && b.n <= 100;
                return (
                  <tr key={b.i}>
                    <td className="px-3 py-2"><Input aria-label="Grade" value={b.grade} onChange={(e) => update(b.i, { grade: e.target.value })} maxLength={12} /></td>
                    <td className="px-3 py-2"><Input aria-label="Remark" value={b.name} onChange={(e) => update(b.i, { name: e.target.value })} placeholder="e.g. Distinction" maxLength={40} /></td>
                    <td className="px-3 py-2"><Input aria-label="Minimum mark" type="number" min={0} max={100} value={b.min} onChange={(e) => update(b.i, { min: e.target.value })} /></td>
                    <td className="px-3 py-2">
                      {valid ? <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium tabular-nums ${BAND_TONE[performanceColor(b.n, marks)]}`}>{b.n}–{top}%</span> : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setBands((prev) => prev.filter((_, idx) => idx !== b.i))} aria-label={`Remove grade ${b.grade}`} className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Button variant="ghost" className="mt-3" onClick={() => setBands((prev) => [...prev, { grade: "", name: "", min: "" }])}><Plus className="w-4 h-4" />Add band</Button>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">Performance colours</h3>
        <p className="text-sm text-gray-500 mb-4">Averages below the pass mark show <span className="text-red-700 font-medium">red</span>, from the pass mark <span className="text-yellow-700 font-medium">yellow</span>, and from the good mark <span className="text-green-700 font-medium">green</span>.</p>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <Input label="Pass mark (%)" type="number" min={0} max={100} value={passMark} onChange={(e) => setPassMark(e.target.value)} />
          <Input label="Good mark (%)" type="number" min={0} max={100} value={goodMark} onChange={(e) => setGoodMark(e.target.value)} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="gold" onClick={handleSave}><Save className="w-4 h-4" />Save grading system</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One form: subjects, streams, pathways, and who is in it
// ---------------------------------------------------------------------------
function FormSetup({ form }: { form: Form }) {
  const save = useSaveSettings();
  const version = useDbVersion();
  const db = useMemo(() => getDb(), [version]);
  const settings = db.settings;
  const aLevel = isALevel(form);
  const info = FORM_INFO[form];

  const [subjects, setSubjects] = useState<string[]>(() => formSubjects(settings, form));
  const [streams, setStreams] = useState<string[]>(() => formStreams(settings, form));
  const [pathways, setPathways] = useState<string[]>(() => formPathways(settings, form).map((p) => p.name));
  const [newSubject, setNewSubject] = useState("");
  const [newStream, setNewStream] = useState("");
  const [error, setError] = useState("");

  const catalogue = Array.from(new Set([...subjectCatalogue(form), ...subjects]));
  const pupils = db.users.filter((u) => u.role === "pupil" && u.grade === form);
  const teachers = db.users.filter((u) => (u.role === "teacher" || u.role === "hod") && u.classes?.some((c) => c.grade === form));
  const orphanStreams = Array.from(new Set(pupils.map((p) => p.classSection || "A"))).filter((s) => !streams.includes(s));

  const toggle = (list: string[], set: (v: string[]) => void, item: string) => set(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  function addSubject() {
    const s = newSubject.trim().replace(/\s+/g, " ");
    if (!s) return;
    if (!catalogue.some((c) => c.toLowerCase() === s.toLowerCase())) setSubjects([...subjects, s]);
    else if (!subjects.includes(s)) setSubjects([...subjects, catalogue.find((c) => c.toLowerCase() === s.toLowerCase())!]);
    setNewSubject("");
  }
  function addStream() {
    const s = newStream.trim().toUpperCase();
    if (!s || streams.includes(s)) { setNewStream(""); return; }
    setStreams([...streams, s]);
    setNewStream("");
  }

  function handleSave() {
    setError("");
    if (subjects.length === 0) return setError("Select at least one subject this form offers.");
    if (streams.length === 0) return setError("Add at least one stream.");
    if (aLevel && pathways.length === 0) return setError("Offer at least one A-Level pathway.");
    save(
      {
        formSubjects: { ...settings.formSubjects, [form]: subjects },
        formStreams: { ...settings.formStreams, [form]: streams },
        ...(aLevel ? { formPathways: { ...settings.formPathways, [form]: pathways } } : {}),
      },
      `Updated ${form} subjects and streams`,
      `${form} setup saved.`,
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900 text-lg">{form}</h3>
          <Badge color="emerald">{info.level}</Badge>
          <Badge color="blue">{info.qualification}</Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {aLevel
            ? `Learners follow an approved pathway and take ${A_LEVEL_MIN_SUBJECTS}–${A_LEVEL_MAX_SUBJECTS} subjects, chosen when registering each pupil. Final combinations must follow Ministry guidelines.`
            : `The list below is the Ordinary Level catalogue. Tick only the subjects your school actually offers in ${form}.`}
          {form === "Form 4" && " Examination: National School Certificate Examination."}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat label="Pupils" value={pupils.length} />
          <Stat label="Streams" value={streams.length} />
          <Stat label="Subjects offered" value={subjects.length} />
          <Stat label="Teachers allocated" value={teachers.length} />
        </div>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}

      <Card>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">Subjects offered</h3>
          <div className="flex gap-3 text-xs font-medium">
            <button className="text-emerald-700 hover:underline" onClick={() => setSubjects(catalogue)}>Select all</button>
            <button className="text-gray-500 hover:underline" onClick={() => setSubjects([])}>Clear</button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
          {catalogue.map((s) => (
            <label key={s} className={`flex items-center gap-2 text-sm px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${subjects.includes(s) ? "bg-emerald-50 ring-1 ring-emerald-300 text-emerald-900" : "ring-1 ring-gray-200 hover:bg-gray-50"}`}>
              <input type="checkbox" className="accent-emerald-600 w-4 h-4" checked={subjects.includes(s)} onChange={() => toggle(subjects, setSubjects, s)} />
              <span>{s}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2 mt-3 max-w-md">
          <Input aria-label="New subject" placeholder="Add another subject…" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addSubject(); }} maxLength={60} />
          <Button variant="ghost" onClick={addSubject} disabled={!newSubject.trim()}><Plus className="w-4 h-4" />Add</Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">Classes &amp; streams</h3>
        <p className="text-sm text-gray-500 mb-3">Pupils, teachers and homework are allocated to a stream, e.g. {form} A.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {streams.map((s) => {
            const count = pupils.filter((p) => (p.classSection || "A") === s).length;
            return (
              <span key={s} className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-600/20">
                {form} {s}<span className="text-xs text-blue-600">· {count} pupil{count === 1 ? "" : "s"}</span>
                <button onClick={() => setStreams(streams.filter((x) => x !== s))} aria-label={`Remove stream ${s}`} className="p-0.5 rounded-full hover:bg-blue-100"><X className="w-3.5 h-3.5" /></button>
              </span>
            );
          })}
        </div>
        <div className="flex gap-2 max-w-xs">
          <Input aria-label="New stream" placeholder="e.g. C" value={newStream} onChange={(e) => setNewStream(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addStream(); }} maxLength={12} />
          <Button variant="ghost" onClick={addStream} disabled={!newStream.trim()}><Plus className="w-4 h-4" />Add</Button>
        </div>
        {orphanStreams.length > 0 && (
          <Alert tone="warning" className="mt-3">Some pupils are still in stream {orphanStreams.join(", ")}, which isn't in this list. Edit those pupils to move them.</Alert>
        )}
      </Card>

      {aLevel && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-1">A-Level pathways</h3>
          <p className="text-sm text-gray-500 mb-3">Pathways offered in {form}. Associated subjects are indicative.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {A_LEVEL_PATHWAYS.map((p) => (
              <label key={p.name} className={`flex items-start gap-2.5 text-sm p-3 rounded-lg cursor-pointer transition-colors ${pathways.includes(p.name) ? "bg-emerald-50 ring-1 ring-emerald-300" : "ring-1 ring-gray-200 hover:bg-gray-50"}`}>
                <input type="checkbox" className="accent-emerald-600 w-4 h-4 mt-0.5" checked={pathways.includes(p.name)} onChange={() => toggle(pathways, setPathways, p.name)} />
                <span>
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="block text-xs text-gray-500">{p.subjects.join(", ")}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="font-semibold text-gray-900 mb-3">Teacher allocation</h3>
        {teachers.length === 0 ? (
          <p className="text-sm text-gray-500">No teachers are allocated to {form} yet. Assign classes on the Teachers &amp; HoDs page.</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm">
            {teachers.map((t) => (
              <li key={t.id} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-gray-900">{t.fullName}</span>
                <span className="text-xs text-gray-500">Streams {t.classes!.filter((c) => c.grade === form).map((c) => c.section).join(", ")}</span>
                <span className="text-xs text-gray-600">{(t.subjects || []).filter((s) => subjects.includes(s)).join(", ") || "No matching subjects"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="gold" onClick={handleSave}><Save className="w-4 h-4" />Save {form} setup</Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 ring-1 ring-gray-200 px-3 py-2.5">
      <div className="text-xl font-bold text-gray-900 tabular-nums">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
