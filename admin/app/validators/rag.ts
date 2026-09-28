import vine from '@vinejs/vine'

export const getJobStatusSchema = vine.compile(
  vine.object({
    filePath: vine.string(),
  })
)

export const deleteFileSchema = vine.compile(
  vine.object({
    source: vine.string(),
  })
)

export const embedFileSchema = vine.compile(
  vine.object({
    source: vine.string().minLength(1),
    force: vine.boolean().optional(),
  })
)

export const fileSourceSchema = vine.compile(
  vine.object({
    source: vine.string().minLength(1),
  })
)

export const ingestUrlSchema = vine.compile(
  vine.object({
    url: vine
      .string()
      .trim()
      .url({ protocols: ['https'], require_protocol: true }),
    collection: vine.string().trim().optional(),
  })
)

export const estimateBatchSchema = vine.compile(
  vine.object({
    files: vine
      .array(
        vine.object({
          filename: vine.string().minLength(1).maxLength(255),
          sizeBytes: vine.number().min(0),
        })
      )
      .minLength(1)
      .maxLength(500),
  })
)
