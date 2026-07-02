import { CareSideNav } from '@/components/care/CareSideNav'

export default function PetLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { petId: string }
}) {
  return (
    <>
      <CareSideNav petId={params.petId} />
      {children}
    </>
  )
}
