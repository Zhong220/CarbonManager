import React, { useState, useEffect, useRef, useMemo } from "react";
import * as S from "./ProductListPage.styles";
import Modal from "@/ui/components/Modal";
import AccountMenu from "@/ui/components/AccountMenu";
import DropdownMenu from "@/ui/components/DropdownMenu";
import CategoryManager from "@/ui/components/CategoryManager";
import CategoryPicker from "@/ui/components/CategoryPicker";
import AllCategoriesModal from "@/ui/components/AllCategoriesModal";
import {
  getCurrentShopId,
  getCurrentShopIdSafe,
  loadProducts,
  saveProducts,
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

  const [products, setProducts] = useState<Product[]>([]);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [openModal, setOpenModal] = useState<null | "new" | "edit">(null);
  const [catManagerOpen, setCatManagerOpen] = useState(false);
  const [allCatsOpen, setAllCatsOpen] = useState(false);

  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const btnRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // 分類篩選
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Consumer：載入所有茶行供選擇（初次與回到前景都刷新）
useEffect(() => {
  if (!isConsumer) return;

  const loadShops = () => {
    const shops = listBrowsableShops();
    setAllShops(shops);
    // 當前沒選或選項已不存在 → 改選第一個
    if (!viewShopId || !shops.some((s) => s.id === viewShopId)) {
      setViewShopId(shops[0]?.id ?? null);
    }
  };

  loadShops(); // 進入頁面先載一次

  // 視窗回到前景或可見時再刷新一次（同分頁也會更新）
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
}, [isConsumer]); // 角色變成 Consumer 時會跑一次

  // 載入商品 + 分類
  useEffect(() => {
    if (!workingShopId) return;
    setProducts(loadProducts(workingShopId));
    setCats(loadCategories(workingShopId).sort((a, b) => a.order - b.order));
    setRecentIds(getRecentCategoryIds(workingShopId));
  }, [workingShopId]);

  function refresh() {
    setProducts(loadProducts(workingShopId));
    setCats(loadCategories(workingShopId).sort((a, b) => a.order - b.order));
    setRecentIds(getRecentCategoryIds(workingShopId));
  }

  // CRUD（Consumer 禁用）
  function handleAdd() {
    if (isConsumer) return;
    if (!newName.trim()) return;

    const maxId = products.reduce((m, p) => {
      const n = parseInt(String(p.id), 10);
      return Number.isFinite(n) ? Math.max(m, n) : m;
    }, 0);
    const newId = maxId + 1;
    const newProduct: Product = {
      id: newId,
      name: newName.trim(),
      categoryId: null,
    };
    saveProducts([...products, newProduct], workingShopId);
    refresh();
    setNewName("");
    setOpenModal(null);
  }

  function handleDelete(pid: number) {
    if (isConsumer) return;
    deleteProduct(workingShopId, pid);
    refresh();
  }

  function handleDuplicate(pid: number) {
    if (isConsumer) return;
    duplicateProduct(workingShopId, pid);
    refresh();
  }

  function handleRename() {
    if (isConsumer) return;
    if (editId === null) return;
    renameProduct(workingShopId, editId, editName.trim());
    refresh();
    setOpenModal(null);
  }

  // 分類點選（Consumer 也可篩選，但不記錄最近）
  function applyCategory(catId: string | "__unassigned__" | null) {
    setActiveCat(catId);
    if (!isConsumer && catId && catId !== "__unassigned__") {
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

  // 最近分類（最多 4 個；Consumer 仍可用來篩選）
  const recentCats = useMemo(() => {
    const map = new Map(cats.map((c) => [c.id, c]));
    const fromRecent = recentIds
      .map((id) => map.get(id))
      .filter(Boolean) as Category[];
    const list = fromRecent.length ? fromRecent : cats;
    return list.slice(0, 4);
  }, [cats, recentIds]);

  // 卡片點擊（選單展開時不導航）
  function handleCardClick(e: React.MouseEvent, pid: number) {
    if (menuOpen === pid) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    // Consumer：把 shop 帶進 query，讓生命週期頁用該茶行資料
    if (isConsumer) {
      navigate(
        `/products/${pid}/lifecycle?shop=${encodeURIComponent(workingShopId)}`
      );
    } else {
      navigate(`/products/${pid}/lifecycle`);
    }
  }

  // ---- UI ----
  return (
    <S.PageWrapper>
      {/* 頂部工具列 */}
      <S.TopBar>
        <h2>商品列表</h2>
        <div className="actions">
          {!isConsumer && (
            <S.SecondaryBtn onClick={() => setCatManagerOpen(true)}>
              分類管理
            </S.SecondaryBtn>
          )}
          <AccountMenu />
        </div>
      </S.TopBar>

      {/* 顯示帳號（角色） */}
      <S.Hint>
        已登入：{account ?? "（未登入）"}（{role}）
        {!currentShopId && !isConsumer}
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

      {/* 分類列 */}
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          margin: "8px 12px 4px",
          alignItems: "center",
        }}
      >
        <FilterChip
          isActive={activeCat === null}
          onClick={() => applyCategory(null)}
        >
          全部（{products.length}）
        </FilterChip>
        <FilterChip
          isActive={activeCat === "__unassigned__"}
          onClick={() => applyCategory("__unassigned__")}
        >
          未分類（{counts["__unassigned__"] || 0}）
        </FilterChip>

        {recentCats.map((c) => (
          <FilterChip
            key={c.id}
            isActive={activeCat === c.id}
            onClick={() => applyCategory(c.id)}
          >
            {c.name}（{counts[c.id] || 0}）
          </FilterChip>
        ))}

        {!isConsumer && (
          <button
            onClick={() => setAllCatsOpen(true)}
            style={{
              marginLeft: "auto",
              border: "1px solid #ccd6cc",
              background: "#fff",
              color: "#2c3e2c",
              padding: "6px 10px",
              borderRadius: 999,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            全部分類…
          </button>
        )}
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
              role="button"
              tabIndex={0}
            >
              <S.Thumb />
              <S.ProductInfo>
                <S.ProductName>{p.name}</S.ProductName>
                <S.ProductMeta>
                  商品編號 #{p.id}
                  {p.categoryId ? "" : "｜未分類"}
                </S.ProductMeta>
              </S.ProductInfo>

              {/* 只有 Farmer 才有編輯選單 */}
              {!isConsumer && (
                <>
                  <S.MenuWrapper
                    ref={(el) => (btnRefs.current[p.id] = el)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === p.id ? null : p.id);
                    }}
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

                    {/* 移至分類：在 Dropdown 內嵌入 CategoryPicker */}
                    <li
                      style={{ padding: 0 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <div style={{ padding: "6px 12px", opacity: 0.7 }}>
                        移至分類
                      </div>
                      <div style={{ borderTop: "1px solid #eee" }}>
                        <CategoryPicker
                          productId={p.id}
                          currentCategoryId={p.categoryId ?? null}
                          onPicked={() => {
                            setMenuOpen(null);
                            refresh();
                          }}
                        />
                      </div>
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

      {/* 新增商品 FAB（Consumer 隱藏） */}
      {!isConsumer && <S.Fab onClick={() => setOpenModal("new")}>＋</S.Fab>}

      {/* Modal：新增（Consumer 隱藏） */}
      <Modal
        open={!isConsumer && openModal === "new"}
        onClose={() => setOpenModal(null)}
        ariaLabel="新增商品"
      >
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

      {/* Modal：修改（Consumer 隱藏） */}
      <Modal
        open={!isConsumer && openModal === "edit"}
        onClose={() => setOpenModal(null)}
        ariaLabel="修改商品"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRename();
          }}
        >
          <h3>修改商品</h3>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <div className="modal-actions">
            <S.SecondaryBtn type="button" onClick={() => setOpenModal(null)}>
              取消
            </S.SecondaryBtn>
            <S.PrimaryBtn type="submit">儲存</S.PrimaryBtn>
          </div>
        </form>
      </Modal>

      {/* Modal：分類管理（Consumer 隱藏） */}
      {!isConsumer && (
        <CategoryManager
          open={catManagerOpen}
          onClose={() => {
            setCatManagerOpen(false);
            refresh();
          }}
        />
      )}

      {/* Modal：全部分類（Consumer 隱藏） */}
      {!isConsumer && (
        <AllCategoriesModal
          open={allCatsOpen}
          onClose={() => setAllCatsOpen(false)}
          cats={cats}
          counts={{ ...counts }}
          onPick={(id) => applyCategory(id)}
        />
      )}
    </S.PageWrapper>
  );
}

/** 小型樣式：分類篩選 chip（避免把 boolean prop 寫進 DOM） */
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
