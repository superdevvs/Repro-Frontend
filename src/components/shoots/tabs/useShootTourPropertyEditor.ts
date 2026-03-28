import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import { API_BASE_URL } from '@/config/env'
import { ShootData } from '@/types/shoots'
import type { NormalizedPropertyDetails } from '@/utils/shootTourData'

type SourceMap = Record<string, any>

type UseShootTourPropertyEditorArgs = {
  shoot: ShootData
  isAdmin: boolean
  isClient?: boolean
  onShootUpdate: () => void
  sourceTourLinks: SourceMap
  sourcePropertyDetails: SourceMap
  normalizedPropertyDetails: NormalizedPropertyDetails
}

export function useShootTourPropertyEditor({
  shoot,
  isAdmin,
  isClient = false,
  onShootUpdate,
  sourceTourLinks,
  sourcePropertyDetails,
  normalizedPropertyDetails,
}: UseShootTourPropertyEditorArgs) {
  const { toast } = useToast()
  const [propertyDescription, setPropertyDescription] = useState('')
  const [isSavingDescription, setIsSavingDescription] = useState(false)
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
  const [propertyMls, setPropertyMls] = useState('')
  const [propertyPrice, setPropertyPrice] = useState('')
  const [propertyLotSize, setPropertyLotSize] = useState('')
  const [propertyBedrooms, setPropertyBedrooms] = useState('')
  const [propertyBathrooms, setPropertyBathrooms] = useState('')
  const [propertySqft, setPropertySqft] = useState('')
  const [listingType, setListingType] = useState<string>('')
  const [propertyStatus, setPropertyStatus] = useState<string>('available')
  const [isSavingListingType, setIsSavingListingType] = useState(false)
  const [isSavingPropertyStatus, setIsSavingPropertyStatus] = useState(false)
  const [isSavingPropertyDetails, setIsSavingPropertyDetails] = useState(false)

  const isClientView = Boolean(isClient && !isAdmin)
  const canEditPropertyInfo = Boolean(isAdmin || isClientView)

  const propertySyncKey = useMemo(
    () =>
      JSON.stringify({
        propertyDescription: sourceTourLinks?.property_description || '',
        propertyMls:
          sourceTourLinks?.property_mls ||
          (shoot as any)?.mls_id ||
          sourcePropertyDetails?.mls_id ||
          sourcePropertyDetails?.mlsId ||
          '',
        propertyPrice:
          sourceTourLinks?.property_price ??
          sourcePropertyDetails?.price ??
          sourcePropertyDetails?.listPrice ??
          '',
        propertyLotSize:
          sourceTourLinks?.property_lot_size ??
          sourcePropertyDetails?.lot_size ??
          sourcePropertyDetails?.lotSize ??
          '',
        bedrooms: normalizedPropertyDetails?.bedrooms ?? '',
        bathrooms: normalizedPropertyDetails?.bathrooms ?? '',
        sqft: normalizedPropertyDetails?.sqft ?? '',
        listingType: (shoot as any)?.listing_type || (shoot as any)?.listingType || '',
        propertyStatus: (shoot as any)?.property_status || (shoot as any)?.propertyStatus || 'available',
      }),
    [normalizedPropertyDetails, shoot, sourcePropertyDetails, sourceTourLinks],
  )

  useEffect(() => {
    const normalizedMls =
      sourceTourLinks?.property_mls ||
      (shoot as any)?.mls_id ||
      sourcePropertyDetails?.mls_id ||
      sourcePropertyDetails?.mlsId ||
      ''
    const normalizedPrice =
      sourceTourLinks?.property_price ??
      sourcePropertyDetails?.price ??
      sourcePropertyDetails?.listPrice ??
      ''
    const normalizedLotSize =
      sourceTourLinks?.property_lot_size ??
      sourcePropertyDetails?.lot_size ??
      sourcePropertyDetails?.lotSize ??
      ''

    setPropertyDescription(sourceTourLinks?.property_description || '')
    setPropertyMls(normalizedMls ? String(normalizedMls) : '')
    setPropertyPrice(normalizedPrice !== '' && normalizedPrice !== null && normalizedPrice !== undefined ? String(normalizedPrice) : '')
    setPropertyLotSize(normalizedLotSize !== '' && normalizedLotSize !== null && normalizedLotSize !== undefined ? String(normalizedLotSize) : '')
    setPropertyBedrooms(
      normalizedPropertyDetails?.bedrooms !== undefined && normalizedPropertyDetails?.bedrooms !== null
        ? String(normalizedPropertyDetails.bedrooms)
        : ''
    )
    setPropertyBathrooms(
      normalizedPropertyDetails?.bathrooms !== undefined && normalizedPropertyDetails?.bathrooms !== null
        ? String(normalizedPropertyDetails.bathrooms)
        : ''
    )
    setPropertySqft(
      normalizedPropertyDetails?.sqft !== undefined && normalizedPropertyDetails?.sqft !== null
        ? String(normalizedPropertyDetails.sqft)
        : ''
    )
    setListingType((shoot as any)?.listing_type || (shoot as any)?.listingType || '')
    setPropertyStatus((shoot as any)?.property_status || (shoot as any)?.propertyStatus || 'available')
  }, [propertySyncKey])

  const savePropertyField = async (field: string, value: string) => {
    if (!canEditPropertyInfo) return
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          tour_links: {
            [field]: value || null,
          },
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to save' }))
        throw new Error(errorData.message || 'Failed to save')
      }
      onShootUpdate()
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to save property info.', variant: 'destructive' })
    }
  }

  const savePropertyDetails = async () => {
    if (!canEditPropertyInfo) return

    const trimmedBedrooms = propertyBedrooms.trim()
    const trimmedBathrooms = propertyBathrooms.trim()
    const trimmedSqft = propertySqft.trim()

    const parsedBedrooms = trimmedBedrooms === '' ? null : parseInt(trimmedBedrooms, 10)
    const parsedBathrooms = trimmedBathrooms === '' ? null : parseFloat(trimmedBathrooms)
    const parsedSqft = trimmedSqft === '' ? null : parseInt(trimmedSqft, 10)

    if (trimmedBedrooms !== '' && (parsedBedrooms === null || Number.isNaN(parsedBedrooms))) {
      toast({ title: 'Invalid value', description: 'Please enter a valid bedrooms value.', variant: 'destructive' })
      return
    }
    if (trimmedBathrooms !== '' && (parsedBathrooms === null || Number.isNaN(parsedBathrooms))) {
      toast({ title: 'Invalid value', description: 'Please enter a valid bathrooms value.', variant: 'destructive' })
      return
    }
    if (trimmedSqft !== '' && (parsedSqft === null || Number.isNaN(parsedSqft))) {
      toast({ title: 'Invalid value', description: 'Please enter a valid square feet value.', variant: 'destructive' })
      return
    }

    try {
      setIsSavingPropertyDetails(true)
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({
          bedrooms: parsedBedrooms,
          bathrooms: parsedBathrooms,
          sqft: parsedSqft,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to save' }))
        throw new Error(errorData.message || 'Failed to save')
      }

      setPropertyBedrooms(parsedBedrooms === null ? '' : String(parsedBedrooms))
      setPropertyBathrooms(parsedBathrooms === null ? '' : String(parsedBathrooms))
      setPropertySqft(parsedSqft === null ? '' : String(parsedSqft))

      toast({ title: 'Saved', description: 'Property details updated successfully.' })
      onShootUpdate()
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to save property info.', variant: 'destructive' })
    } finally {
      setIsSavingPropertyDetails(false)
    }
  }

  const saveShootField = async (field: string, value: string, setLoading: (value: boolean) => void) => {
    if (!canEditPropertyInfo) return
    setLoading(true)
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to save' }))
        throw new Error(errorData.message || 'Failed to save')
      }
      toast({ title: 'Saved', description: `${field.replace('_', ' ')} updated.` })
      onShootUpdate()
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to save.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDescription = async () => {
    if (!isAdmin) return
    setIsGeneratingDescription(true)
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token')
      const res = await fetch(`${API_BASE_URL}/api/shoots/${shoot.id}/generate-description`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Failed to generate description' }))
        throw new Error(errorData.message || 'Failed to generate description')
      }
      const data = await res.json()
      if (data.description) {
        setPropertyDescription(data.description)
        toast({
          title: 'Generated',
          description: `AI description generated using ${data.images_used || 0} images. Click Save Description to apply it.`,
        })
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message || 'Failed to generate description.', variant: 'destructive' })
    } finally {
      setIsGeneratingDescription(false)
    }
  }

  const handleSaveDescription = async () => {
    if (!canEditPropertyInfo) return
    setIsSavingDescription(true)
    try {
      await savePropertyField('property_description', propertyDescription)
      toast({ title: 'Saved', description: 'Property description updated successfully.' })
      onShootUpdate()
    } finally {
      setIsSavingDescription(false)
    }
  }

  return {
    isClientView,
    canEditPropertyInfo,
    propertyDescription,
    setPropertyDescription,
    isSavingDescription,
    isGeneratingDescription,
    propertyMls,
    setPropertyMls,
    propertyPrice,
    setPropertyPrice,
    propertyLotSize,
    setPropertyLotSize,
    propertyBedrooms,
    setPropertyBedrooms,
    propertyBathrooms,
    setPropertyBathrooms,
    propertySqft,
    setPropertySqft,
    listingType,
    setListingType,
    propertyStatus,
    setPropertyStatus,
    isSavingListingType,
    setIsSavingListingType,
    isSavingPropertyStatus,
    setIsSavingPropertyStatus,
    isSavingPropertyDetails,
    savePropertyField,
    savePropertyDetails,
    saveShootField,
    handleGenerateDescription,
    handleSaveDescription,
  }
}
