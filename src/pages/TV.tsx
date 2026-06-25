import { Tv2, Monitor, ArrowRight } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import { useT } from '../i18n'

export default function TV() {
  const { setTvMode } = useAppStore()
  const t = useT()

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
      <div className="text-center space-y-3">
        <div className="w-20 h-20 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto">
          <Tv2 size={36} className="text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('tv.title')}</h2>
        <p className="max-w-md" style={{ color: 'var(--text-secondary)' }}>{t('tv.description')}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md w-full">
        {[
          { icon: '🥇', title: t('tv.marathon_slide'), desc: t('marathon.title') },
          { icon: '📊', title: t('tv.kpi_slide'),       desc: t('nav.dashboard') },
          { icon: '📈', title: t('tv.analytics_slide'), desc: t('nav.analytics') },
          { icon: '🏆', title: t('tv.clients_slide'),   desc: t('analytics.top_client') },
        ].map(s => (
          <div key={s.title} className="glass-card p-4">
            <p className="text-2xl mb-2">{s.icon}</p>
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 text-center">
        <button onClick={() => setTvMode(true)} className="btn-primary px-8 py-3 text-base">
          <Monitor size={18} />
          {t('tv.start_btn')}
          <ArrowRight size={16} />
        </button>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('tv.exit_hint')}</p>
      </div>
    </div>
  )
}
