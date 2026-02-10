import React from "react";
import { usePermissions } from "@/hooks/usePermissions";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  shopId?: string;
  hideWhenNoEdit?: boolean;
  reasonWhenDisabled?: string;
};

export default function GuardedAction({
  shopId,
  hideWhenNoEdit = false,
  reasonWhenDisabled = "沒有編輯權限",
  children,
  ...btnProps
}: Props) {
  const perm = usePermissions(shopId);
  if (!perm.canEdit) {
    if (hideWhenNoEdit) return null;
    return (
      <button {...btnProps} disabled title={reasonWhenDisabled}>
        {children}
      </button>
    );
  }
  return <button {...btnProps}>{children}</button>;
}
