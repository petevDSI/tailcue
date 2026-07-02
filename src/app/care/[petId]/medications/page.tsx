'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  getPet, addLogEntry, deleteLogEntry,
  type CareLogEntry, type PetProfile,
} from '@/lib/care-storage'
import { CareMedicationSection } from '@/components/care/CareMedicationSection'

export default function MedicationsPage() {
  const params = useParams()
  const router = useRouter()
  const petId = params.petId as string

  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<PetProfile | null>(null)
  const [logs, setLogs] = useState<CareLogEntry[]>([])

  useEffect(() => {
    setMounted(true)
    getPet(petId).then((record) => {
      if (!record) { router.replace('/care'); return }
      setProfile(record.profile)
      setLogs(record.logs)
    })
  }, [petId, router])

  if (!mounted || !profile) return null

  return (
    <div className="min-h-screen bg-background flex flex-col md:pl-[220px]">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link
          href={`/care/${petId}`}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <span className="text-stone-200">|</span>
        <span className="text-sm font-semibold text-foreground">Medications</span>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-24 md:pb-8">
        <CareMedicationSection
          petId={petId}
          condition={profile.condition}
          species={profile.species}
          logs={logs}
          onLogEntry={(entry) => {
            setLogs((prev) => [entry, ...prev])
            addLogEntry(petId, entry)
          }}
          onDeleteLog={(id) => {
            setLogs((prev) => prev.filter((l) => l.id !== id))
            deleteLogEntry(petId, id)
          }}
        />
      </main>
    </div>
  )
}
