# Auto-Expanding Tabs Implementation Plan

## Overview
Replace traditional horizontal scrolling tabs on mobile with auto-expanding tabs that show:
- **Inactive tabs**: Icon only (compact circular/pill-shaped buttons)
- **Active tab**: Icon + text label (expanded to accommodate both)

This pattern is inspired by modern mobile UI patterns where only the active tab expands to show its label, saving screen space while maintaining clarity.

## Implementation Strategy

### 1. Create Reusable Component
Create a new `AutoExpandingTabs` component that:
- Accepts tabs with icons and labels
- Manages active state
- Shows icon-only for inactive tabs
- Shows icon + text for active tab
- Handles smooth transitions/animations
- Works on both mobile and desktop (with optional responsive behavior)

### 2. Priority Locations (Mobile-First)

#### Phase 1: Shoot History (Primary Target)
**File**: `repro-frontend/src/pages/ShootHistory.tsx`
- **Current tabs**: "Scheduled Shoots", "Completed Shoots", "Hold-On Shoots", "History" (conditional)
- **Icons**: CalendarIcon, CheckCircle2, PauseCircle, FileText
- **Line**: ~1958-1977
- **Status**: High priority - this is the main target from user request

#### Phase 2: Shoots Filter Component
**File**: `repro-frontend/src/components/dashboard/ShootsFilter.tsx`
- **Current tabs**: "All", "Scheduled", "Completed"
- **Icons**: Need to add appropriate icons
- **Line**: ~76-84 (mobile), ~90-98 (desktop)
- **Status**: Used in Shoot History page, should be updated

#### Phase 3: Photographer Shoot History
**File**: `repro-frontend/src/pages/PhotographerShootHistory.tsx`
- **Current tabs**: "Upcoming", "Scheduled", "Completed"
- **Icons**: Calendar, Calendar, Eye
- **Line**: ~237-251
- **Status**: Related to shoot history, should be consistent

### 3. Other Tab Locations (Lower Priority)

These files contain tabs but may not need auto-expanding behavior:

#### Shoot Detail Tabs
**File**: `repro-frontend/src/components/dashboard/ShootDetailTabs.tsx`
- **Tabs**: "Details", "Notes", "Media", "Settings"
- **Note**: Grid layout tabs, may not need auto-expanding (different use case)

#### Media Page Tabs
**File**: `repro-frontend/src/pages/Media.tsx`
- **Tabs**: "All", "Photos", "Videos", "Documents"
- **Consideration**: May benefit from auto-expanding on mobile

#### Other Tab Locations (Evaluate Later)
- `repro-frontend/src/components/notifications/NotificationCenter.tsx`
- `repro-frontend/src/pages/Settings.tsx`
- `repro-frontend/src/components/accounts/PermissionsManager.tsx`
- `repro-frontend/src/pages/Reports.tsx`
- Various other components with tabs

## Component Design

### AutoExpandingTabs Component API
```typescript
interface AutoExpandingTab {
  value: string;
  icon: React.ElementType;
  label: string;
  badge?: number | string; // Optional badge/count
}

interface AutoExpandingTabsProps {
  tabs: AutoExpandingTab[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  variant?: 'default' | 'compact';
}
```

### Visual Design
- **Inactive tabs**: 
  - Dark gray/rounded pill shape
  - Icon only (centered)
  - Same height as active tab
  - Smooth hover states
  
- **Active tab**:
  - Primary color background (blue/green/purple based on theme)
  - Icon + text label
  - Expanded width to accommodate label
  - Smooth width transition
  
- **Spacing**:
  - Small gap between tabs (8-12px)
  - Horizontal scroll on mobile if needed (though with icon-only inactive tabs, this should be minimal)

## Implementation Steps

1. ✅ Create `AutoExpandingTabsList` component (`repro-frontend/src/components/ui/auto-expanding-tabs.tsx`)
   - Icon-only inactive tabs
   - Icon + text active tabs
   - Smooth animations with Framer Motion
   - Responsive design
   - Properly wrapped in `TabsPrimitive.List` for Radix UI context

