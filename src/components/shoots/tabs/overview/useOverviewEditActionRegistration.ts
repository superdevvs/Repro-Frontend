import { useEffect, useMemo, useRef } from 'react';

type EditActions = { save: () => void; cancel: () => void };

/** Parent registration must not render-loop or retain an older service draft. */
export function useOverviewEditActionRegistration(
  actions: EditActions,
  active: boolean,
  register?: (actions: EditActions) => void,
) {
  const latest = useRef(actions);
  latest.current = actions;
  const registered = useMemo<EditActions>(() => ({
    save: () => latest.current.save(),
    cancel: () => latest.current.cancel(),
  }), []);

  useEffect(() => {
    if (active) register?.(registered);
  }, [active, register, registered]);
}
