import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Result, User, SchoolSettings } from "../types";
import { ASSESSMENTS, FORM_INFO, formLabel, isForm, type Role } from "../data/constants";
import { classTeacherId, gradeFor, performanceColor, resultGrading } from "./academics";
import { getDb, logActivity, saveDb } from "./db";

/** Report card for a single test. */
export function generateResultPDF(
  result: Result,
  pupil: User,
  downloadedBy: User,
  settings: SchoolSettings
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const grading = resultGrading(settings, result);
  drawHeader(doc, settings, `Pupil Report Card · ${result.term}`);
  let y = drawPupilInfo(doc, pupil, result.grade, "Test:", `${result.term} ${result.year}`);

  // Results table - only include PUBLISHED subjects
  const publishedScores = result.scores.filter((s) => s.published);
  const tableData = publishedScores.map((s, i) => {
    const g = gradeFor(s.score, grading);
    return [i + 1, s.subject, s.score.toString(), g.grade, g.name, s.teacherName];
  });

  autoTable(doc, {
    startY: y + 3,
    head: [["#", "Subject", "Score (%)", "Grade", "Remark", "Subject Teacher"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [13, 92, 46], textColor: 255, fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18 },
    },
  });

  // Summary (based on published scores only)
  y = lastTableY(doc) + 8;
  const avg = publishedScores.length > 0 ? publishedScores.reduce((sum, s) => sum + s.score, 0) / publishedScores.length : 0;
  drawSummary(doc, y, avg, gradeFor(avg, grading), `Subjects Published: ${publishedScores.length}`, settings);

  drawCommentAndSignatures(doc, y, result.classTeacherComment, classTeacherFor(settings, pupil, result), settings);
  finish(doc, settings, pupil, downloadedBy, result.id, `${result.term} ${result.year}`, `YPMS_${pupil.fullName.replace(/\s+/g, "_")}_${result.term}_${result.year}.pdf`);
}

