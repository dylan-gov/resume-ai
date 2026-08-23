import { describe, expect, it } from "vitest";
import type { ResumeDoc } from "@/lib/schema/resume";
import {
  analyzeBullet,
  analyzeResume,
  analyzeReadability,
  collectBullets,
  countSyllables,
  extractJobKeywords,
  findBuzzwords,
  findPassiveVoice,
  findWeakOpener,
  isQuantified,
  lacksActionVerb,
  matchKeywords,
} from "./index";
import type { BulletRef } from "./types";

function ref(text: string): BulletRef {
  return {
    sectionId: "workExperience",
    sectionLabel: "Experience",
    entryId: "job-1",
    entryTitle: "Engineer",
    index: 0,
    bulletsKey: "bullets",
    text,
  };
}

const kinds = (text: string) => analyzeBullet(ref(text)).map((f) => f.kind);

describe("weak openers", () => {
  it.each([
    "Responsible for the billing service",
    "Helped with migration of the monolith",
    "Worked on the ingestion pipeline daily",
    "Assisted with quarterly reporting duties",
    "Duties included managing the release train",
  ])("flags %j", (bullet) => {
    expect(findWeakOpener(bullet)).not.toBeNull();
    expect(kinds(bullet)).toContain("weak-opener");
  });

  it.each([
    "Rebuilt the billing service on Postgres",
    "Led a team of three engineers",
    "Reduced reconciliation errors by 90%",
  ])("does not flag %j", (bullet) => {
    expect(findWeakOpener(bullet)).toBeNull();
    expect(kinds(bullet)).not.toContain("weak-opener");
  });

  it("is case-insensitive", () => {
    expect(findWeakOpener("RESPONSIBLE FOR everything")).toBe("responsible for");
  });
});

describe("action verbs", () => {
  it.each(["Built the pipeline", "Led the team", "Spearheading the rollout"])(
    "accepts %j",
    (bullet) => expect(lacksActionVerb(bullet)).toBe(false)
  );

  it.each(["Various tasks around the office", "Team lead for the project"])(
    "flags %j as lacking an action verb",
    (bullet) => expect(lacksActionVerb(bullet)).toBe(true)
  );
});

describe("passive voice", () => {
  it.each([
    ["The service was rebuilt by the team", "was rebuilt"],
    ["Reports were generated automatically each week", "were generated"],
    ["Metrics are tracked in a dashboard", "are tracked"],
    ["The pipeline was quickly migrated to Go", "was quickly migrated"],
  ])("flags %j", (bullet, expected) => {
    expect(findPassiveVoice(bullet)).toBe(expected);
    expect(kinds(bullet)).toContain("passive-voice");
  });

  it.each([
    "Rebuilt the billing service on Postgres",
    "Led a team of three engineers to ship on time",
    "Designed a detailed rollout plan",
    "Built a data-based reporting tool",
  ])("does not flag active bullet %j", (bullet) => {
    expect(findPassiveVoice(bullet)).toBeNull();
  });

  it("does not treat adjectival -ed words as passive", () => {
    // "is experienced" and "is based" are exceptions, not passive verbs.
    expect(findPassiveVoice("Team is experienced in Go")).toBeNull();
    expect(findPassiveVoice("Service is based in AWS")).toBeNull();
  });
});

describe("buzzwords", () => {
  it("finds curated clichés", () => {
    expect(findBuzzwords("A results-driven team player with synergy")).toEqual(
      expect.arrayContaining(["synergy", "team player", "results-driven"])
    );
  });

  it("returns nothing for concrete language", () => {
    expect(findBuzzwords("Cut p99 latency from 800ms to 120ms")).toEqual([]);
  });

  it("matches on word boundaries only", () => {
    // "dynamic" is a buzzword; "dynamically" should not trip it.
    expect(findBuzzwords("Allocated buffers dynamically")).toEqual([]);
  });
});

describe("quantification", () => {
  it.each([
    "Cut costs by $2M annually",
    "Reduced errors by 90%",
    "Led a team of 3 engineers",
    "Doubled throughput across the fleet",
    "Processed millions of events per day",
  ])("counts %j as quantified", (bullet) => expect(isQuantified(bullet)).toBe(true));

  it.each([
    "Improved the billing service reliability",
    "Led the migration to microservices",
  ])("counts %j as not quantified", (bullet) => {
    expect(isQuantified(bullet)).toBe(false);
    expect(kinds(bullet)).toContain("not-quantified");
  });

  it("never offers to rewrite a quantification gap", () => {
    // Inventing a metric would be fabrication, so this is surfaced only.
    const finding = analyzeBullet(ref("Improved the billing service reliability")).find(
      (f) => f.kind === "not-quantified"
    )!;
    expect(finding.rewritable).toBe(false);
  });
});

