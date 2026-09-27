import KVStore from '#models/kv_store'
import { BenchmarkService } from '#services/benchmark_service'
import { ContextWindowService } from '#services/context_window_service'
import { MapService } from '#services/map_service'
import { OllamaService } from '#services/ollama_service'
import { SystemService } from '#services/system_service'
import { getSettingSchema, updateSettingSchema, validateSettingValue } from '#validators/settings'
import { inject } from '@adonisjs/core'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { parseMinRelevance } from '../utils/misc.js'
import { isRelevanceCheckEnabled } from '../utils/relevance_judge.js'
import { parseResponseStyle } from '../utils/sampler.js'
import { RAG_MIN_FINAL_SCORE } from '../../constants/ollama.js'
import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import {
  ASSISTANT_AVATAR_ALLOWED_EXTENSIONS,
  ASSISTANT_AVATAR_ALLOWED_FORMATS,
  ASSISTANT_AVATAR_MAX_BYTES,
  ASSISTANT_AVATAR_STORAGE_PATH,
  assistantAvatarFilename,
  exceedsAssistantAvatarSizeLimit,
  isAllowedAssistantAvatarFormat,
} from '../utils/assistant_avatar.js'

@inject()
export default class SettingsController {
  constructor(
    private systemService: SystemService,
    private mapService: MapService,
    private benchmarkService: BenchmarkService,
    private ollamaService: OllamaService,
    private contextWindowService: ContextWindowService
  ) {}

  async system({ inertia }: HttpContext) {
    const systemInfo = await this.systemService.getSystemInfo()
    return inertia.render('settings/system', {
      system: {
        info: systemInfo,
      },
    })
  }

  async apps({ inertia }: HttpContext) {
    const services = await this.systemService.getServices({ installedOnly: false })
    return inertia.render('settings/apps', {
      system: {
        services,
      },
    })
  }

  async legal({ inertia }: HttpContext) {
    return inertia.render('settings/legal')
  }

  async support({ inertia }: HttpContext) {
    return inertia.render('settings/support')
  }

  async maps({ inertia }: HttpContext) {
    const baseAssetsCheck = await this.mapService.ensureBaseAssets()
    const [regionFiles, worldBasemapExists] = await Promise.all([
      this.mapService.listRegions(),
      this.mapService.checkWorldBasemapExists(),
    ])
    return inertia.render('settings/maps', {
      maps: {
        baseAssetsExist: baseAssetsCheck,
        worldBasemapExists,
        regionFiles: regionFiles.files,
      },
    })
  }

  async models({ inertia }: HttpContext) {
    const availableModels = await this.ollamaService.getAvailableModels({
      sort: 'pulls',
      recommendedOnly: false,
      query: null,
      limit: 15,
    })
    const installedModels = await this.ollamaService.getModels().catch(() => [])
    const chatSuggestionsEnabled = await KVStore.getValue('chat.suggestionsEnabled')
    const aiAssistantCustomName = await KVStore.getValue('ai.assistantCustomName')
    const remoteOllamaUrl = await KVStore.getValue('ai.remoteOllamaUrl')
    const ollamaFlashAttention = await KVStore.getValue('ai.ollamaFlashAttention')
    const autoThinking = await KVStore.getValue('ai.autoThinking')
    const tasksModel = await KVStore.getValue('ai.tasksModel')
    const ragEnabled = await KVStore.getValue('rag.enabled')
    const contextWindow = await KVStore.getValue('ai.contextWindow')
    const minRelevance = await KVStore.getValue('rag.minRelevance')
    const relevanceCheck = await KVStore.getValue('rag.relevanceCheck')
    const responseStyle = await KVStore.getValue('ai.responseStyle')
    // Resolved window per installed model, so the setting shows what "Auto"
    // actually produced rather than leaving the user to guess. Best-effort:
    // a model whose metadata can't be read simply doesn't get a badge.
    const resolvedContextWindows: Record<string, number> = {}
    await Promise.all(
      (installedModels || []).map(async (model) => {
        try {
          resolvedContextWindows[model.name] = await this.contextWindowService.windowFor(model.name)
        } catch {
          /* leave unset */
        }
      })
    )
    return inertia.render('settings/models', {
      models: {
        availableModels: availableModels?.models || [],
        installedModels: installedModels || [],
        settings: {
          chatSuggestionsEnabled: chatSuggestionsEnabled ?? false,
          aiAssistantCustomName: aiAssistantCustomName ?? '',
          remoteOllamaUrl: remoteOllamaUrl ?? '',
          ollamaFlashAttention: ollamaFlashAttention ?? true,
          autoThinking: autoThinking ?? false,
          tasksModel: tasksModel ?? '',
          ragEnabled: ragEnabled ?? true,
          contextWindow: contextWindow ?? 'auto',
          // Sent as the resolved number so the select can match an option
          // without duplicating the "unset means the default" rule in the UI.
          minRelevance: parseMinRelevance(minRelevance, RAG_MIN_FINAL_SCORE),
          relevanceCheck: isRelevanceCheckEnabled(relevanceCheck),
          // Resolved rather than raw, for the same reason: unset means 'auto',
          // and the select shouldn't have to know that.
          responseStyle: parseResponseStyle(responseStyle),
        },
        resolvedContextWindows,
      },
    })
  }

