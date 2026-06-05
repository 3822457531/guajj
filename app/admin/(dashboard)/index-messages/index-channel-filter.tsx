"use client";

import { useAdminPath } from "@/lib/admin-path-context";
import type { IndexChannelOption } from "@/lib/index-message-admin";

type Props = {
  channels: IndexChannelOption[];
  selectedChatIds: string[];
};

export default function IndexChannelFilter({ channels, selectedChatIds }: Props) {
  const { path } = useAdminPath();

  if (channels.length === 0) {
    return (
      <p className="admin-channel-filter-empty">
        暂无频道。请先在 <a href={path("/telegram")}>TG 机器人</a> 配置源频道并运行采集。
      </p>
    );
  }

  return (
    <fieldset className="admin-channel-filter">
      <legend className="admin-channel-filter-legend">TG 频道（可多选）</legend>
      <div className="admin-channel-filter-list" role="group" aria-label="按频道筛选">
        {channels.map((ch) => {
          const checked = selectedChatIds.includes(ch.chatId);
          return (
            <label key={ch.chatId} className={`admin-channel-filter-item${checked ? " is-checked" : ""}`}>
              <input type="checkbox" name="chat" value={ch.chatId} defaultChecked={checked} />
              <span className="admin-channel-filter-label" title={ch.chatId}>
                {ch.label}
              </span>
              <span className="admin-channel-filter-count">{ch.count}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
