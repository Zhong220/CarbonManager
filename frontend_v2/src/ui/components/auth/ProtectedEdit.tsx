import React from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";

type Props = {
  shopId?: string;
  fallback?: string;
  children: React.ReactNode;
  renderReadOnly?: () => React.ReactNode;
};

export default function ProtectedEdit({
  shopId,
  fallback = "/products",
  children,
  renderReadOnly,
}: Props) {
  const nav = useNavigate();
  const perm = usePermissions(shopId);

  if (!perm.canRead) {
    nav(fallback);
    return null;
  }
  if (!perm.canEdit) {
    return renderReadOnly ? <>{renderReadOnly()}</> : (nav(fallback), null);
  }
  return <>{children}</>;
}
