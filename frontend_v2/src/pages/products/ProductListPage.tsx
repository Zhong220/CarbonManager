// src/pages/ProductListPage.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import * as S from "./ProductListPage.styles";
import Modal from "@/ui/components/Modal";
import AccountMenu from "@/ui/components/AccountMenu";
import DropdownMenu from "@/ui/components/DropdownMenu";
import CategoryPanel from "@/ui/components/CategoryPanel";
import { WhiteButton } from "@/ui/primitives/Button";

import {
  getCurrentShopId,
  getCurrentShopIdSafe,
  loadProducts,
  Product,
  deleteProduct,
  duplicateProduct,
  renameProduct,
  loadCategories,
  pushRecentCategoryId,
  getRecentCategoryIds,
  Category,
  listBrowsableShops,
  TeaShop,
  DEFAULT_SHOP_ID,
  addProduct,
  // 🔽 新增：判斷店主用
  getShopsMap,
  getAccount,
} from "@/utils/storage";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext";

export default function ProductListPage() {
  const { account, role } = useUser();
  const isConsumer = role === "Consumer";
  const navigate = useNavigate();

  // Farmer：使用自己當前/安全 shopId
  const safeShopId = getCurrentShopIdSafe();
  const currentShopId = getCurrentShopId();

  // Consumer：可選擇要檢視的茶行
  const [allShops, setAllShops] = useState<TeaShop[]>([]);
  const [viewShopId, setViewShopId] = useState<string | null>(null);

  // 真正用來讀資料的 shopId（Consumer 只讀；Farmer 可寫）
  const workingShopId = isConsumer ? viewShopId ?? DEFAULT_SHOP_ID : safeShopId;

  // === 純前端權限：只有店主 + Farmer 可編輯 ===
  const shopsMap = useMemo(() => getShopsMap(), []);
  const myAccount = useMemo(() => getAccount(), []);
  const isOwner =
    !isConsumer &&
    !!workingShopId &&
    !!myAccount &&
    role === "Farmer" &&
    shopsMap[workingShopId]?.owner === myAccount;

  const canEdit = isOwner;
  const readOnly = !canEdit;

  const [products, setProducts] = useState<Product[]>([]);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [openModal, setOpenModal] = useState<null | "new" | "edit">(null);

  // ✅ 統一入口：分類面板（全局管理/檢視用）
  const [catPanelOpen, setCatPanelOpen] = useState(false);
  // ✅ 針對某商品開面板來「移至分類」
  const [moveTarget, setMoveTarget] = useState<null | { pid: string; catId: string | null }>(null);

  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const btnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // 分類篩選
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Consumer：載入所有茶行供選擇
  useEffect(() => {
    if (!isConsumer) return;

    const loadShops = () => {
      const shops = listBrowsableShops();
      setAllShops(shops);
      if (!viewShopId || !shops.some((s) => s.id === viewShopId)) {
        setViewShopId(shops[0]?.id ?? null);
      }
    };

    loadShops();
    const onFocus = () => loadShops();
    const onVisible = () => {
      if (document.visibilityState === "visible") loadShops();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConsumer]);

  // 載入商品 + 分類
  useEffect(() => {
    if (!workingShopId) {
      setProducts([]);
      setCats([]);
      setRecentIds([]);
      return;
    }
    setProducts(loadProducts(workingShopId));
    setCats(loadCategories(workingShopId).sort((a, b) => a.order - b.order));
    setRecentIds(getRecentCategoryIds(workingShopId));
  }, [workingShopId]);

  function refresh() {
    if (!workingShopId) return;
    setProducts(loadProducts(workingShopId));
    setCats(loadCategories(workingShopId).sort((a, b) => a.order - b.order));
    setRecentIds(getRecentCategoryIds(workingShopId));
  }

  // CRUD（readOnly 禁用）
  function handleAdd() {
    if (readOnly || !workingShopId) return;
    if (!newName.trim()) return;
    addProduct(workingShopId, newName.trim(), null);
    refresh();
    setNewName("");
    setOpenModal(null);
  }

  function handleDelete(pid: string) {
    if (readOnly || !workingShopId) return;
    deleteProduct(workingShopId, pid);
    refresh();
  }

  function handleDuplicate(pid: string) {
    if (readOnly || !workingShopId) return;
    duplicateProduct(workingShopId, pid);
    refresh();
  }

  function handleRename() {
    if (readOnly || !workingShopId) return;
    if (!editId) return;
    const name = editName.trim();
    if (!name) return;
    renameProduct(workingShopId, editId, name);
    refresh();
    setOpenModal(null);
  }

  // 分類點選（只在可寫時記錄最近）
  function applyCategory(catId: string | "__unassigned__" | null) {
    setActiveCat(catId);
    if (!readOnly && catId && catId !== "__unassigned__" && workingShopId) {
      pushRecentCategoryId(catId, workingShopId);
      setRecentIds(getRecentCategoryIds(workingShopId));
    }
  }

  // 篩選商品
  const filtered = useMemo(() => {
    if (activeCat === null) return products;
    if (activeCat === "__unassigned__") {
      return products.filter((p) => !p.categoryId);
    }
    return products.filter((p) => p.categoryId === activeCat);
  }, [products, activeCat]);

  // 各分類商品數
  const counts = useMemo(() => {
    const cnt: Record<string, number> = {};
    products.forEach((p) => {
      const key = p.categoryId ?? "__unassigned__";
      cnt[key] = (cnt[key] || 0) + 1;
    });
    return cnt;
  }, [products]);

  // 最近分類（最多 4 個）
  const recentCats = useMemo(() => {
    const map = new Map(cats.map((c) => [c.id, c]));
    const fromRecent = recentIds.map((id) => map.get(id)).filter(Boolean) as Category[];
    const list = fromRecent.length ? fromRecent : cats;
    return list.slice(0, 4);
  }, [cats, recentIds]);

  // 卡片點擊（選單展開時不導航）
  function handleCardClick(e: React.MouseEvent, pid: string) {
    if (menuOpen === pid) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (isConsumer) {
      navigate(
        `/products/${encodeURIComponent(pid)}/lifecycle?shop=${encodeURIComponent(
          workingShopId || ""
        )}`
      );
    } else {
      // Farmer：一律導到自己的 lifecycle（不帶 shop；權限在頁內再檢查）
      navigate(`/products/${encodeURIComponent(pid)}/lifecycle`);
    }
  }

  // 鍵盤可達性：Enter / Space 也可開啟
  function handleCardKeyDown(e: React.KeyboardEvent, pid: string) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(e as unknown as React.MouseEvent, pid);
    }
  }

  return (
    <S.PageWrapper>
      {/* 頂部工具列 */}
      <S.TopBar>
        <h2>商品列表</h2>
        <div className="actions">
          {!readOnly && (
            <WhiteButton onClick={() => setCatPanelOpen(true)}>分類管理</WhiteButton>
          )}
          <AccountMenu />
        </div>
      </S.TopBar>

      {/* 顯示帳號（角色） */}
      <S.Hint>
        已登入：{account ?? "（未登入）"}（{role}）
        {!isConsumer && !currentShopId ? "｜尚未選擇商家" : ""}
        {readOnly ? "｜檢視模式" : ""}
      </S.Hint>

      {/* Consumer：選擇茶行 */}
      {isConsumer && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            margin: "0 12px 8px",
          }}
        >
          <label style={{ color: "#2c3e2c" }}>選擇茶行：</label>
          <select
            value={viewShopId ?? ""}
            onChange={(e) => setViewShopId(e.target.value || null)}
            style={{
              height: 36,
              padding: "0 10px",
              border: "1px solid #ccd6cc",
              borderRadius: 8,
              background: "#fff",
              color: "#2c3e2c",
            }}
          >
            {allShops.length === 0 ? (
              <option value="">（目前沒有可瀏覽的茶行）</option>
            ) : (
              allShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* 分類列（快速篩選） */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          margin: "8px 12px 4px",
          alignItems: "center",
        }}
      >
        <FilterChip isActive={activeCat === null} onClick={() => applyCategory(null)}>
          全部（{products.length}）
        </FilterChip>
        <FilterChip
          isActive={activeCat === "__unassigned__"}
          onClick={() => applyCategory("__unassigned__")}
        >
          未分類（{counts["__unassigned__"] || 0}）
        </FilterChip>

        {recentCats.map((c) => (
          <FilterChip key={c.id} isActive={activeCat === c.id} onClick={() => applyCategory(c.id)}>
            {c.name}（{counts[c.id] || 0}）
          </FilterChip>
        ))}
      </div>

      {/* 商品列表 */}
      <S.List>
        {filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "#888" }}>
            {isConsumer
              ? allShops.length === 0
                ? "目前沒有可瀏覽的茶行"
                : "此茶行目前沒有商品"
              : "此分類尚無商品"}
          </p>
        ) : (
          filtered.map((p) => (
            <S.ProductCard
              key={p.id}
              onClick={(e) => handleCardClick(e, p.id)}
              onKeyDown={(e) => handleCardKeyDown(e, p.id)}
              role="button"
              tabIndex={0}
              aria-label={`商品：${p.name}`}
            >
              <S.Thumb />
              <S.ProductInfo>
                <S.ProductName>{p.name}</S.ProductName>
                <S.ProductMeta>
                  商品編號 #{p.serialNo ?? "—"}
                  {p.categoryId ? "" : "｜未分類"}
                </S.ProductMeta>
              </S.ProductInfo>

              {/* 只有可編輯時才顯示選單（Farmer + 店主） */}
              {!readOnly && (
                <>
                  <S.MenuWrapper
                    ref={(el) => (btnRefs.current[p.id] = el)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === p.id ? null : p.id);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen === p.id}
                    aria-label="更多操作"
                  >
                    ⋮
                  </S.MenuWrapper>

                  <DropdownMenu
                    anchorRef={{ current: btnRefs.current[p.id] }}
                    open={menuOpen === p.id}
                    onClose={() => setMenuOpen(null)}
                  >
                    <li
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditId(p.id);
                        setEditName(p.name);
                        setOpenModal("edit");
                        setMenuOpen(null);
                      }}
                    >
                      編輯名稱
                    </li>

                    {/* ✅ 打開同一個 CategoryPanel 進行「移至分類」 */}
                    <li
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setMoveTarget({
                          pid: p.id,
                          catId: p.categoryId ?? null,
                        });
                        setMenuOpen(null);
                      }}
                    >
                      移至分類…
                    </li>

                    <li
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDuplicate(p.id);
                        setMenuOpen(null);
                      }}
                    >
                      複製
                    </li>
                    <li
                      className="danger"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(p.id);
                        setMenuOpen(null);
                      }}
                    >
                      刪除
                    </li>
                  </DropdownMenu>
                </>
              )}
            </S.ProductCard>
          ))
        )}
      </S.List>

      {/* 新增商品 FAB（只有可編輯時顯示） */}
      {!readOnly && <S.Fab onClick={() => setOpenModal("new")}>＋</S.Fab>}

      {/* Modal：新增 */}
      <Modal open={!readOnly && openModal === "new"} onClose={() => setOpenModal(null)} ariaLabel="新增商品">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <h3>新增商品</h3>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="輸入商品名稱"
            required
          />
          <div className="modal-actions">
            <S.SecondaryBtn type="button" onClick={() => setOpenModal(null)}>
              取消
            </S.SecondaryBtn>
            <S.PrimaryBtn type="submit">新增</S.PrimaryBtn>
          </div>
        </form>
      </Modal>

      {/* Modal：修改 */}
      <Modal open={!readOnly && openModal === "edit"} onClose={() => setOpenModal(null)} ariaLabel="修改商品">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRename();
          }}
        >
          <h3>修改商品</h3>
          <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <div className="modal-actions">
            <S.SecondaryBtn type="button" onClick={() => setOpenModal(null)}>
              取消
            </S.SecondaryBtn>
            <S.PrimaryBtn type="submit">儲存</S.PrimaryBtn>
          </div>
        </form>
      </Modal>

      {/* ✅ 統一入口面板（全局模式） */}
      {!readOnly && (
        <CategoryPanel
          open={catPanelOpen}
          onClose={() => {
            setCatPanelOpen(false);
            refresh();
          }}
        />
      )}

      {/* ✅ 同一個面板（商品指派模式） */}
      {!readOnly && (
        <CategoryPanel
          open={!!moveTarget}
          onClose={() => setMoveTarget(null)}
          // 若 CategoryPanel 還是 number，先用 any 避免 TS 卡住；建議把它改成 string | number
          productId={(moveTarget?.pid as unknown) as any}
          currentCategoryId={moveTarget?.catId ?? null}
          onPicked={() => {
            refresh();
            setMoveTarget(null);
          }}
        />
      )}
      {/* ⛔ 已移除 AllCategoriesModal */}
    </S.PageWrapper>
  );
}

/** 小型樣式：分類篩選 chip */
function FilterChip({
  isActive,
  children,
  onClick,
}: {
  isActive?: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  const border = isActive ? "#4caf50" : "#ccd6cc";
  const bg = isActive ? "rgba(76,175,80,.08)" : "#fff";
  const color = isActive ? "#2e7d32" : "#2c3e2c";

  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${border}`,
        background: bg,
        color,
        padding: "6px 10px",
        borderRadius: 999,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
