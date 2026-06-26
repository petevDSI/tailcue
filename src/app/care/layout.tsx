import { CareAuthProvider } from '@/components/care/CareAuthProvider'

export default function CareLayout({ children }: { children: React.ReactNode }) {
  return <CareAuthProvider>{children}</CareAuthProvider>
}
