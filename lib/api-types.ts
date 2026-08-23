import type { ResumeDoc } from "@/lib/schema/resume";

export interface GenerateSuccessResponse {
  resume: ResumeDoc;
  warnings: string[];
}

export interface GenerateErrorResponse {
  error: { type: string; message: string };
}

export type GenerateResponse = GenerateSuccessResponse | GenerateErrorResponse;

export function isGenerateError(
  response: GenerateResponse
): response is GenerateErrorResponse {
  return "error" in response;
}