  async update({ inertia }: HttpContext) {
    const updateInfo = await this.systemService.checkLatestVersion()
    return inertia.render('settings/update', {
      system: {
        updateAvailable: updateInfo.updateAvailable,
        latestVersion: updateInfo.latestVersion,
        currentVersion: updateInfo.currentVersion,
      },
    })
  }

  async zim({ inertia }: HttpContext) {
    return inertia.render('settings/zim/index')
  }

  async zimRemote({ inertia }: HttpContext) {
    return inertia.render('settings/zim/remote-explorer')
  }

  async creatorPacks({ inertia }: HttpContext) {
    return inertia.render('settings/creator-packs')
  }

  async benchmark({ inertia }: HttpContext) {
    const latestResult = await this.benchmarkService.getLatestResult()
    const status = this.benchmarkService.getStatus()
    return inertia.render('settings/benchmark', {
      benchmark: {
        latestResult,
        status: status.status,
        currentBenchmarkId: status.benchmarkId,
      },
    })
  }

  async advanced({ inertia }: HttpContext) {
    // When the env var is set it always takes precedence over the stored value,
    // so surface that to the UI to disable the field and explain the override.
    const envOverride = Boolean(env.get('INTERNET_STATUS_TEST_URL')?.trim())
    const internetStatusTestUrl = await KVStore.getValue('system.internetStatusTestUrl')
    return inertia.render('settings/advanced', {
      advanced: {
        internetStatusTestUrl: internetStatusTestUrl ?? '',
        internetStatusTestUrlEnvOverride: envOverride,
      },
    })
  }

  async getSetting({ request, response }: HttpContext) {
    const { key } = await getSettingSchema.validate({ key: request.qs().key });
    const value = await KVStore.getValue(key);
    return response.status(200).send({ key, value });
  }

  async updateSetting({ request, response }: HttpContext) {
    const reqData = await request.validateUsing(updateSettingSchema)
    const valueError = validateSettingValue(reqData.key, reqData.value)
    if (valueError) {
      return response.status(422).send({ success: false, message: valueError })
    }
    await this.systemService.updateSetting(reqData.key, reqData.value)
    return response.status(200).send({ success: true, message: 'Setting updated successfully' })
  }

  /**
   * Upload (or replace) the assistant avatar shown in the chat UI. The
   * decoded image format sharp reports is what is trusted, not the
   * client-supplied extension — see chat_images.ts for the same pattern on
   * chat image attachments. Stored under the persisted storage volume
   * (storage/assistant), served back by AssistantStaticMiddleware.
   */
  async uploadAssistantAvatar({ request, response }: HttpContext) {
    const file = request.file('avatar', {
      size: ASSISTANT_AVATAR_MAX_BYTES,
      extnames: [...ASSISTANT_AVATAR_ALLOWED_EXTENSIONS],
    })
    if (!file) {
      return response.status(400).send({ success: false, message: 'No avatar file uploaded.' })
    }
    if (!file.isValid || !file.tmpPath) {
      return response.status(422).send({
        success: false,
        message: file.errors[0]?.message ?? 'That file could not be uploaded as an avatar.',
      })
    }
    if (exceedsAssistantAvatarSizeLimit(file.size)) {
      return response.status(413).send({
        success: false,
        message: `Avatar must be ${Math.floor(ASSISTANT_AVATAR_MAX_BYTES / (1024 * 1024))} MB or smaller.`,
      })
    }

    let format: string | undefined
    try {
      const metadata = await sharp(file.tmpPath, { failOn: 'warning' }).metadata()
      format = metadata.format
    } catch {
      return response
        .status(422)
        .send({ success: false, message: 'Could not read that file as an image.' })
    }
    if (!isAllowedAssistantAvatarFormat(format)) {
      return response
        .status(415)
        .send({ success: false, message: 'Avatar must be a JPEG, PNG, WebP, or GIF image.' })
    }

    const dir = app.makePath(ASSISTANT_AVATAR_STORAGE_PATH)
    await mkdir(dir, { recursive: true })
    const filename = assistantAvatarFilename(format)
    // Clear any previously stored avatar saved under a different format, so
    // changing formats between uploads never leaves an orphaned file behind.
    await Promise.all(
      ASSISTANT_AVATAR_ALLOWED_FORMATS.filter((f) => assistantAvatarFilename(f) !== filename).map(
        (f) => unlink(join(dir, assistantAvatarFilename(f))).catch(() => {})
      )
    )
    await file.move(dir, { name: filename, overwrite: true })

    // Cache-busted so a same-format re-upload (same URL path) is not served
    // stale from the browser cache.
    const url = `/${filename}?v=${Date.now()}`
    await this.systemService.updateSetting('ai.assistantAvatarUrl', url)

    return response.status(200).send({ success: true, url })
  }

  /** Remove the uploaded assistant avatar and revert to the default icon. */
  async removeAssistantAvatar({ response }: HttpContext) {
    const dir = app.makePath(ASSISTANT_AVATAR_STORAGE_PATH)
    await Promise.all(
      ASSISTANT_AVATAR_ALLOWED_FORMATS.map((f) =>
        unlink(join(dir, assistantAvatarFilename(f))).catch(() => {})
      )
    )
    await this.systemService.updateSetting('ai.assistantAvatarUrl', '')
    return response.status(200).send({ success: true })
  }
}