/** One report for a whole term: each subject's Test 1, Test 2 and end-of-term marks with the term average. */
export function generateTermReportPDF(
  term: string,
  year: number,
  termResults: Result[],
  pupil: User,
  downloadedBy: User,
  settings: SchoolSettings
) {
  const tests = ASSESSMENTS.filter((a) => a.term === term).map((a) => a.name);
  const byTest = new Map(termResults.map((r) => [r.term, r]));
  // The end-of-term result (or the latest test) supplies the scale, comment and form.
  const main = [...tests].reverse().map((t) => byTest.get(t)).find(Boolean) || termResults[0];
  const grading = resultGrading(settings, main);

  const subjects = Array.from(new Set(termResults.flatMap((r) => r.scores.filter((s) => s.published).map((s) => s.subject)))).sort();
  const subjectAverages: number[] = [];
  const body = subjects.map((subject, i) => {
    const marks = tests.map((t) => byTest.get(t)?.scores.find((s) => s.subject === subject && s.published)?.score);
    const present = marks.filter((m): m is number => m !== undefined);
    const avg = present.reduce((a, b) => a + b, 0) / present.length;
    subjectAverages.push(avg);
    const g = gradeFor(avg, grading);
    return [i + 1, subject, ...marks.map((m) => (m === undefined ? "—" : String(m))), avg.toFixed(1), g.grade, g.name];
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawHeader(doc, settings, `${term} Report · ${year}`);
  let y = drawPupilInfo(doc, pupil, main?.grade, "Term:", `${term} ${year}`);

  autoTable(doc, {
    startY: y + 3,
    head: [["#", "Subject", ...tests.map((t) => t.replace(`${term} `, "")), "Average", "Grade", "Remark"]],
    body,
    theme: "grid",
    headStyles: { fillColor: [13, 92, 46], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 8 }, 2: { halign: "center" }, 3: { halign: "center" }, 4: { halign: "center" }, 5: { halign: "center", fontStyle: "bold" }, 6: { halign: "center" } },
  });

  y = lastTableY(doc) + 8;
  const overall = subjectAverages.length ? subjectAverages.reduce((a, b) => a + b, 0) / subjectAverages.length : 0;
  drawSummary(doc, y, overall, gradeFor(overall, grading), `Subjects: ${subjects.length} · each subject averages the tests taken`, settings);

  drawCommentAndSignatures(doc, y, main?.classTeacherComment, classTeacherFor(settings, pupil, main), settings);
  finish(doc, settings, pupil, downloadedBy, main?.id || "", `${term} report ${year}`, `YPMS_${pupil.fullName.replace(/\s+/g, "_")}_${term}_Report_${year}.pdf`);
}

// ---------------------------------------------------------------------------
// Shared layout
// ---------------------------------------------------------------------------
function lastTableY(doc: jsPDF) {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

/** The stream's class teacher from Forms & Grading; else whoever wrote the comment. */
function classTeacherFor(settings: SchoolSettings, pupil: User, result?: Result): User | undefined {
  const id = classTeacherId(settings, result?.grade || pupil.grade, pupil.classSection) || result?.classTeacherId;
  return id ? getDb().users.find((u) => u.id === id) : undefined;
}

function drawHeader(doc: jsPDF, settings: SchoolSettings, subtitle: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Faint background watermark (uploaded by Head/Deputy, falls back to the school logo),
  // drawn first so everything else sits on top.
  if (settings.watermarkEnabled !== false) {
    const watermarkSrc = settings.watermarkImage || settings.schoolLogo;
    if (watermarkSrc) {
      try {
        const GState = (jsPDF as any).GState || (jsPDF as any).API?.GState;
        const opacity = Math.max(0.01, Math.min(0.25, settings.watermarkOpacity ?? 0.04));
        if (typeof doc.setGState === "function" && GState) {
          doc.saveGraphicsState?.();
          doc.setGState(new GState({ opacity }));
        }
        const wmSize = 150;
        doc.addImage(watermarkSrc, "PNG", (pageWidth - wmSize) / 2, (pageHeight - wmSize) / 2 - 10, wmSize, wmSize);
        if (typeof doc.setGState === "function" && GState) {
          doc.restoreGraphicsState?.();
        }
      } catch { /* ignore */ }
    }
  }

  doc.setFillColor(13, 92, 46); // emerald-900
  doc.rect(0, 0, pageWidth, 30, "F");

  doc.setFillColor(255, 255, 255);
  doc.circle(20, 15, 10, "F");
  if (settings.schoolLogo) {
    try {
      doc.addImage(settings.schoolLogo, "PNG", 11, 6, 18, 18);
    } catch {}
  } else {
    doc.setTextColor(13, 92, 46);
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.text("Y", 20, 20, { align: "center" });
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("YENGWE SECONDARY SCHOOL", pageWidth / 2 + 10, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(subtitle, pageWidth / 2 + 10, 20, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(`Motto: ${settings.schoolMotto}`, pageWidth / 2 + 10, 26, { align: "center" });
}

/** Returns the y position below the block. */
function drawPupilInfo(doc: jsPDF, pupil: User, grade: string | undefined, periodLabel: string, period: string) {
  const startY = 38;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Pupil Information", 14, startY);
  doc.setFontSize(10);

  const g = grade || pupil.grade;
  const rows: [string, string, string, string][] = [
    ["Name:", pupil.fullName, "Pupil ID:", pupil.pupilId || "N/A"],
    ["Form:", `${formLabel(g)}${pupil.classSection ? ` ${pupil.classSection}` : ""}`, periodLabel, period],
    ["Gender:", pupil.gender || "N/A", isForm(g) ? "Level:" : "", isForm(g) ? FORM_INFO[g].level : ""],
  ];

  let y = startY + 5;
  rows.forEach((row) => {
    doc.setFont("helvetica", "bold");
    doc.text(row[0], 14, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(row[1]), 30, y);
    if (row[2]) {
      doc.setFont("helvetica", "bold");
      doc.text(row[2], 110, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(row[3]), 135, y);
    }
    y += 6;
  });
  return y;
}

function drawSummary(doc: jsPDF, y: number, avg: number, grade: { grade: string; name: string }, detail: string, settings: SchoolSettings) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Summary", 14, y);
  doc.setFontSize(10);
  const color = { red: [220, 38, 38], yellow: [234, 179, 8], green: [22, 163, 74] }[performanceColor(avg, settings)];
  doc.setTextColor(color[0], color[1], color[2]);
  doc.text(`Average Score: ${avg.toFixed(1)}%  (Grade ${grade.grade} - ${grade.name})`, 14, y + 6);
  doc.text(detail, 14, y + 12);
  doc.setTextColor(30, 30, 30);
}

function drawCommentAndSignatures(doc: jsPDF, finalY: number, comment: string | undefined, classTeacher: User | undefined, settings: SchoolSettings) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Class Teacher's Comment (Behaviour & Attitude):", 14, finalY + 22);
  doc.setFont("helvetica", "normal");
  const commentText = comment?.trim() || "No comment provided.";
  const commentY = finalY + 25;
  const boxH = Math.max(18, 10 + Math.ceil(commentText.length / 95) * 5);
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  doc.rect(14, commentY, pageWidth - 28, boxH);
  doc.text(commentText, 17, commentY + 5, { maxWidth: pageWidth - 34 });

  const sigY = commentY + boxH + 12;
  doc.setDrawColor(100);
  doc.setLineWidth(0.3);
  doc.line(14, sigY, 80, sigY);
  doc.setFontSize(9);
  if (classTeacher?.signature) {
    try {
      doc.addImage(classTeacher.signature, "PNG", 20, sigY - 16, 55, 18);
    } catch {}
  }
  doc.text("Class Teacher Signature", 14, sigY + 4);
  doc.text(classTeacher?.fullName || "Class Teacher", 14, sigY + 9);
  doc.text("Date: _______________", 14, sigY + 14);

  doc.line(110, sigY, pageWidth - 14, sigY);
  if (settings.headteacherSignature) {
    try {
      doc.addImage(settings.headteacherSignature, "PNG", 120, sigY - 18, 50, 20);
    } catch {}
  }
  doc.text("Headteacher Signature", 110, sigY + 4);
  doc.text(settings.headteacherName, 110, sigY + 9);
  doc.text("Date: _______________", 110, sigY + 14);

  if (settings.stampEnabled) drawStamp(doc, settings, sigY);
  doc.setLineWidth(0.2);
  doc.setTextColor(30, 30, 30);
}

// Customizable official desk stamp (head-editable shape/size/colour/date/position).
function drawStamp(doc: jsPDF, settings: SchoolSettings, sigY: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const stampR = settings.stampSize ?? 18;
  const stampX = pageWidth - (settings.stampXOffset ?? 38);
  const stampY = sigY + (settings.stampYOffset ?? 2);
  const hex = (settings.stampColor || "#B41414").replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const gc = parseInt(hex.substring(2, 4), 16);
  const bc = parseInt(hex.substring(4, 6), 16);

  doc.setDrawColor(r, gc, bc);
  doc.setTextColor(r, gc, bc);
  doc.setLineWidth(1.2);

  const shape = settings.stampShape || "round";
  if (shape === "round") {
    doc.circle(stampX, stampY, stampR, "S");
    doc.setLineWidth(0.4);
    doc.circle(stampX, stampY, Math.max(3, stampR - 3), "S");
  } else if (shape === "square") {
    doc.rect(stampX - stampR, stampY - stampR, stampR * 2, stampR * 2, "S");
    doc.setLineWidth(0.4);
    doc.rect(stampX - (stampR - 3), stampY - (stampR - 3), (stampR - 3) * 2, (stampR - 3) * 2, "S");
  } else if (shape === "hexagon") {
    const hexagon = (size: number) => {
      const pts: number[][] = [];
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i - Math.PI / 2;
        pts.push([stampX + size * Math.cos(ang), stampY + size * Math.sin(ang)]);
      }
      doc.lines(pts.map((p, i) => i === 0 ? [0, 0] : [p[0] - pts[0][0], p[1] - pts[0][1]]), pts[0][0], pts[0][1], [1, 1], "S");
    };
    hexagon(stampR);
    doc.setLineWidth(0.4);
    hexagon(Math.max(3, stampR - 3));
  }

  const centerSize = Math.min(14, stampR * 0.7);
  const monogram = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(Math.max(6, Math.min(10, stampR * 0.5)));
    doc.text("YSS", stampX, stampY + 1, { align: "center" });
  };
  if (settings.schoolLogo) {
    try {
      doc.addImage(settings.schoolLogo, "PNG", stampX - centerSize / 2, stampY - centerSize / 2, centerSize, centerSize);
    } catch {
      monogram();
    }
  } else {
    monogram();
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(Math.max(4.5, Math.min(7, stampR * 0.33)));
  doc.text(settings.stampText || "YENGWE SECONDARY SCHOOL", stampX, stampY - stampR + 5, { align: "center" });
  doc.setFontSize(Math.max(4, Math.min(6, stampR * 0.3)));
  doc.text("OFFICIAL STAMP", stampX, stampY + stampR - 3, { align: "center" });
  if (settings.stampShowDate && settings.stampDate) {
    doc.setFontSize(Math.max(4, Math.min(5.5, stampR * 0.27)));
    doc.text(settings.stampDate, stampX, stampY - stampR + 9, { align: "center" });
  }
}

/** Footer, download log, and save. */
function finish(doc: jsPDF, settings: SchoolSettings, pupil: User, downloadedBy: User, resultId: string, what: string, filename: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Downloaded by: ${downloadedBy.fullName} (${downloadedBy.role.toUpperCase()})`, 14, pageHeight - 8);
  doc.text(`Downloaded on: ${new Date().toLocaleString()}`, pageWidth - 14, pageHeight - 8, { align: "right" });
  doc.text(`© Yengwe Secondary School • ${settings.systemDomain || "smart yengwe.sch"}`, pageWidth / 2, pageHeight - 8, { align: "center" });

  const db = getDb();
  db.downloadLogs.unshift({
    id: `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    resultId,
    pupilName: pupil.fullName,
    downloadedBy: downloadedBy.id,
    downloadedByName: downloadedBy.fullName,
    downloadedAt: new Date().toISOString(),
    role: downloadedBy.role,
  });
  saveDb(db);
  logActivity(downloadedBy.id, downloadedBy.fullName, downloadedBy.role as Role, `Downloaded results for ${pupil.fullName}`, what);
  doc.save(filename);
}
