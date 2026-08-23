import { describe, expect, it } from "vitest";
import type { ResumeDoc } from "@/lib/schema/resume";
import { normalizeDoc } from "./sections";
import { resolveClarifications } from "./clarifications";

const DOC: ResumeDoc = normalizeDoc({
  workExperience: [
    { id: "job-1", company: "Fenwick Data Co.", role: "Backend Engineer", startDate: "Jun 2019" },
    { id: "job-2", company: "Northwind Systems", role: "Senior Engineer" },
  ],
  education: [{ id: "edu-1", institution: "University of Texas", degree: "B.S." }],
});

function resolve(text: string) {
  return resolveClarifications({ ...DOC, clarifications: [text] })[0];
}

describe("resolveClarifications", () => {
  it("points an end-date question at the entry it names", () => {
    const result = resolve("What was your end date at Fenwick Data Co.?");
    expect(result).toMatchObject({
      sectionId: "workExperience",
      entryId: "job-1",
      fieldKey: "endDate",
    });
  });

  it("distinguishes start-date from end-date questions", () => {
    expect(resolve("Which month did you start at Northwind Systems?")).toMatchObject({
      entryId: "job-2",
      fieldKey: "startDate",
    });
  });

  it("maps a graduation question onto education's end date", () => {
    expect(resolve("When did you graduate from University of Texas?")).toMatchObject({
      entryId: "edu-1",
      fieldKey: "endDate",
    });
  });

  it("resolves the entry even when no field keyword is recognized", () => {
    const result = resolve("Can you say more about Northwind Systems?");
    expect(result.entryId).toBe("job-2");
    expect(result.fieldKey).toBeUndefined();
  });

  it("leaves an unmatchable question unresolved rather than guessing", () => {
    const result = resolve("Do you have any certifications worth adding?");
    expect(result.entryId).toBeUndefined();
    expect(result.sectionId).toBeUndefined();
  });

  it("keeps the original index so the question can be dismissed", () => {
    const resolved = resolveClarifications({
      ...DOC,
      clarifications: ["unmatched one", "End date at Fenwick Data Co.?"],
    });
    expect(resolved.map((r) => r.index)).toEqual([0, 1]);
    expect(resolved[1].entryId).toBe("job-1");
  });
});
