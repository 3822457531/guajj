/** 支付宝 / 微信支付品牌色图标 */

type IconProps = {
  className?: string;
};

/** 支付宝：蓝底「支」 */
export function AlipayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden focusable="false">
      <rect width="48" height="48" rx="10" fill="#1677FF" />
      <text
        x="24"
        y="32"
        textAnchor="middle"
        fill="#fff"
        fontSize="22"
        fontWeight="700"
        fontFamily="'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Noto Sans SC',sans-serif"
      >
        支
      </text>
    </svg>
  );
}

/** 微信：绿底双气泡 */
export function WechatPayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden focusable="false">
      <rect width="48" height="48" rx="10" fill="#07C160" />
      <path
        fill="#fff"
        d="M19.1 13.5c-6.05 0-10.95 4.15-10.95 9.25 0 2.8 1.6 5.25 4.1 6.9.2.15.3.4.25.65l-.45 1.7c-.05.2.1.4.3.4.05 0 .15 0 .2-.05l2.35-1.35c.2-.1.45-.15.65-.05 1 .3 2.05.45 3.15.45.35 0 .7-.05 1.05-.1-.25-1-.35-2.05-.15-3.15.85-4 4.65-6.95 9.15-6.95.35 0 .7.05 1.05.1C28.5 16.5 24.2 13.5 19.1 13.5zm-3.55 6.7c-.7 0-1.3-.6-1.3-1.3s.6-1.3 1.3-1.3 1.3.6 1.3 1.3-.6 1.3-1.3 1.3zm7.2 0c-.7 0-1.3-.6-1.3-1.3s.6-1.3 1.3-1.3 1.3.6 1.3 1.3-.6 1.3-1.3 1.3z"
      />
      <path
        fill="#fff"
        d="M37.55 29.15c0-4.2-4.15-7.55-9.25-7.55s-9.25 3.35-9.25 7.55 4.15 7.55 9.25 7.55c.95 0 1.85-.1 2.7-.35.15-.05.35 0 .5.1l1.95 1.15c.1.05.25.05.35 0 .2-.1.25-.3.2-.45l-.35-1.4c-.05-.2 0-.4.15-.55 2.15-1.4 3.75-3.55 3.75-6.05zm-12.2-1.15c-.6 0-1.05-.45-1.05-1.05s.45-1.05 1.05-1.05 1.05.45 1.05 1.05-.45 1.05-1.05 1.05zm5.95 0c-.6 0-1.05-.45-1.05-1.05s.45-1.05 1.05-1.05 1.05.45 1.05 1.05-.45 1.05-1.05 1.05z"
      />
    </svg>
  );
}

export function PayChannelIcon({
  kind,
  className
}: {
  kind: "alipay" | "wechat";
  className?: string;
}) {
  if (kind === "alipay") return <AlipayIcon className={className} />;
  return <WechatPayIcon className={className} />;
}
