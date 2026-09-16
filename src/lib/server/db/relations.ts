import { relations } from 'drizzle-orm';
import * as schema from './schema';

export const worksRelations = relations(schema.works, ({ many }) => ({
  chapters: many(schema.chapters),
  workScans: many(schema.workScans),
}));

export const chaptersRelations = relations(schema.chapters, ({ one }) => ({
  works: one(schema.works, {
    fields: [schema.chapters.workId],
    references: [schema.works.id],
  }),
}));

export const readingRelations = relations(schema.reading, ({ one }) => ({
  chapters: one(schema.chapters, {
    fields: [schema.reading.chapterId],
    references: [schema.chapters.id],
  }),
}));

export const workScansRelations = relations(schema.workScans, ({ one }) => ({
  works: one(schema.works, {
    fields: [schema.workScans.workId],
    references: [schema.works.id],
  }),
  scans: one(schema.scans, {
    fields: [schema.workScans.scanId],
    references: [schema.scans.id],
  }),
}));

export const scanMembersRelations = relations(schema.scanMembers, ({ one }) => ({
  scans: one(schema.scans, {
    fields: [schema.scanMembers.scanId],
    references: [schema.scans.id],
  }),
}));

