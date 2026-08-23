import { HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ClarificationsPanel({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;

  return (
    <Card className="mx-auto w-full max-w-[720px] border-amber-500/30 bg-amber-500/5 ring-amber-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <HelpCircle className="size-4" />
          Questions to improve your resume
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {questions.map((question, i) => (
            <li key={i}>{question}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
