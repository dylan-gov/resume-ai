export function RawJsonView({ data }: { data: unknown }) {
  return (
    <details className="mx-auto w-full max-w-[720px] rounded-lg border border-border">
      <summary className="cursor-pointer px-4 py-2 text-sm font-medium select-none">
        Raw JSON (debug)
      </summary>
      <pre className="overflow-x-auto border-t border-border bg-muted/50 p-4 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
