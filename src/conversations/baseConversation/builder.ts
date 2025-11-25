import type { AnswerKey, ButtonOption, ButtonStep, Step, TextStep } from "../../types.js";
/**
 * A builder for linear or branching conversations.
 * The generated structure is later executed by {@link createTreeConversation}.
 */
export class ConversationBuilder<Shape extends Record<string, any> = Record<string, any>> {
	private steps: ((next: Step | null) => Step)[] = [];

	text<K extends keyof Shape & string>(
		key: K,
		prompt: string,
		options: {
			promptParams?: Record<string, string>;
			validate?: (text: string) => boolean | Promise<boolean>;
			error?: string;
			action?: (value: string) => Promise<void> | void;
			next?: Step | ((val: string) => Promise<Step | null> | Step | null);
		} = {}
	): this {
		this.steps.push((nextChain) => {
			const step: TextStep = {
				type: "text",
				key: key as unknown as AnswerKey,
				prompt,
				next: async (val) => {
					if (options.action) await options.action(val);

					if (options.next) {
						if (typeof options.next === "function") {
							return options.next(val);
						}
						return options.next;
					}

					return nextChain;
				},
			};

			if (options.promptParams !== undefined) step.promptParams = options.promptParams;
			if (options.validate !== undefined) step.validate = options.validate;
			if (options.error !== undefined) step.error = options.error;

			return step;
		});
		return this;
	}

	menu<K extends keyof Shape & string>(
		key: K,
		prompt: string,
		buttons: (
			| {
				text: string;
				data: string;
				url?: string;
				next?: ConversationBuilder<any> | Step | null;
			}
			| "__row__"
		)[],
		options: {
			promptParams?: Record<string, string>;
			inPlace?: boolean;
			onSelect?: (data: string, ctx: any, btnCtx: any) => Promise<void>;
		} = {}
	): this {
		this.steps.push((nextChain) => {
			const builtOptions = buttons.map((b) => {
				if (b === "__row__") return { text: "", data: "__row__", next: null };

				let nextStep: Step | null | (() => Promise<Step | null>);

				if (b.next instanceof ConversationBuilder) {
					nextStep = b.next.compile();
				} else if (b.next !== undefined) {
					nextStep = b.next;
				} else {
					nextStep = nextChain;
				}

				const option: ButtonOption = {
					text: b.text,
					data: b.data,
					next: nextStep,
				};

				if (b.url !== undefined) option.url = b.url;

				return option;
			});

			const step: ButtonStep = {
				type: "button",
				key: key as unknown as AnswerKey,
				prompt,
				options: builtOptions,
			};

			if (options.promptParams !== undefined) step.promptParams = options.promptParams;
			if (options.inPlace !== undefined) step.inPlace = options.inPlace;
			if (options.onSelect !== undefined) step.onSelect = options.onSelect;

			return step;
		});
		return this;
	}

	add(stepOrFactory: Step | ((next: Step | null) => Step)): this {
		if (typeof stepOrFactory === "function") {
			this.steps.push(stepOrFactory);
		} else {
			this.steps.push(() => stepOrFactory);
		}
		return this;
	}

	compile(next: Step | null = null): Step {
		let current: Step | null = next;
		for (let i = this.steps.length - 1; i >= 0; i--) {
			const stepFn = this.steps[i];
			if (!stepFn) continue;
			current = stepFn(current);
		}
		if (!current) throw new Error("ConversationBuilder cannot be empty");
		return current;
	}

	build(
		onSuccess: (results: Shape) => Promise<any> | any,
		options: { successMessage?: string; failureMessage?: string } = {}
	) {
		const entry = this.compile();
		return createTreeConversation<Shape>({
			entry,
			onSuccess,
			successMessage: options.successMessage || "operation_completed",
			failureMessage: options.failureMessage || "operation_failed",
		});
	}
}

import { createTreeConversation } from "./runner.js";

