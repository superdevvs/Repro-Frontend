import type { ShootData } from '@/types/shoots';
import type { AvailableTab } from '@/components/shoots/history/shootHistoryUtils';
import { normalizeShootDetailsStatus } from '@/components/shoots/modal/shootDetailsCapabilities';

export const downloadBlob = (filename: string, blob: Blob) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.parentNode?.removeChild(link)
  window.URL.revokeObjectURL(url)
}

export const getHistoryDownloadMode = (
  shoot: ShootData,
  activeTab: AvailableTab,
): 'delivered' | 'raw' => {
  const normalizedStatus = normalizeShootDetailsStatus(
    shoot.workflowStatus || shoot.status,
  )

  if (
    activeTab === 'delivered' ||
    normalizedStatus === 'delivered' ||
    normalizedStatus === 'ready'
  ) {
    return 'delivered'
  }

  return 'raw'
}
