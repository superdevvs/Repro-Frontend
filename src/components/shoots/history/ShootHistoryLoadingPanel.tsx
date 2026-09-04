import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export const ShootHistoryLoadingPanel = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: 'easeOut' }}
    className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border/60 bg-card/80 p-8 shadow-sm"
  >
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="rounded-[999px] bg-blue-100 px-4 py-2 text-slate-900 shadow-sm dark:bg-blue-500/20 dark:text-blue-100">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Loading shoot history...</span>
        </div>
      </div>
    </div>
  </motion.div>
)
