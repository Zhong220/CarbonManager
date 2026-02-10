import { useMemo } from "react";
import { getAccount, getRole, getCurrentShopId, getShopsMap } from "@/utils/storage";

export type Perm = {
  account: string;
  role: "Farmer" | "Consumer" | "None";
  shopId: string | null;
  isOwner: boolean;
  canRead: boolean;
  canEdit: boolean;
};

export function usePermissions(targetShopId?: string): Perm {
  const account = getAccount();
  const role = getRole();
  const activeShopId = targetShopId ?? getCurrentShopId() ?? null;
  const shops = getShopsMap();
  const owner = activeShopId ? shops[activeShopId]?.owner : null;

  return useMemo(() => {
    const isOwner = !!(owner && account && owner === account && role === "Farmer");
    const canRead =
      role === "Consumer" ||
      isOwner ||
      (activeShopId === "__default_shop__" && role !== "None");

    const canEdit = isOwner; // 只有店主可編輯
    return { account, role, shopId: activeShopId, isOwner, canRead, canEdit };
  }, [account, role, activeShopId, owner]);
}
