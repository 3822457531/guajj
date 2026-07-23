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

/** 热搜：上升热度柱 + 尖角，偏「热搜榜」 */
export function TabIconHot({ active }: TabIconProps) {
  const w = stroke(active);
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5.5 18.5V12.5M10.5 18.5V8.5M15.5 18.5V5.5"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap="round"
      />
      <path
        d="M13.2 5.2 15.5 3l2.3 2.2"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M4.5 19.5h13"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap="round"
        opacity={active ? 0.55 : 0.4}
      />
    </svg>
  );
}

/** 全网搜：放大镜内嵌地球经纬，偏「搜全网」 */
export function TabIconGlobal({ active }: TabIconProps) {
  const w = stroke(active);
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.25" cy="10.25" r="6.25" stroke="currentColor" strokeWidth={w} />
      <path
        d="M4.2 10.25h12.1M10.25 4.2c1.55 1.9 2.4 4 2.4 6.05s-.85 4.15-2.4 6.05M10.25 4.2C8.7 6.1 7.85 8.2 7.85 10.25s.85 4.15 2.4 6.05"
        stroke="currentColor"
        strokeWidth={w * 0.92}
        strokeLinecap="round"
        opacity={active ? 0.9 : 0.72}
      />
      <path
        d="m15.1 15.1 4.6 4.6"
        stroke="currentColor"
        strokeWidth={w}
        strokeLinecap="round"
      />
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
