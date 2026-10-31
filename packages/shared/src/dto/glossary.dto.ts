import { z } from 'zod';

/** A term the user wants STT and translation to get right (names, product terms, jargon). */
export const GlossaryTermSchema = z.object({
  id: z.uuid(),
  term: z.string().trim().min(1).max(120),
  translation: z.string().trim().max(200).nullable(),
  note: z.string().trim().max(500).nullable(),
  createdAt: z.iso.datetime(),
});
export type GlossaryTerm = z.infer<typeof GlossaryTermSchema>;

export const CreateGlossaryTermSchema = z.object({
  term: GlossaryTermSchema.shape.term,
  translation: GlossaryTermSchema.shape.translation.optional().default(null),
  note: GlossaryTermSchema.shape.note.optional().default(null),
});
export type CreateGlossaryTermInput = z.input<typeof CreateGlossaryTermSchema>;
export type CreateGlossaryTerm = z.output<typeof CreateGlossaryTermSchema>;

export const UpdateGlossaryTermSchema = z
  .object({
    term: GlossaryTermSchema.shape.term,
    translation: GlossaryTermSchema.shape.translation,
    note: GlossaryTermSchema.shape.note,
  })
  .partial();
export type UpdateGlossaryTerm = z.infer<typeof UpdateGlossaryTermSchema>;

export const GlossaryTermListSchema = z.object({ items: z.array(GlossaryTermSchema) });
export type GlossaryTermList = z.infer<typeof GlossaryTermListSchema>;
