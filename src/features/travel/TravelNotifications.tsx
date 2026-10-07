export function TravelNotifications({ value, onChange }: { value: { client: boolean; photographer: boolean }; onChange: (value: { client: boolean; photographer: boolean }) => void }) {
  return <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
    <label className="flex items-center gap-2"><input type="checkbox" checked={value.client} onChange={event => onChange({ ...value, client: event.target.checked })} />Notify client</label>
    <label className="flex items-center gap-2"><input type="checkbox" checked={value.photographer} onChange={event => onChange({ ...value, photographer: event.target.checked })} />Notify photographer</label>
  </div>;
}
