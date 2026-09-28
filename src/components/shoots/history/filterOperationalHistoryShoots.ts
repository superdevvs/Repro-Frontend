import type { ShootData } from '@/types/shoots'
import { filterEditorActiveOperationalShoots, filterEditorDeliveredOperationalShoots, isFeaturedTabShoot, type AvailableTab } from './shootHistoryUtils'

const READY_STATUS_KEYS = [
  'ready',
  'ready_for_client',
  'editing_complete',
  'editing_uploaded',
]

const DELIVERED_STATUS_KEYS = [
  'delivered',
  'admin_verified',
  'workflow_completed',
  'client_delivered',
  'finalised',
  'finalized',
]

export function filterOperationalHistoryShoots(operationalData: ShootData[], {
  activeTab, scheduledSubTab, inProgressSubTab, deliveredSubTab, holdSubTab,
}: {
  activeTab: AvailableTab
  scheduledSubTab: 'all' | 'requested' | 'scheduled'
  inProgressSubTab: 'all' | 'uploaded' | 'editing' | 'in_review'
  deliveredSubTab: 'all' | 'delivered' | 'ready'
  holdSubTab: 'all' | 'on_hold' | 'cancelled'
}) {
  // Scheduled tab filtering
  if (activeTab === 'scheduled') {
    if (scheduledSubTab === 'all') return operationalData
    if (scheduledSubTab === 'requested') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return status === 'requested'
      })
    }
    if (scheduledSubTab === 'scheduled') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return status === 'scheduled' || status === 'booked'
      })
    }
    return operationalData
  }

  if (activeTab === 'featured') {
    return operationalData.filter(isFeaturedTabShoot)
  }
  
  // In-Progress tab filtering
  if (activeTab === 'completed') {
    if (inProgressSubTab === 'all') return operationalData
    if (inProgressSubTab === 'uploaded') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return status.includes('uploaded') || status === 'photos_uploaded' || status === 'raw_uploaded'
      })
    }
    if (inProgressSubTab === 'editing') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        if (status === 'review' || status === 'pending_review' || status === 'ready_for_review' || status === 'qc' || status === 'editing_complete') {
          return false
        }
        return status.includes('editing') || status === 'start_editing'
      })
    }
    if (inProgressSubTab === 'in_review') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return (
          status === 'review' ||
          status === 'pending_review' ||
          status === 'ready_for_review' ||
          status === 'qc' ||
          status === 'editing_complete'
        )
      })
    }
    return operationalData
  }
  
  // Delivered tab filtering
  if (activeTab === 'delivered') {
    if (deliveredSubTab === 'all') return operationalData
    if (deliveredSubTab === 'delivered') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return DELIVERED_STATUS_KEYS.includes(status)
      })
    }
    if (deliveredSubTab === 'ready') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return READY_STATUS_KEYS.includes(status)
      })
    }
    return operationalData
  }
  
  // Editor "Editing" tab — backend sends tab=completed, filter to editing-status only
  if (activeTab === 'editing') {
    return filterEditorActiveOperationalShoots(operationalData)
  }

  // Editor "Edited" tab — backend sends tab=delivered, filter to delivered-status only
  if (activeTab === 'edited') {
    return filterEditorDeliveredOperationalShoots(operationalData)
  }

  // Hold tab filtering
  if (activeTab === 'hold') {
    if (holdSubTab === 'all') return operationalData
    if (holdSubTab === 'on_hold') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return status === 'on_hold' || status === 'hold_on'
      })
    }
    if (holdSubTab === 'cancelled') {
      return operationalData.filter(s => {
        const status = (s.workflowStatus || s.status || '').toLowerCase()
        return status === 'cancelled' || status === 'canceled'
      })
    }
    return operationalData
  }
  
  return operationalData
}
