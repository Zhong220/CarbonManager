import React from "react";
import { usePermissions } from "@/hooks/usePermissions";

export default function PermissionBanner({ shopId }: { shopId?: string }) {
  const perm = usePermissions(shopId);
  if (perm.canEdit) return null;
  return (
    <div className="rounded-md border p-2 text-sm">
      目前為 <b style={{margin: "0 4px"}}>{perm.role}</b>
      模式，{perm.isOwner ? "您可編輯此茶行。" : "僅可瀏覽此茶行資料。"}
    </div>
  );
}
