type TabIconProps = {
  active?: boolean;
};

const stroke = (active?: boolean) => (active ? 2.1 : 1.75);

export function TabIconHome({ active }: TabIconProps) {
  const w = stroke(active);
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 10.2 12 4.5l7.5 5.7V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9V20.5H6A1.5 1.5 0 0 1 4.5 19v-8.8Z"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TabIconHot({ active }: TabIconProps) {
  const w = stroke(active);
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21c4.5-2.8 7-6.2 7-10.2C19 6.8 16.2 4 12.5 4c-.8 0-1.5.1-2.2.4C8.8 2.8 7 2 5 2c0 5.5 2.2 8.5 5.5 11.2-.8 1.2-1.2 2.5-1.5 3.8 2.2-.5 4.2-1.5 6-3 1.2 1.8 2.5 3 4 3.8Z"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinejoin="round"
      />
      <path
        d="M12 21V11"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap="round"
        opacity={active ? 0.5 : 0.35}
      />
    </svg>
  );
}

export function TabIconGlobal({ active }: TabIconProps) {
  const w = stroke(active);
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={w} />
      <path
        d="M3.5 12h17M12 3.5c2.2 2.8 3.5 6 3.5 8.5S14.2 17.7 12 20.5M12 3.5C9.8 6.3 8.5 9.5 8.5 12s1.3 5.7 3.5 8.5"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function TabIconMy({ active }: TabIconProps) {
  const w = stroke(active);
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={w} opacity={active ? 1 : 0.85} />
      <circle cx="12" cy="9.25" r="2.75" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth={w} />
      <path
        d="M7.25 17.75c.85-2.35 2.65-3.75 4.75-3.75s3.9 1.4 4.75 3.75"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap="round"
        fill={active ? "currentColor" : "none"}
        fillOpacity={active ? 0.18 : 0}
      />
    </svg>
  );
}
