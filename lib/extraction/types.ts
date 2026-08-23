export interface SourceFile {
  buffer: Buffer;
  mimeType: string;
  name: string;
}

export interface ExtractedDoc {
  text: string;
  /** Non-fatal issues surfaced to the user, e.g. "page 3 appears to be an image". */
  warnings: string[];
}

export type ExtractionErrorType =
  | "unsupported-type"
  | "too-large"
  | "corrupt"
  | "empty"
  | "unknown";

export class ExtractionError extends Error {
  readonly type: ExtractionErrorType;
  readonly fileName: string;

  constructor(type: ExtractionErrorType, fileName: string, message: string) {
    super(message);
    this.name = "ExtractionError";
    this.type = type;
    this.fileName = fileName;
  }
}

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
] as const;
