// src/pages/products/ProductListPage.tsx
import React, { useState, useEffect, useRef } from "react";
import * as S from "./ProductListPage.styles";
import Modal from "@/ui/components/Modal";
import AccountMenu from "@/ui/components/AccountMenu";
import DropdownMenu from "@/ui/components/DropdownMenu";
import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/context/UserContext";

import {
  apiListProducts,
  apiCreateProduct,
  apiDeleteProduct,
  apiUpdateProduct,
  apiGetProduct,
  UIProduct,
} from "@/api/products";

import {
  apiGetOrCreateDefaultType,
  apiListProductTypes,
  apiCreateProductType,
  ProductType,
} from "@/api/productTypes";

function mapRole(userType?: "shop" | "customer" | null) {
  if (userType === "shop") return "Farmer";
  if (userType === "customer") return "Consumer";
  return "None";
}

function pickTypeId(created: any): number | null {
  const id =
    created?.id ?? created?.product_type?.id ?? created?.data?.id ?? null;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function ensureArray<T>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && Array.isArray(v.items)) return v.items as T[];
  if (v && Array.isArray(v.data)) return v.data as T[];
  if (v && Array.isArray(v.list)) return v.list as T[];
  return [];
}

type TidLike = number | "__all" | null;

export default function ProductListPage() {
  const { user, isAuthed } = useUser();
  const account = user?.account ?? null;
  const role = mapRole(user?.user_type);
  const canEdit = role === "Farmer" && isAuthed;
  const readOnly = !canEdit;

  const navigate = useNavigate();
  const params = useParams();

  // ---------- 類型清單 & 目前篩選 ----------
  const [typeOptions, setTypeOptions] = useState<ProductType[]>([]);
  const [resolvedTid, setResolvedTid] = useState<TidLike>("__all"); // 預設顯示「所有商品」
  const loadingTypesRef = useRef(false);

  // ✅ 進頁面先把不合法網址導回 /products/__all
  useEffect(() => {
    const urlTid = params.typeId;
    const n = Number(urlTid);
    const looksNumber = Number.isFinite(n) && n > 0;
    if (urlTid !== "__all" && !looksNumber) {
      navigate("/products/__all", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 先載入「類型清單」，若為空且可編輯 → 自動補建 Default，再決定 tid
  useEffect(() => {
    let cancelled = false;
    if (loadingTypesRef.current) return;
    loadingTypesRef.current = true;

    (async () => {
      try {
        let list = ensureArray<ProductType>(await apiListProductTypes());
        if (list.length === 0 && canEdit) {
          try {
            await apiGetOrCreateDefaultType();
            list = ensureArray<ProductType>(await apiListProductTypes());
          } catch {
            /* 可能已存在或權限受限，忽略 */
          }
        }
        if (!cancelled) setTypeOptions(list);

        const urlTid = params.typeId;

        // 1) URL 指定 __all → 直接採用
        if (urlTid === "__all") {
          if (!cancelled) setResolvedTid("__all");
          return;
        }

        // 2) URL 指定數字且存在於清單 → 採用該 tid
        const urlTidNum = Number(urlTid);
        if (
          Number.isFinite(urlTidNum) &&
          urlTidNum > 0 &&
          list.some((t) => t.id === urlTidNum)
        ) {
          if (!cancelled) setResolvedTid(urlTidNum);
          return;
        }

        // 3) 其他 → 導到「所有商品」
        if (!cancelled) {
          setResolvedTid("__all");
          if (urlTid !== "__all") {
            navigate("/products/__all", { replace: true });
          }
        }
      } catch (err) {
        console.error("[ProductList] load types failed:", err);
        if (!cancelled) {
          setTypeOptions([]);
          setResolvedTid("__all");
          if (params.typeId !== "__all") {
            navigate("/products/__all", { replace: true });
          }
        }
      } finally {
        loadingTypesRef.current = false;
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.typeId, canEdit, navigate]);

  const tid = resolvedTid;

  // ---------- 建立商品用的「類型」選擇 ----------
  const [selectedType, setSelectedType] = useState<number | "__new" | null>(null);
  const [newTypeName, setNewTypeName] = useState("");

  useEffect(() => {
    if (!canEdit) return;
    if (typeof tid === "number" && typeOptions.some((t) => t.id === tid)) {
      setSelectedType(tid);
    } else if (typeOptions.length) {
      setSelectedType(typeOptions[0].id);
    } else {
      setSelectedType("__new");
    }
  }, [tid, canEdit, typeOptions]);

  // ---------- 商品清單 ----------
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // __all 聚合抓取（加入「類型為空 → 補建 Default → 重抓」的後備）
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);

      try {
        if (tid === "__all") {
          let types = typeOptions;

          // 類型仍為空 → 後備：嘗試補建 Default 再重抓一次
          if (types.length === 0 && canEdit) {
            try {
              await apiGetOrCreateDefaultType();
              types = ensureArray<ProductType>(await apiListProductTypes());
              if (!cancelled) setTypeOptions(types);
            } catch {
              /* 忽略 */
            }
          }

          if (types.length === 0) {
            if (!cancelled) setProducts([]);
            return;
          }

          const chunks = await Promise.all(types.map((t) => apiListProducts(t.id)));
          const all = chunks.flat();
          if (!cancelled) setProducts(all);
          return;
        }

        // 指定單一類型
        if (typeof tid === "number" && tid > 0) {
          const list = await apiListProducts(tid);
          if (!cancelled) setProducts(list);
          return;
        }

        if (!cancelled) setProducts([]);
      } catch (e) {
        console.error("[ProductList] list products failed:", e);
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tid, typeOptions, canEdit]);

  function refresh(tidOverride?: TidLike) {
    const target = tidOverride ?? tid;
    if (!target) return;
    setLoading(true);

    if (target === "__all") {
      if (typeOptions.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }
      Promise.all(typeOptions.map((t) => apiListProducts(t.id)))
        .then((chunks) => setProducts(chunks.flat()))
        .finally(() => setLoading(false));
      return;
    }

    apiListProducts(target as number)
      .then(setProducts)
      .finally(() => setLoading(false));
  }

  async function ensureTypeIdToUse(): Promise<number> {
    if (selectedType === "__new") {
      const name = (newTypeName || "").trim();
      if (!name) throw new Error("請輸入新的類型名稱");
      const created = await apiCreateProductType({ name });
      const newId = pickTypeId(created);
      if (!newId) throw new Error("建立類型失敗");

      const list = ensureArray<ProductType>(await apiListProductTypes());
      setTypeOptions(list);
      setSelectedType(newId);

      if (tid !== newId) {
        setResolvedTid(newId);
        navigate(`/products/${newId}`, { replace: true });
      }
      return newId;
    }
    if (!selectedType && typeof tid === "number") return tid;
    if (typeof selectedType === "number") return selectedType;
    if (typeof tid === "number") return tid;
    throw new Error("尚未選擇產品類型");
  }

  // ---------- CRUD handlers ----------
  const [openModal, setOpenModal] = useState<null | "new" | "edit">(null);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const btnRefs = useRef<Record<number, HTMLDivElement | null>>({});

  async function handleAdd() {
    if (readOnly) return;
    const name = newName.trim();
    if (!name) return;

    try {
      const useTid = await ensureTypeIdToUse();
      await apiCreateProduct(useTid, { name });

      setOpenModal(null);
      setNewName("");
      setNewTypeName("");

      if (tid !== useTid) {
        setResolvedTid(useTid);
        navigate(`/products/${useTid}`, { replace: true });
      }
      refresh(useTid);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (
        msg.includes("1452") ||
        /foreign key/i.test(msg) ||
        /not.*found/i.test(msg)
      ) {
        alert("新增失敗：產品類型不存在或不屬於你的組織。");
      } else if (msg.includes("409") || /duplicate/i.test(msg)) {
        alert("新增失敗：名稱或編號重複，請換一個名稱再試。");
      } else {
        alert("新增失敗：" + msg);
      }
    }
  }

  async function handleDelete(id: number) {
    if (readOnly || typeof tid !== "number") return;
    try {
      await apiDeleteProduct(tid, id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      alert("刪除失敗：" + (err?.message || err));
    }
  }

  async function handleDuplicate(id: number) {
    if (readOnly || typeof tid !== "number") return;
    try {
      const src = await apiGetProduct(tid, id);
      await apiCreateProduct(tid, { name: `${src.name} (複製)` });
      refresh();
    } catch (err: any) {
      alert("複製失敗：" + (err?.message || err));
    }
  }

  async function handleRename() {
    if (readOnly || !editId) return;
    const name = editName.trim();
    if (!name) return;

    try {
      if (tid === "__all") {
        alert("提示：『所有商品』檢視僅支援檢視。請切換到某一個類型再改名。");
        return;
      }
      await apiUpdateProduct(tid as number, editId, { name });
      setProducts((prev) =>
        prev.map((p) => (p.id === editId ? { ...p, name } : p))
      );
      setOpenModal(null);
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes("409") || /duplicate/i.test(msg)) {
        alert("改名失敗：名稱重複。");
      } else {
        alert("改名失敗：" + msg);
      }
    }
  }

  function handleCardClick(e: React.MouseEvent, id: number) {
    if (menuOpen === id) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    navigate(`/products/${encodeURIComponent(String(id))}/lifecycle`);
  }

  function handleCardKeyDown(e: React.KeyboardEvent, id: number) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleCardClick(e as unknown as React.MouseEvent, id);
    }
  }

  async function handleSwitchType(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;

    if (v === "__all") {
      setResolvedTid("__all");
      if (params.typeId !== "__all") navigate(`/products/__all`);
      refresh("__all");
      return;
    }

    if (v === "__new") {
      if (!canEdit) return;
      const name = (window.prompt("輸入新類型名稱") || "").trim();
      if (!name) return;
      try {
        const created = await apiCreateProductType({ name });
        const newId = pickTypeId(created);
        if (!newId) throw new Error("建立類型失敗");
        const list = ensureArray<ProductType>(await apiListProductTypes());
        setTypeOptions(list);
        setResolvedTid(newId);
        navigate(`/products/${newId}`, { replace: true });
      } catch (err: any) {
        alert("建立類型失敗：" + (err?.message || err));
      }
      return;
    }

    const next = Number(v);
    if (Number.isFinite(next) && next > 0) {
      setResolvedTid(next);
      if (String(params.typeId) !== String(next)) {
        navigate(`/products/${next}`);
      } else {
        refresh(next);
      }
    }
  }

  return (
    <S.PageWrapper>
      <S.TopBar>
        <h2>
          商品列表
          {tid ? (tid === "__all" ? "（所有商品）" : `（type: ${tid}）`) : ""}
        </h2>

        <div className="actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* 類型切換器 */}
          <div aria-label="產品類型切換" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#666" }}>類型</span>
            <select
              value={tid ?? "__all"}
              onChange={handleSwitchType}
              disabled={!typeOptions.length && !canEdit}
              style={{ padding: "6px 8px" }}
            >
              <option value="__all">（所有商品）</option>
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {canEdit && <option value="__new">＋ 新增類型…</option>}
            </select>
          </div>

          <AccountMenu />
        </div>
      </S.TopBar>

      <S.Hint>
        已登入：{isAuthed ? account || "(未命名)" : "（未登入）"}（
        {mapRole(user?.user_type)}）{readOnly ? "｜檢視模式" : ""}
      </S.Hint>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", marginTop: 24 }}>載入中…</p>
      ) : (
        <>
          <S.List>
            {products.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888" }}>
                {typeOptions.length === 0
                  ? (canEdit
                      ? "尚未建立任何產品類型，您可以從右上角『類型』下拉新增。"
                      : "目前沒有可用的產品類型，請聯絡店主建立後再試。")
                  : (tid === "__all"
                      ? "目前尚未建立任何商品。"
                      : "此類型尚無商品，請點右下角＋新增")}
              </p>
            ) : (
              products.map((p) => (
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
                      商品編號 {p.serialNumber ? `#${p.serialNumber}` : p.id ? `#${p.id}` : "—"}
                    </S.ProductMeta>
                  </S.ProductInfo>

                  {!readOnly && tid !== "__all" && (
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
        </>
      )}

      {/* Farmer 一律可見（就算在 __all） */}
      {!readOnly && (
        <S.Fab aria-label="新增商品" title="新增商品" onClick={() => setOpenModal("new")}>
          ＋
        </S.Fab>
      )}

      <Modal
        open={!readOnly && openModal === "new"}
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
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="輸入商品名稱"
              required
            />

            <label style={{ fontSize: 12, color: "#666" }}>產品類型</label>
            <select
              value={selectedType ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__new") setSelectedType("__new");
                else setSelectedType(Number(v));
              }}
              required
            >
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {canEdit && <option value="__new">＋ 新增類型…</option>}
            </select>

            {selectedType === "__new" && (
              <input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="輸入新類型名稱"
                required
              />
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <S.SecondaryBtn type="button" onClick={() => setOpenModal(null)}>
              取消
            </S.SecondaryBtn>
            <S.PrimaryBtn type="submit">新增</S.PrimaryBtn>
          </div>
        </form>
      </Modal>

      <Modal
        open={!readOnly && tid !== "__all" && openModal === "edit"}
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
          <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <div className="modal-actions" style={{ marginTop: 12 }}>
            <S.SecondaryBtn type="button" onClick={() => setOpenModal(null)}>
              取消
            </S.SecondaryBtn>
            <S.PrimaryBtn type="submit">儲存</S.PrimaryBtn>
          </div>
        </form>
      </Modal>
    </S.PageWrapper>
  );
}
