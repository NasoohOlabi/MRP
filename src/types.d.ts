import type { ConversationFlavor } from "@grammyjs/conversations";
import type { SessionFlavor, Context } from "grammy";

import type { ChatMessage } from './app/telegram/utils/lmStudio.js';

/* ---------- base context ---------- */
export type MySession = { 
	state?: string; 
	language?: 'en' | 'ar';
	lmStudioHistory?: ChatMessage[];
	pendingConversation?: string;
};
export type BaseContext = Context & SessionFlavor<MySession>;
export type MyContext = BaseContext & ConversationFlavor<BaseContext>;

/* ---------- brand for answer keys ---------- */
declare const answerKeyBrand: unique symbol;
export type AnswerKey<Name extends string = string> = Name & {
  [answerKeyBrand]: never;
};

/* ---------- utils ---------- */
type Promisify<T> = T | Promise<T>;

/* ---------- text step ---------- */
export interface TextStep<K extends AnswerKey = AnswerKey> {
  type: "text";
  key: K; // stable identifier
  prompt: string;
  promptParams?: Record<string, string>;
  validate?: (text: string) => Promisify<boolean>;
  error?: string;
  next: (value: string) => Promisify<Step | null>;
}

/* ---------- button step ---------- */
export interface ButtonOption<K extends AnswerKey = AnswerKey> {
  text: string;
  data: string;
  url?: string;
  // Allow lazy evaluation to avoid eager building of complex next steps
  next: Promisify<Step | null> | (() => Promisify<Step | null>);
}

export interface ButtonStep<K extends AnswerKey = AnswerKey> {
  type: "button";
  key: K;
  prompt: string;
  promptParams?: Record<string, string>;
  options: ButtonOption<K>[];
  onSelect?: (
    data: string,
    ctx: MyContext,
    btnCtx: MyContext,
  ) => Promisify<void>;
  inPlace?: boolean; // NEW: enable edit-in-place
}

/* ---------- discriminated union ---------- */
export type Step = TextStep | ButtonStep;

/* ---------- answer shape inference ---------- */
type StepAnswers<S> =
  S extends TextStep<infer K>
  ? Record<K, string>
  : S extends ButtonStep<infer K>
  ? Record<K, string>
  : never;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export type InferAnswers<S extends Step> = UnionToIntersection<StepAnswers<S>>;

/* ---------- public options ---------- */
export interface TreeConversationOptions<Shape = Record<string, string>> {
  entry: Step;
  onSuccess: (answers: Shape) => Promisify<any>;
  successMessage: string;
  failureMessage: string;
}
