"use client";

import Link from "next/link";
import { LessonDiagrams } from "@/components/LessonDiagrams";
import type { Lesson } from "@/lib/music/lessons";

/** Body paragraphs, optional diagrams, and quick-reference table for one lesson. */
export function LessonContent({ lesson }: { lesson: Lesson }) {
  return (
    <div className="grid gap-2 text-muted leading-relaxed" data-testid={`lesson-${lesson.id}`}>
      {lesson.body.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {lesson.detailHref && (
        <p>
          <Link
            href={lesson.detailHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm inline-flex"
            data-testid={`lesson-open-${lesson.id}`}
          >
            Open full guide in a new tab
          </Link>
        </p>
      )}
      {lesson.diagrams && lesson.diagrams.length > 0 && <LessonDiagrams ids={lesson.diagrams} />}
      {lesson.quickRef && lesson.quickRef.length > 0 && (
        <table className="mt-2 w-full text-left text-sm" data-testid="lesson-quick-ref">
          <caption className="sr-only">Quick reference</caption>
          <thead>
            <tr className="text-ink">
              <th className="py-1.5 pr-3 font-semibold">Principle</th>
              <th className="py-1.5 font-semibold">Rule of thumb</th>
            </tr>
          </thead>
          <tbody>
            {lesson.quickRef.map((r) => (
              <tr key={r.principle} className="border-t border-line">
                <td className="py-1.5 pr-3 font-semibold text-ink whitespace-nowrap">{r.principle}</td>
                <td className="py-1.5">{r.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