describe("bullet length", () => {
  it("flags a paragraph-length bullet", () => {
    const long = `Rebuilt ${"the billing service and ".repeat(12)}successfully`;
    expect(kinds(long)).toContain("too-long");
  });

  it("flags a stub", () => {
    expect(kinds("Fixed bugs")).toContain("too-short");
  });

  it("accepts a normal bullet", () => {
    const normal = "Rebuilt the billing service, cutting reconciliation errors by 90%";
    expect(kinds(normal)).not.toContain("too-long");
    expect(kinds(normal)).not.toContain("too-short");
  });
});

describe("readability", () => {
  it("counts syllables exactly on unambiguous words", () => {
    expect(countSyllables("cat")).toBe(1);
    expect(countSyllables("make")).toBe(1);
    expect(countSyllables("engineer")).toBe(3);
    expect(countSyllables("data")).toBe(2);
    expect(countSyllables("")).toBe(0);
  });

  it("stays within one syllable of the truth on harder words", () => {
    // Vowel-group counting is a documented approximation: adjacent vowels
    // in different syllables ("re-li-a-bil-i-ty") read as one group. That is
    // acceptable for a readability grade, so the tolerance is asserted
    // rather than pretending the heuristic is exact.
    const cases: [string, number][] = [
      ["reliability", 6],
      ["migration", 3],
      ["infrastructure", 4],
      ["automated", 4],
    ];
    for (const [word, truth] of cases) {
      expect(Math.abs(countSyllables(word) - truth), `${word}`).toBeLessThanOrEqual(1);
    }
  });

  it("scores simple prose lower than dense prose", () => {
    const simple = analyzeReadability(["We built a tool. It saves time."]);
    const dense = analyzeReadability([
      "Orchestrated multifaceted infrastructure modernization initiatives leveraging heterogeneous containerization methodologies.",
    ]);
    expect(simple.gradeLevel).toBeLessThan(dense.gradeLevel);
  });

  it("is deterministic", () => {
    const input = ["Rebuilt the billing service", "Led a team of three engineers"];
    expect(analyzeReadability(input)).toEqual(analyzeReadability(input));
  });

  it("handles an empty resume without dividing by zero", () => {
    const result = analyzeReadability([]);
    expect(result.gradeLevel).toBe(0);
    expect(result.interpretation).toMatch(/no readable prose/i);
  });
});

/* --------------------------- document-level ---------------------------- */

const WEAK_DOC: ResumeDoc = {
  header: { name: "Sam Weak" },
  workExperience: [
    {
      id: "job-1",
      company: "Acme",
      role: "Engineer",
      bullets: [
        "Responsible for the billing system",
        "Reports were generated by the team",
        "A results-driven team player",
      ],
    },
  ],
  education: [{ id: "edu-1", institution: "State University", details: ["Studied things"] }],
  sections: [
    { id: "workExperience", kind: "workExperience", label: "Experience" },
    { id: "education", kind: "education", label: "Education" },
  ],
};

const STRONG_DOC: ResumeDoc = {
  header: {
    name: "Alex Strong",
    email: "alex@example.com",
    phone: "555-0100",
    location: "Austin, TX",
  },
  summary: "Backend engineer focused on payments infrastructure.",
  workExperience: [
    {
      id: "job-1",
      company: "Northwind",
      role: "Senior Engineer",
      startDate: "2022",
      endDate: "Present",
      bullets: [
        "Rebuilt the billing service on Postgres, cutting reconciliation errors by 90%",
        "Led a team of 3 engineers migrating a monolith into 6 Go services",
      ],
    },
  ],
  education: [{ id: "edu-1", institution: "UT Austin", degree: "B.S.", startDate: "2015" }],
  skills: [{ id: "sk-1", category: "Languages", items: ["Go", "TypeScript"] }],
  sections: [
    { id: "summary", kind: "summary", label: "Summary" },
    { id: "workExperience", kind: "workExperience", label: "Experience" },
    { id: "education", kind: "education", label: "Education" },
    { id: "skills", kind: "skills", label: "Skills" },
  ],
};

