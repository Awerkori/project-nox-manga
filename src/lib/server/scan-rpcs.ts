// @ts-nocheck
import { db, schema, safeQuery } from '$lib/server/db';
import { eq, and, inArray } from 'drizzle-orm';

export const claimScanTask = async (dbClient: any, args: { p_task_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanTasks).set({ status: 'CLAIMED' }).where(eq(schema.scanTasks.id, args.p_task_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const releaseScanTask = async (dbClient: any, args: { p_task_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanTasks).set({ status: 'OPEN' }).where(eq(schema.scanTasks.id, args.p_task_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const completeScanStage = async (dbClient: any, args: { p_stage_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanStages).set({ status: 'COMPLETED' }).where(eq(schema.scanStages.id, args.p_stage_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const createScanInvite = async (dbClient: any, args: { p_scan_id: string, p_user_id: string, p_role: string }) => {
	try {
		const data = await dbClient.insert(schema.scanInvites).values({ scanId: args.p_scan_id, userId: args.p_user_id, role: args.p_role, status: 'PENDING' }).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const manageScanMember = async (dbClient: any, args: { p_member_id: string, p_role: string }) => {
	try {
		const data = await dbClient.update(schema.scanMembers).set({ role: args.p_role }).where(eq(schema.scanMembers.id, args.p_member_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const removeScanMemberSafe = async (dbClient: any, args: { p_member_id: string }) => {
	try {
		const data = await dbClient.delete(schema.scanMembers).where(eq(schema.scanMembers.id, args.p_member_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const requestScanOwnershipTransfer = async (dbClient: any, args: { p_scan_id: string, p_new_owner_id: string }) => {
	try {
		const data = await dbClient.insert(schema.scanTransfers).values({ scanId: args.p_scan_id, newOwnerId: args.p_new_owner_id, status: 'PENDING' }).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const respondScanOwnershipTransfer = async (dbClient: any, args: { p_transfer_id: string, p_accept: boolean }) => {
	try {
		const data = await dbClient.update(schema.scanTransfers).set({ status: args.p_accept ? 'ACCEPTED' : 'REJECTED' }).where(eq(schema.scanTransfers.id, args.p_transfer_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const cancelScanTransferRequest = async (dbClient: any, args: { p_transfer_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanTransfers).set({ status: 'CANCELLED' }).where(eq(schema.scanTransfers.id, args.p_transfer_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const cancelScanProjectRequest = async (dbClient: any, args: { p_request_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanProjectRequests).set({ status: 'CANCELLED' }).where(eq(schema.scanProjectRequests.id, args.p_request_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const cancelScanPartnerRequest = async (dbClient: any, args: { p_request_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanPartnerRequests).set({ status: 'CANCELLED' }).where(eq(schema.scanPartnerRequests.id, args.p_request_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const updateWorkScanStatus = async (dbClient: any, args: { p_work_id: string, p_status: string }) => {
	try {
		const data = await dbClient.update(schema.workScans).set({ status: args.p_status }).where(eq(schema.workScans.id, args.p_work_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const manageScanPosition = async (dbClient: any, args: { p_position_id: string, p_name: string }) => {
	try {
		const data = await dbClient.update(schema.scanPositions).set({ name: args.p_name }).where(eq(schema.scanPositions.id, args.p_position_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const manageScanOpening = async (dbClient: any, args: { p_opening_id: string, p_status: string }) => {
	try {
		const data = await dbClient.update(schema.scanOpenings).set({ status: args.p_status }).where(eq(schema.scanOpenings.id, args.p_opening_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const reviewScanApplication = async (dbClient: any, args: { p_application_id: string, p_status: string }) => {
	try {
		const data = await dbClient.update(schema.scanApplications).set({ status: args.p_status }).where(eq(schema.scanApplications.id, args.p_application_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const assignScanMemberPosition = async (dbClient: any, args: { p_member_id: string, p_position_id: string }) => {
	try {
		const data = await dbClient.insert(schema.scanMemberPositions).values({ memberId: args.p_member_id, positionId: args.p_position_id }).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const removeScanMemberPosition = async (dbClient: any, args: { p_member_id: string, p_position_id: string }) => {
	try {
		const data = await dbClient.delete(schema.scanMemberPositions).where(and(eq(schema.scanMemberPositions.memberId, args.p_member_id), eq(schema.scanMemberPositions.positionId, args.p_position_id))).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const setPrimaryScanPosition = async (dbClient: any, args: { p_member_id: string, p_position_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanMembers).set({ primaryPositionId: args.p_position_id }).where(eq(schema.scanMembers.id, args.p_member_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const postScanStaffNote = async (dbClient: any, args: { p_scan_id: string, p_author_id: string, p_content: string }) => {
	try {
		const data = await dbClient.insert(schema.scanStaffNotes).values({ scanId: args.p_scan_id, authorId: args.p_author_id, content: args.p_content }).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const deleteScanStaffNote = async (dbClient: any, args: { p_note_id: string }) => {
	try {
		const data = await dbClient.delete(schema.scanStaffNotes).where(eq(schema.scanStaffNotes.id, args.p_note_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const updateScanMemberVisibility = async (dbClient: any, args: { p_member_id: string, p_visibility: boolean }) => {
	try {
		const data = await dbClient.update(schema.scanMembers).set({ isVisible: args.p_visibility }).where(eq(schema.scanMembers.id, args.p_member_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const changeScanSlug = async (dbClient: any, args: { p_scan_id: string, p_new_slug: string }) => {
	try {
		const data = await dbClient.update(schema.scans).set({ slug: args.p_new_slug }).where(eq(schema.scans.id, args.p_scan_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const leaveScan = async (dbClient: any, args: { p_scan_id: string, p_user_id: string }) => {
	try {
		const data = await dbClient.delete(schema.scanMembers).where(and(eq(schema.scanMembers.scanId, args.p_scan_id), eq(schema.scanMembers.userId, args.p_user_id))).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const editScanMessage = async (dbClient: any, args: { p_message_id: string, p_content: string }) => {
	try {
		const data = await dbClient.update(schema.scanMessages).set({ content: args.p_content, updatedAt: new Date() }).where(eq(schema.scanMessages.id, args.p_message_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const deleteScanMessage = async (dbClient: any, args: { p_message_id: string }) => {
	try {
		const data = await dbClient.delete(schema.scanMessages).where(eq(schema.scanMessages.id, args.p_message_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const toggleScanMessageReaction = async (dbClient: any, args: { p_message_id: string, p_user_id: string, p_reaction: string }) => {
	try {
		const existing = await dbClient.select().from(schema.scanMessageReactions).where(and(eq(schema.scanMessageReactions.messageId, args.p_message_id), eq(schema.scanMessageReactions.userId, args.p_user_id), eq(schema.scanMessageReactions.reaction, args.p_reaction)));
		if (existing && existing.length > 0) {
			const data = await dbClient.delete(schema.scanMessageReactions).where(eq(schema.scanMessageReactions.id, existing[0].id)).returning();
			return { data, error: null };
		} else {
			const data = await dbClient.insert(schema.scanMessageReactions).values({ messageId: args.p_message_id, userId: args.p_user_id, reaction: args.p_reaction }).returning();
			return { data, error: null };
		}
	} catch (error) {
		return { data: null, error };
	}
};

export const markScanChannelRead = async (dbClient: any, args: { p_channel_id: string, p_user_id: string }) => {
	try {
		const data = await dbClient.insert(schema.scanChannelReadReceipts).values({ channelId: args.p_channel_id, userId: args.p_user_id, readAt: new Date() }).onConflictDoUpdate({ target: [schema.scanChannelReadReceipts.channelId, schema.scanChannelReadReceipts.userId], set: { readAt: new Date() } }).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const createScanProductionChapter = async (dbClient: any, args: { p_project_id: string, p_chapter_number: number }) => {
	try {
		const data = await dbClient.insert(schema.scanProductionChapters).values({ projectId: args.p_project_id, chapterNumber: args.p_chapter_number, status: 'DRAFT' }).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const bulkCreateScanProductionChapters = async (dbClient: any, args: { p_project_id: string, p_chapters: number[] }) => {
	try {
		const values = args.p_chapters.map(c => ({ projectId: args.p_project_id, chapterNumber: c, status: 'DRAFT' }));
		const data = await dbClient.insert(schema.scanProductionChapters).values(values).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const claimScanChapterStage = async (dbClient: any, args: { p_stage_id: string, p_user_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanChapterStages).set({ assigneeId: args.p_user_id, status: 'IN_PROGRESS' }).where(eq(schema.scanChapterStages.id, args.p_stage_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const releaseScanChapterStage = async (dbClient: any, args: { p_stage_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanChapterStages).set({ assigneeId: null, status: 'PENDING' }).where(eq(schema.scanChapterStages.id, args.p_stage_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const completeScanChapterStage = async (dbClient: any, args: { p_stage_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanChapterStages).set({ status: 'COMPLETED' }).where(eq(schema.scanChapterStages.id, args.p_stage_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const returnScanChapterStage = async (dbClient: any, args: { p_stage_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanChapterStages).set({ status: 'RETURNED' }).where(eq(schema.scanChapterStages.id, args.p_stage_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const adminOverrideScanStage = async (dbClient: any, args: { p_stage_id: string, p_status: string }) => {
	try {
		const data = await dbClient.update(schema.scanChapterStages).set({ status: args.p_status }).where(eq(schema.scanChapterStages.id, args.p_stage_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const publishScanProductionChapter = async (dbClient: any, args: { p_chapter_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanProductionChapters).set({ status: 'PUBLISHED', publishedAt: new Date() }).where(eq(schema.scanProductionChapters.id, args.p_chapter_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const unpublishScanProductionChapter = async (dbClient: any, args: { p_chapter_id: string }) => {
	try {
		const data = await dbClient.update(schema.scanProductionChapters).set({ status: 'DRAFT', publishedAt: null }).where(eq(schema.scanProductionChapters.id, args.p_chapter_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};

export const deleteScanProductionChapter = async (dbClient: any, args: { p_chapter_id: string }) => {
	try {
		const data = await dbClient.delete(schema.scanProductionChapters).where(eq(schema.scanProductionChapters.id, args.p_chapter_id)).returning();
		return { data, error: null };
	} catch (error) {
		return { data: null, error };
	}
};