2. ✅ Replace tabs in ShootHistory.tsx
   - Updated to use `AutoExpandingTabsList`
   - Tabs: "Scheduled Shoots", "Completed Shoots", "Hold-On Shoots", "History" (conditional)
   - Maintains all existing functionality

3. ✅ Replace tabs in ShootsFilter.tsx
   - Updated to use `AutoExpandingTabsList`
   - Tabs: "All", "Scheduled", "Completed"
   - Icons: Layers, Calendar, CheckCircle2
   - Uses compact variant for better fit in filter section

4. ✅ Replace tabs in PhotographerShootHistory.tsx
   - Updated to use `AutoExpandingTabsList`
   - Tabs: "Upcoming", "Scheduled", "Completed"
   - Icons: Clock, Calendar, Eye
   - Includes badge counts for each tab

5. ⏳ Test on mobile viewports (Ready for user testing)
6. ✅ Document component usage (Examples provided in plan)
7. ✅ Consider other locations (Documented in plan below)

## Technical Considerations

- Use Framer Motion or CSS transitions for smooth expansion
- Maintain accessibility (ARIA labels, keyboard navigation)
- Ensure touch targets are large enough (min 44x44px)
- Test with various tab counts (3-5 tabs typical)
- Consider RTL languages if needed
- Match existing theme colors

## Example Usage

```tsx
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { AutoExpandingTabsList, type AutoExpandingTab } from '@/components/ui/auto-expanding-tabs'

const tabsConfig: AutoExpandingTab[] = [
  { value: 'scheduled', icon: CalendarIcon, label: 'Scheduled Shoots' },
  { value: 'completed', icon: CheckCircle2, label: 'Completed Shoots' },
  { value: 'hold', icon: PauseCircle, label: 'Hold-On Shoots' },
]

<Tabs value={activeTab} onValueChange={setActiveTab}>
  <AutoExpandingTabsList tabs={tabsConfig} value={activeTab} />
  
  <TabsContent value="scheduled">
    {/* Content */}
  </TabsContent>
</Tabs>
```

## Remaining Locations to Update

### High Priority (Related to Shoot History)

1. **ShootsFilter.tsx** (`repro-frontend/src/components/dashboard/ShootsFilter.tsx`)
   - Current: Scrollable tabs on mobile, grid on desktop
   - Tabs: "All", "Scheduled", "Completed"
   - Need to add icons for each tab
   - Lines: 76-84 (mobile), 90-98 (desktop)

2. **PhotographerShootHistory.tsx** (`repro-frontend/src/pages/PhotographerShootHistory.tsx`)
   - Current: Standard tabs with icons and counts
   - Tabs: "Upcoming", "Scheduled", "Completed"
   - Icons: Calendar, Calendar, Eye
   - Lines: 237-251

### Medium Priority (Evaluate based on mobile usage)

3. **Media.tsx** (`repro-frontend/src/pages/Media.tsx`)
   - Tabs: "All", "Photos", "Videos", "Documents"
   - Could benefit on mobile

4. **ShootDetailTabs.tsx** (`repro-frontend/src/components/dashboard/ShootDetailTabs.tsx`)
   - Tabs: "Details", "Notes", "Media", "Settings"
   - Note: Currently uses grid layout, may not need auto-expanding

### Low Priority (Desktop-focused or different use case)

5. Other tab locations:
   - NotificationCenter.tsx
   - Settings.tsx
   - PermissionsManager.tsx
   - Reports.tsx
   - Various other components

## Component Files Created

- ✅ `repro-frontend/src/components/ui/auto-expanding-tabs.tsx` - Main component

## Files Modified

- ✅ `repro-frontend/src/pages/ShootHistory.tsx` - Updated to use auto-expanding tabs
- ✅ `repro-frontend/src/components/dashboard/ShootsFilter.tsx` - Updated to use auto-expanding tabs
- ✅ `repro-frontend/src/pages/PhotographerShootHistory.tsx` - Updated to use auto-expanding tabs with badges

## Implementation Complete ✅

All high-priority locations have been successfully updated to use the auto-expanding tabs pattern. The component is now ready for testing across different mobile viewports and can be easily applied to other locations as needed.