describe("analyzeResume", () => {
  it("is deterministic — identical input yields identical output", () => {
    expect(analyzeResume(WEAK_DOC)).toEqual(analyzeResume(WEAK_DOC));
  });

  it("scores a strong resume above a weak one on every metric", () => {
    const weak = analyzeResume(WEAK_DOC);
    const strong = analyzeResume(STRONG_DOC);

    expect(strong.ats.value).toBeGreaterThan(weak.ats.value);
    expect(strong.formatting.value).toBeGreaterThanOrEqual(weak.formatting.value);
    expect(strong.findings.length).toBeLessThan(weak.findings.length);
  });

  it("locates each finding precisely enough to edit it", () => {
    const { findings } = analyzeResume(WEAK_DOC);
    const weakOpener = findings.find((f) => f.kind === "weak-opener")!;

    expect(weakOpener.ref).toMatchObject({
      sectionId: "workExperience",
      entryId: "job-1",
      index: 0,
      bulletsKey: "bullets",
    });
  });

  it("uses the education section's own list key", () => {
    // Education stores bullets under `details`; a hardcoded "bullets" key
    // would write to a field the schema strips.
    const eduBullet = collectBullets(WEAK_DOC).find((b) => b.sectionId === "education")!;
    expect(eduBullet.bulletsKey).toBe("details");
    expect(eduBullet.text).toBe("Studied things");
  });

  it("ignores blank bullets left over from editing", () => {
    const withBlank: ResumeDoc = {
      ...STRONG_DOC,
      workExperience: [
        { ...STRONG_DOC.workExperience![0], bullets: ["Built the thing that mattered", "   ", ""] },
      ],
    };
    expect(collectBullets(withBlank)).toHaveLength(1);
  });

  it("explains every score with checks", () => {
    const { ats, formatting } = analyzeResume(STRONG_DOC);
    expect(ats.checks.length).toBeGreaterThan(5);
    expect(formatting.checks.length).toBeGreaterThan(3);
    for (const check of [...ats.checks, ...formatting.checks]) {
      expect(check.detail).toBeTruthy();
      if (!check.passed) expect(check.howToImprove).toBeTruthy();
    }
  });

  it("survives an empty document", () => {
    const analysis = analyzeResume({ sections: [] });
    expect(analysis.findings).toEqual([]);
    expect(analysis.ats.value).toBeGreaterThanOrEqual(0);
    expect(analysis.stats.bulletCount).toBe(0);
  });

  it("counts quantified bullets in stats", () => {
    expect(analyzeResume(STRONG_DOC).stats.quantifiedBulletCount).toBe(2);
    expect(analyzeResume(WEAK_DOC).stats.quantifiedBulletCount).toBe(0);
  });
});

/* ----------------------------- JD matching ----------------------------- */

const JOB_DESCRIPTION = `
Senior Backend Engineer

Requirements:
- 5+ years of experience with Python and Go
- Strong experience with Kubernetes and Docker
- Must have experience building REST APIs
- Familiarity with PostgreSQL
- Experience with machine learning is a plus

Responsibilities:
- Build and maintain REST APIs
- Deploy services to Kubernetes
- Collaborate with the data team on machine learning pipelines
`;

describe("job keyword extraction", () => {
  it("pulls real skills out of a job description", () => {
    const terms = extractJobKeywords(JOB_DESCRIPTION).map((k) => k.term);
    for (const expected of ["python", "kubernetes", "docker", "postgresql"]) {
      expect(terms, `expected to extract ${expected}`).toContain(expected);
    }
  });

  it("keeps multi-word skills together", () => {
    const terms = extractJobKeywords(JOB_DESCRIPTION).map((k) => k.term);
    expect(terms).toContain("machine learning");
  });

  it("does not fuse two skills joined by a conjunction into one phrase", () => {
    // "Kubernetes and Docker" is two skills. Extracting it as one phrase
    // creates a keyword that can never match, permanently polluting the
    // missing list and dragging the coverage denominator down.
    const terms = extractJobKeywords(JOB_DESCRIPTION).map((k) => k.term);
    expect(terms).not.toContain("kubernetes and docker");
    expect(terms).not.toContain("python and go");
    expect(terms).toContain("kubernetes");
    expect(terms).toContain("docker");
  });

  it("keeps genuine phrases that contain a preposition", () => {
    const terms = extractJobKeywords("Requirements:\n- infrastructure as code experience").map(
      (k) => k.term
    );
    expect(terms).toContain("infrastructure as code");
  });

  it("drops boilerplate stopwords", () => {
    const terms = extractJobKeywords(JOB_DESCRIPTION).map((k) => k.term);
    for (const noise of ["experience", "requirements", "responsibilities", "years"]) {
      expect(terms, `${noise} should be filtered`).not.toContain(noise);
    }
  });

  it("treats a Requirements: heading as covering the lines beneath it", () => {
    const keywords = extractJobKeywords(JOB_DESCRIPTION);
    // "Kubernetes" appears under "Requirements:", not on a line that itself
    // contains a marker word.
    expect(keywords.find((k) => k.term === "kubernetes")!.required).toBe(true);
    expect(keywords.find((k) => k.term === "python")!.required).toBe(true);
  });

  it("stops treating lines as required at the next heading", () => {
    const keywords = extractJobKeywords(`
Requirements:
- Kubernetes

Responsibilities:
- Mentoring junior engineers
`);
    expect(keywords.find((k) => k.term === "kubernetes")!.required).toBe(true);
    expect(keywords.find((k) => k.term === "mentoring")!.required).toBe(false);
  });

  it("ranks required terms above optional ones of equal frequency", () => {
    const keywords = extractJobKeywords(`
Requirements:
- Kubernetes

Nice to have:
- Terraform
`);
    const kubernetes = keywords.find((k) => k.term === "kubernetes")!;
    const terraform = keywords.find((k) => k.term === "terraform")!;
    expect(kubernetes.weight).toBeGreaterThan(terraform.weight);
  });

  it("is deterministic", () => {
    expect(extractJobKeywords(JOB_DESCRIPTION)).toEqual(extractJobKeywords(JOB_DESCRIPTION));
  });
});

