import type { ComponentProps } from "react";

/**
 * 后台专用链接：使用原生 <a> 整页跳转，避免 Next 软导航落到内部 /admin 并暴露在地址栏。
 */
export default function AdminLink({ href, children, ...rest }: ComponentProps<"a">) {
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
