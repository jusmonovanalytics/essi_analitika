import { AnimatePresence, motion } from 'framer-motion'
import { X, AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'

const ICONS = {
  warning: <AlertTriangle size={16} className="text-amber-400" />,
  error: <AlertCircle size={16} className="text-red-400" />,
  info: <Info size={16} className="text-blue-400" />,
  success: <CheckCircle size={16} className="text-emerald-400" />,
}

const STYLES = {
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-200',
  error: 'bg-red-500/10 border-red-500/30 text-red-200',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-200',
  success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
}

export default function NotificationBanner() {
  const { notifications, dismissNotification } = useAppStore()
  const visible = notifications.filter(n => !n.dismissed).slice(0, 3)

  if (!visible.length) return null

  return (
    <div className="px-5 pt-3 space-y-2 flex-shrink-0">
      <AnimatePresence>
        {visible.map(n => (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, y: -20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -20, height: 0 }}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm ${STYLES[n.type]}`}
          >
            {ICONS[n.type]}
            <span className="flex-1">{n.message}</span>
            <button
              onClick={() => dismissNotification(n.id)}
              className="ml-auto text-current opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