describe("keyword matching", () => {
  const keywords = extractJobKeywords(JOB_DESCRIPTION);

  it("computes coverage with visible math", () => {
    const resume = "Built REST APIs in Python and Go. Deployed to Kubernetes with Docker.";
    const match = matchKeywords(resume, keywords);

    expect(match.score).toBeGreaterThan(0);
    expect(match.score).toBeLessThanOrEqual(100);
    // The score is exactly the weighted ratio, not a fudge factor.
    expect(match.score).toBe(Math.round((match.matchedWeight / match.totalWeight) * 100));
  });

  it("recognizes a skill written under a synonym instead of calling it missing", () => {
    // The JD says "PostgreSQL"; the resume says "Postgres".
    const match = matchKeywords("Managed Postgres databases at scale", keywords);
    const postgres = [...match.matches, ...match.synonyms].find(
      (m) => m.keyword.term === "postgresql"
    );

    expect(postgres, "postgres should not be reported missing").toBeDefined();
    expect(match.missing.map((m) => m.keyword.term)).not.toContain("postgresql");
  });

  it("resolves abbreviation synonyms in both directions", () => {
    const mlKeywords = extractJobKeywords("Requirements:\n- machine learning experience");
    const match = matchKeywords("Applied ML to ranking problems", mlKeywords);
    expect(match.missing.map((m) => m.keyword.term)).not.toContain("machine learning");
  });

  it("does not tell a React.js user to add React", () => {
    const reactJd = extractJobKeywords("Requirements:\n- Strong React skills required");
    const match = matchKeywords("Built dashboards in React.js", reactJd);
    expect(match.missing.map((m) => m.keyword.term)).not.toContain("react");
  });

  it("reports genuinely absent skills as missing, ranked by weight", () => {
    const match = matchKeywords("Wrote Python scripts for data cleaning", keywords);
    const missing = match.missing.map((m) => m.keyword.term);

    expect(missing).toContain("kubernetes");
    expect(missing).toContain("docker");
    // Ranked most important first.
    const weights = match.missing.map((m) => m.keyword.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });

  it("scores an empty resume at zero and a covering resume higher", () => {
    expect(matchKeywords("", keywords).score).toBe(0);

    const partial = matchKeywords("Python and Go", keywords).score;
    const fuller = matchKeywords(
      "Python, Go, Kubernetes, Docker, REST APIs, PostgreSQL, machine learning",
      keywords
    ).score;
    expect(fuller).toBeGreaterThan(partial);
  });

  it("does not treat a tool as equivalent to the practice it implements", () => {
    // Claiming coverage here would be dishonest: knowing "infrastructure as
    // code" as a concept is not the same as having used Terraform.
    const jd = extractJobKeywords("Requirements:\n- Terraform required");
    const match = matchKeywords("Practiced infrastructure as code", jd);
    expect(match.missing.map((m) => m.keyword.term)).toContain("terraform");
  });

  it("does not treat distinct methodologies as interchangeable", () => {
    const jd = extractJobKeywords("Requirements:\n- Kanban required");
    const match = matchKeywords("Ran the team on Scrum", jd);
    expect(match.missing.map((m) => m.keyword.term)).toContain("kanban");
  });

  it("accepts AI-supplied synonyms additively without changing deterministic matches", () => {
    const jd = extractJobKeywords("Requirements:\n- Experience with observability tooling");
    const resume = "Instrumented services with Prometheus and Grafana";

    const before = matchKeywords(resume, jd);
    const after = matchKeywords(resume, jd, {
      extraSynonyms: [["observability", "Prometheus"]],
    });

    expect(after.score).toBeGreaterThanOrEqual(before.score);
  });

  it("is deterministic", () => {
    const resume = "Built REST APIs in Python and Go.";
    expect(matchKeywords(resume, keywords)).toEqual(matchKeywords(resume, keywords));
  });
});
