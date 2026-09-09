import type {
  AnnotationUpdate,
  AudioUploadResult,
  ItemDetail,
  ItemSummary,
  PairingState,
  TranscriptImportReport,
} from 'shared'

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, init)
  if (!res.ok) {
    const body: { error?: string } = await res.json().catch(() => ({}))
    throw new ApiRequestError(res.status, body.error ?? res.statusText)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  listItems: () => call<ItemSummary[]>('/items'),
  getItem: (id: string) => call<ItemDetail>(`/items/${id}`),
  audioUrl: (id: string) => `/api/items/${id}/audio`,
  saveAnnotation: (id: string, update: AnnotationUpdate) =>
    call<ItemDetail>(`/items/${id}/annotation`, json('PUT', update)),
  pasteTranscript: (id: string, label: string) =>
    call<ItemDetail>(`/items/${id}/transcript`, json('POST', { label })),
  pair: (id: string, transcriptId: string) =>
    call<void>(`/items/${id}/pair`, json('POST', { transcriptId })),
  unpair: (id: string) => call<void>(`/items/${id}/unpair`, { method: 'POST' }),
  pairing: () => call<PairingState>('/pairing'),
  uploadAudio: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return call<AudioUploadResult>('/audio', { method: 'POST', body: form })
  },
  importTranscripts: (text: string) =>
    call<TranscriptImportReport>('/transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text,
    }),
  exportUrl: (includeUnfinished: boolean) =>
    `/api/export${includeUnfinished ? '?includeUnfinished=true' : ''}`,
}
