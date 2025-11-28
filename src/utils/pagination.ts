import type { Conversation } from '@grammyjs/conversations';
import { InlineKeyboard } from 'grammy';
import type { BaseContext, MyContext } from '../types.js';
import { t } from './i18n.js';

export interface PaginationOptions<T> {
	items: T[];
	renderItem: (item: T, index: number) => string;
	header?: string;
	selectable?: boolean;
	getItemId?: (item: T, index: number) => string;
	lang?: string;
	initialPageSize?: number;
	minPageSize?: number;
	maxPageSize?: number;
}

export interface PaginationResult<T> {
	selectedItem: T | null;
	cancelled: boolean;
}

const DEFAULT_PAGE_SIZE = 10;
const MIN_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 50;
const PAGE_SIZE_STEP = 5;

/**
 * Generic pagination helper for displaying lists with navigation
 * Returns the selected item (if selectable) or null
 */
export async function paginate<T>(
	conversation: Conversation<BaseContext, MyContext>,
	ctx: MyContext,
	options: PaginationOptions<T>
): Promise<PaginationResult<T>> {
	const {
		items,
		renderItem,
		header = '',
		selectable = false,
		getItemId = (item, index) => `item_${index}`,
		lang = ctx.session?.language || 'en',
		initialPageSize = DEFAULT_PAGE_SIZE,
		minPageSize = MIN_PAGE_SIZE,
		maxPageSize = MAX_PAGE_SIZE,
	} = options;

	if (items.length === 0) {
		await ctx.reply(t('no_results', lang));
		return { selectedItem: null, cancelled: true };
	}

	let currentPage = 0;
	let pageSize = Math.max(minPageSize, Math.min(maxPageSize, initialPageSize));
	let messageId: number | undefined;
	let chatId: number | undefined;

	const totalPages = Math.ceil(items.length / pageSize);

	const buildMessage = (): string => {
		const start = currentPage * pageSize;
		const end = Math.min(start + pageSize, items.length);
		const pageItems = items.slice(start, end);

		let message = '';
		if (header) {
			message += `${header}\n\n`;
		}

		pageItems.forEach((item, idx) => {
			const globalIndex = start + idx;
			message += `${renderItem(item, globalIndex)}\n`;
		});

		message += `\n${t('page_info', lang).replace('{current}', String(currentPage + 1)).replace('{total}', String(totalPages))}`;

		return message;
	};

	const buildKeyboard = (): InlineKeyboard => {
		const keyboard = new InlineKeyboard();

		// Add item selection buttons if selectable
		if (selectable) {
			const start = currentPage * pageSize;
			const end = Math.min(start + pageSize, items.length);
			const pageItems = items.slice(start, end);

			pageItems.forEach((item, idx) => {
				const globalIndex = start + idx;
				const itemId = getItemId(item, globalIndex);
				const label = renderItem(item, globalIndex);
				// Truncate label if too long (Telegram button limit)
				const buttonLabel = label.length > 50 ? label.substring(0, 47) + '...' : label;
				keyboard.text(buttonLabel, `select_${itemId}`).row();
			});
		}

		// Navigation buttons row
		const navRow: Array<{ text: string; callback_data: string }> = [];

		// Previous page button
		if (currentPage > 0) {
			navRow.push({ text: '<', callback_data: 'page_prev' });
		}

		// Next page button
		if (currentPage < totalPages - 1) {
			navRow.push({ text: '>', callback_data: 'page_next' });
		}

		// Decrease page size button
		if (pageSize > minPageSize) {
			navRow.push({ text: '^', callback_data: 'size_dec' });
		}

		// Increase page size button
		if (pageSize < maxPageSize && pageSize < items.length) {
			navRow.push({ text: 'v', callback_data: 'size_inc' });
		}

		// Add navigation buttons in 2x2 grid
		if (navRow.length > 0) {
			if (navRow.length === 1) {
				keyboard.text(navRow[0].text, navRow[0].callback_data);
			} else if (navRow.length === 2) {
				keyboard.text(navRow[0].text, navRow[0].callback_data)
					.text(navRow[1].text, navRow[1].callback_data);
			} else if (navRow.length === 3) {
				keyboard.text(navRow[0].text, navRow[0].callback_data)
					.text(navRow[1].text, navRow[1].callback_data).row()
					.text(navRow[2].text, navRow[2].callback_data);
			} else {
				// 4 buttons: 2x2 grid
				keyboard.text(navRow[0].text, navRow[0].callback_data)
					.text(navRow[1].text, navRow[1].callback_data).row()
					.text(navRow[2].text, navRow[2].callback_data)
					.text(navRow[3].text, navRow[3].callback_data);
			}
		}

		// Cancel button
		keyboard.row().text(t('cancel', lang), 'cancel');

		return keyboard;
	};

	// Send initial message
	const initialMessage = await ctx.reply(buildMessage(), {
		parse_mode: 'Markdown',
		reply_markup: buildKeyboard(),
	});
	messageId = initialMessage.message_id;
	chatId = initialMessage.chat.id;

	// Create itemId to item mapping for efficient lookup
	const itemIdMap = new Map<string, T>();
	items.forEach((item, idx) => {
		const itemId = getItemId(item, idx);
		itemIdMap.set(itemId, item);
	});

	// Handle pagination loop
	while (true) {
		const btnCtx = await conversation.wait();
		const data = btnCtx.callbackQuery?.data;

		if (!data) {
			if (btnCtx.callbackQuery) {
				await btnCtx.answerCallbackQuery();
			}
			continue;
		}

		await btnCtx.answerCallbackQuery();

		// Handle selection
		if (data.startsWith('select_')) {
			const itemId = data.replace('select_', '');
			const selectedItem = itemIdMap.get(itemId);
			if (selectedItem !== undefined) {
				// Delete the pagination message
				if (messageId && chatId) {
					try {
						await ctx.api.deleteMessage(chatId, messageId);
					} catch (err) {
						// Ignore deletion errors
					}
				}
				return { selectedItem, cancelled: false };
			}
		}

		// Handle cancel
		if (data === 'cancel') {
			if (messageId && chatId) {
				try {
					await ctx.api.deleteMessage(chatId, messageId);
				} catch (err) {
					// Ignore deletion errors
				}
			}
			return { selectedItem: null, cancelled: true };
		}

		// Handle page navigation
		if (data === 'page_prev') {
			if (currentPage > 0) {
				currentPage--;
			}
		} else if (data === 'page_next') {
			if (currentPage < totalPages - 1) {
				currentPage++;
			}
		} else if (data === 'size_dec') {
			const newPageSize = Math.max(minPageSize, pageSize - PAGE_SIZE_STEP);
			if (newPageSize !== pageSize) {
				pageSize = newPageSize;
				const newTotalPages = Math.ceil(items.length / pageSize);
				// Adjust current page if it's out of bounds
				if (currentPage >= newTotalPages) {
					currentPage = Math.max(0, newTotalPages - 1);
				}
			}
		} else if (data === 'size_inc') {
			const newPageSize = Math.min(maxPageSize, Math.min(pageSize + PAGE_SIZE_STEP, items.length));
			if (newPageSize !== pageSize) {
				pageSize = newPageSize;
				const newTotalPages = Math.ceil(items.length / pageSize);
				// Adjust current page if it's out of bounds
				if (currentPage >= newTotalPages) {
					currentPage = Math.max(0, newTotalPages - 1);
				}
			}
		}

		// Update message
		if (messageId && chatId) {
			try {
				await ctx.api.editMessageText(chatId, messageId, buildMessage(), {
					parse_mode: 'Markdown',
					reply_markup: buildKeyboard(),
				});
			} catch (err) {
				// If edit fails, send new message
				const newMessage = await ctx.reply(buildMessage(), {
					parse_mode: 'Markdown',
					reply_markup: buildKeyboard(),
				});
				messageId = newMessage.message_id;
				chatId = newMessage.chat.id;
			}
		}
	}
}

