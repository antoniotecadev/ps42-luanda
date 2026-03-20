import QueueLive from '@/components/cadet/QueueLive'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function CadeteQueue() {
    const session = await auth()
    if (!session?.user) redirect('/login')

    return (
        <div className="min-h-screen p-6 md:p-10 mx-auto max-w-4xl">
            <QueueLive userId={session.user.id} />
        </div>
    )
}