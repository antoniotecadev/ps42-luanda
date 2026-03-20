import QueueLive from '@/components/cadet/QueueLive'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { checkEligibility, isWithinOperatingHours } from '@/lib/eligibility'

export default async function CadeteQueue() {
    const session = await auth()
    if (!session?.user) redirect('/login')

    // Verificar elegibilidade e horas de funcionamento
    const [eligibility, hours] = await Promise.all([
        checkEligibility(session.user.id, session.user.accessToken),
        Promise.resolve(isWithinOperatingHours()),
    ])

    if (!eligibility.isEligible || !hours.allowed) {
        redirect('/cadet/dashboard')
    }

    return (
        <div className="min-h-screen p-6 md:p-10">
            <QueueLive userId={session.user.id} />
        </div>
    )
}