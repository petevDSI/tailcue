'use client'

import { useState } from 'react'
import { MoreVertical, Feather, Trash2, RotateCcw } from 'lucide-react'
import { memorializePet, restorePet, deletePet } from '@/lib/care-storage'

type Stage = null | 'menu' | 'memorialize' | 'remove1' | 'remove2'

export function CarePetManageMenu({
  petId,
  petName,
  memorialized,
  isOwner,
  onChanged,
  onRemoved,
  align = 'right',
}: {
  petId: string
  petName: string
  memorialized: boolean
  isOwner: boolean
  onChanged: () => void
  onRemoved: () => void
  align?: 'left' | 'right'
}) {
  const [stage, setStage] = useState<Stage>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function stop(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
  }
  function close() {
    setStage(null)
    setError(null)
  }
  async function run(fn: () => Promise<void>, after: () => void) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      close()
      after()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Manage pet"
        onClick={(e) => { stop(e); setStage('menu') }}
        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {stage === 'menu' && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { stop(e); close() }} />
          <div
            className={`absolute z-50 mt-1 ${align === 'right' ? 'right-0' : 'left-0'} bg-white border border-stone-200 rounded-xl shadow-md py-1 w-48`}
          >
            {memorialized ? (
              <button
                type="button"
                onClick={(e) => { stop(e); run(() => restorePet(petId), onChanged) }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                <RotateCcw className="w-4 h-4 text-stone-400" /> Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => { stop(e); setStage('memorialize') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
              >
                <Feather className="w-4 h-4 text-stone-400" /> Move to In Memory
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                onClick={(e) => { stop(e); setStage('remove1') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> Remove…
              </button>
            )}
          </div>
        </>
      )}

      {(stage === 'memorialize' || stage === 'remove1' || stage === 'remove2') && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={(e) => { stop(e); if (!busy) close() }}
        >
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 max-w-sm w-full" onClick={stop}>
            {stage === 'memorialize' && (
              <>
                <h3 className="text-lg font-bold text-stone-900 mb-1">Move {petName} to In Memory?</h3>
                <p className="text-sm text-stone-500 mb-5 leading-relaxed">
                  {petName}&apos;s logs are kept, and the card moves to your In Memory section. You can restore {petName} anytime.
                </p>
                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={(e) => { stop(e); close() }}
                    className="flex-1 border border-stone-200 text-stone-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-stone-50 disabled:opacity-50">Cancel</button>
                  <button type="button" disabled={busy} onClick={(e) => { stop(e); run(() => memorializePet(petId), onChanged) }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                    {busy ? 'Saving…' : 'Move to In Memory'}</button>
                </div>
              </>
            )}

            {stage === 'remove1' && (
              <>
                <h3 className="text-lg font-bold text-stone-900 mb-1">Remove {petName}?</h3>
                <p className="text-sm text-stone-500 mb-5 leading-relaxed">
                  This permanently deletes {petName} and all of their logs.{' '}
                  {memorialized ? 'This cannot be undone.' : 'If you’d rather keep their history, choose “Move to In Memory” instead.'}
                </p>
                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={(e) => { stop(e); close() }}
                    className="flex-1 border border-stone-200 text-stone-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-stone-50 disabled:opacity-50">Cancel</button>
                  {memorialized ? (
                    <button type="button" disabled={busy} onClick={(e) => { stop(e); setStage('remove2') }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">Continue</button>
                  ) : (
                    <button type="button" disabled={busy} onClick={(e) => { stop(e); run(() => deletePet(petId), onRemoved) }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                      {busy ? 'Removing…' : 'Remove'}</button>
                  )}
                </div>
              </>
            )}

            {stage === 'remove2' && (
              <>
                <h3 className="text-lg font-bold text-stone-900 mb-1">This can&apos;t be undone</h3>
                <p className="text-sm text-stone-500 mb-5 leading-relaxed">
                  Permanently delete {petName} and every log? This is final and cannot be recovered.
                </p>
                {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
                <div className="flex gap-2">
                  <button type="button" disabled={busy} onClick={(e) => { stop(e); close() }}
                    className="flex-1 border border-stone-200 text-stone-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-stone-50 disabled:opacity-50">Keep {petName}</button>
                  <button type="button" disabled={busy} onClick={(e) => { stop(e); run(() => deletePet(petId), onRemoved) }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 rounded-xl disabled:opacity-50">
                    {busy ? 'Deleting…' : 'Delete forever'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
