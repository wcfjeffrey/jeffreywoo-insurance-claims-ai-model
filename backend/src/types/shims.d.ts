declare module "mammoth" {
  export function extractRawText(input: {
    buffer: Buffer;
  }): Promise<{ value: string; messages: unknown[] }>;
}

declare module "word-extractor" {
  export default class WordExtractor {
    extract(path: string): Promise<{ getBody(): string }>;
  }
}
