import { existsSync } from "fs";
import { appendFile, mkdir, readFile } from "fs/promises";
import { join } from "node:path";

const LOG_DIR = "logs";
const FILE_NAME = "parent-inquiries.jsonl";
const FILE_PATH = join(LOG_DIR, FILE_NAME);

let ensured = false;

async function ensureStorage(): Promise<void> {
  if (ensured) {
    return;
  }
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }
  ensured = true;
}

export interface ParentInquiryInput {
  telegramUserId: number;
  parentName: string;
  contact?: string | null;
  childName: string;
  childAgeOrGrade?: string | null;
  programPreference?: string | null;
  notes?: string | null;
}

export interface ParentInquiry extends ParentInquiryInput {
  id: string;
  createdAt: string;
}

export async function saveParentInquiry(input: ParentInquiryInput): Promise<ParentInquiry> {
  await ensureStorage();
  const entry: ParentInquiry = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  await appendFile(FILE_PATH, `${JSON.stringify(entry)}\n`, "utf-8");
  return entry;
}

export async function getRecentParentInquiries(limit = 10): Promise<ParentInquiry[]> {
  try {
    await ensureStorage();
    const raw = await readFile(FILE_PATH, "utf-8");
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const parsed = lines
      .map((line) => {
        try {
          return JSON.parse(line) as ParentInquiry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is ParentInquiry => entry !== null);
    return parsed.slice(-limit).reverse();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}


