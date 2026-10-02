import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhotographerMapBottomStrip } from './PhotographerMapBottomStrip'
import type { PhotographerMapFields } from './photographerMapFields'

const emptyFields: PhotographerMapFields = {
  photographer: null,
  last: null,
  job: null,
  jobAddress: null,
  next: null,
  miles: null,
  travelMinutesLastToJob: null,
  travelMinutesJobToNext: null,
  driveSource: null,
  isEstimate: null,
  travelRiskLastToJob: null,
  travelRiskJobToNext: null,
  buffer: null,
  bufferMinutes: null,
}

describe('PhotographerMapBottomStrip', () => {
  it('renders nothing without a selected name', () => {
    const { container } = render(<PhotographerMapBottomStrip name={null} fields={emptyFields} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows name, miles, travel legs, and travel_risk pill', () => {
    render(
      <PhotographerMapBottomStrip
        name="Pat Photographer"
        fields={{
          ...emptyFields,
          miles: 3.25,
          travelMinutesLastToJob: 12,
          travelMinutesJobToNext: 20,
          buffer: 'early',
          travelRiskLastToJob: 'early',
        }}
      />,
    )
    expect(screen.getByTestId('photographer-map-bottom-strip')).toHaveTextContent('Pat Photographer')
    expect(screen.getByText('3.3 mi')).toBeInTheDocument()
    expect(screen.getByText(/last→job 12 min/)).toBeInTheDocument()
    expect(screen.getByText(/job→next 20 min/)).toBeInTheDocument()
    expect(screen.getByTestId('photographer-map-buffer-pill')).toHaveTextContent('~early')
  })

  it('degrades when metrics are missing', () => {
    render(<PhotographerMapBottomStrip name="Pat" fields={emptyFields} />)
    expect(screen.getByText('Map metrics unavailable')).toBeInTheDocument()
  })
})
