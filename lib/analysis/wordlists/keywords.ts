/**
 * WORD LIST — keyword extraction and normalization inputs.
 *
 * Edit these lists to tune job-description matching; the logic lives in
 * lib/analysis/keywords.ts.
 */

/** Words too common to be meaningful keywords in a job description. */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "about", "above", "across", "after", "against", "all", "also", "an",
  "and", "any", "are", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "can", "could", "did", "do", "does",
  "doing", "down", "during", "each", "etc", "few", "for", "from", "further",
  "had", "has", "have", "having", "he", "her", "here", "hers", "him", "his",
  "how", "i", "if", "in", "into", "is", "it", "its", "just", "me", "more",
  "most", "must", "my", "no", "nor", "not", "of", "off", "on", "once", "only",
  "or", "other", "our", "ours", "out", "over", "own", "per", "same", "she",
  "should", "so", "some", "such", "than", "that", "the", "their", "theirs",
  "them", "then", "there", "these", "they", "this", "those", "through", "to",
  "too", "under", "until", "up", "very", "was", "we", "were", "what", "when",
  "where", "which", "while", "who", "whom", "why", "will", "with", "would",
  "you", "your", "yours",
  // Job-posting boilerplate that is never a real requirement.
  "ability", "able", "candidate", "candidates", "company", "experience",
  "excellent", "including", "job", "join", "looking", "opportunity", "plus",
  "position", "preferred", "required", "requirements", "responsibilities",
  "role", "skills", "strong", "team", "teams", "us", "work", "working",
  "years", "year", "new", "well", "help", "great", "good", "may", "make",
  "using", "use", "like", "want", "need", "needs", "day", "time", "part",
  "full", "please", "apply", "benefits", "salary", "equal", "employer",
]);

/**
 * Canonical forms for terms that mean the same thing but share no token.
 *
 * This is the deterministic half of semantic matching — it is what stops
 * the app telling someone to "add React" when they wrote "React.js". The AI
 * layer handles pairs beyond this list; keeping the common cases here means
 * most matching needs no model call at all.
 *
 * Keys and values are compared lowercased.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["react", "react.js", "reactjs"],
  ["node", "node.js", "nodejs"],
  ["vue", "vue.js", "vuejs"],
  ["angular", "angular.js", "angularjs"],
  ["next", "next.js", "nextjs"],
  ["express", "express.js", "expressjs"],
  ["javascript", "js", "ecmascript"],
  ["typescript", "ts"],
  ["python", "py"],
  ["postgresql", "postgres", "psql"],
  ["mongodb", "mongo"],
  ["kubernetes", "k8s"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["natural language processing", "nlp"],
  ["continuous integration", "ci", "ci/cd", "cicd"],
  ["continuous deployment", "cd"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp", "google cloud"],
  ["microsoft azure", "azure"],
  ["infrastructure as code", "iac"],
  ["representational state transfer", "rest", "restful", "rest api"],
  ["graphql", "graph ql"],
  ["user interface", "ui"],
  ["user experience", "ux"],
  ["quality assurance", "qa"],
  ["test driven development", "tdd"],
  ["object oriented programming", "oop"],
  ["structured query language", "sql"],
  ["version control", "git", "source control"],
  ["software as a service", "saas"],
  ["application programming interface", "api", "apis"],
  ["c sharp", "c#", "csharp"],
  ["dotnet", ".net"],
  ["golang", "go"],
];

/**
 * Deliberately NOT grouped, because they are related but not equivalent —
 * treating them as synonyms would tell a user they are covered when they
 * are not, which is the one thing matching must never do:
 *
 *   terraform ≠ infrastructure as code   (a tool vs the practice)
 *   docker ≠ containerization            (a tool vs the practice)
 *   scrum ≠ kanban ≠ agile               (distinct methodologies)
 *   c# ≠ .net                            (a language vs the platform)
 */

/**
 * Words that cannot appear *inside* a multi-word keyword.
 *
 * Without this, "Kubernetes and Docker" is extracted as the phrase
 * "kubernetes and docker", which can never match anything and permanently
 * pollutes the missing-keywords list. Prepositions are deliberately absent
 * so genuine phrases like "infrastructure as code" survive.
 */
export const PHRASE_BREAKERS: ReadonlySet<string> = new Set([
  "and", "or", "nor", "but", "plus", "also", "etc",
]);

/** Terms that signal a JD line is stating a hard requirement. */
export const REQUIREMENT_MARKERS: readonly string[] = [
  "required", "must have", "must-have", "minimum", "at least", "essential",
  "you have", "you'll need", "qualifications", "requirements",
];
