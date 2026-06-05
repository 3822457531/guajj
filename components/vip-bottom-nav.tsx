import { H5SiteBottomNav } from "@/components/h5-site-bottom-nav";

export function VipBottomNav({ active }: { active: "home" | "vip" }) {
  return <H5SiteBottomNav active={active} variant="dark" />;
}
