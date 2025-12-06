// src/pages/products/ProductListPage.tsx
import React, { useState, useEffect, useRef } from "react";
import * as S from "./ProductListPage.styles";
import Modal from "@/ui/components/Modal";
import AccountMenu from "@/ui/components/AccountMenu";
import DropdownMenu from "@/ui/components/DropdownMenu";
import { useNavigate, useParams } from "react-router-dom";
import { useUser } from "@/context/UserContext";
import { PrimaryButton, GhostButton } from "@/ui/primitives/Button";

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

// 從後端的 ProductType 物件裡抓「真正用來打 API 的 id」
function getTypeDisplayId(t: ProductType): string {
  // 你的 ProductType.normalize 已經把 id 塞好在 t.id
  // 保留舊邏輯當備援
  const anyT = t as any;

  const raw =
    anyT.id ??
    anyT.product_type_id ?? // 後端常用欄位
    anyT.display_id ?? // 若有額外 display_id 欄位
    null;

  return raw != null ? String(raw) : "";
}

// 建立 / 新增類型 API 回傳時，從回傳物件裡抽出 id
function extractTypeDisplayId(created: any): string | null {
  if (!created) return null;
  const anyC = created as any;

  const raw =
    anyC.id ??
    anyC.product_type_id ??
    anyC.product_type?.id ??
    anyC.data?.id ??
    anyC.data?.product_type_id ??
    null;

  if (raw == null) return null;
  return String(raw);
}

function ensureArray<T>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v && Array.isArray(v.items)) return v.items as T[];
  if (v && Array.isArray(v.data)) return v.data as T[];
  if (v && Array.isArray(v.list)) return v.list as T[];
  return [];
}

// 顯示給使用者看的分類名稱：把 Default Type / Uncategorized 都顯示成「未分類」
function displayTypeName(name?: string) {
  if (!name) return "未分類";
  if (name === "Default Type" || name === "Uncategorized") return "未分類";
  return name;
}

// typeId：要嘛是 "__all"，要嘛是 id 字串
type TidLike = "__all" | string;

// 在前端多加一個 _typeId（字串），記錄這個商品屬於哪個分類
type ProductRow = UIProduct & { _typeId?: string };

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
  const [resolvedTid, setResolvedTid] = useState<TidLike>("__all");
  const loadingTypesRef = useRef(false);

  // URL 上的 typeId => 內部統一成 TidLike
  useEffect(() => {
    const urlTid = params.typeId;

    if (!urlTid) {
      // 沒有給 typeId，就導到 /products/__all
      setResolvedTid("__all");
      navigate("/products/__all", { replace: true });
      return;
    }

    if (urlTid === "__all") {
      setResolvedTid("__all");
      return;
    }

    // 其他字串就暫時先吃進來，後面載完 typeOptions 再檢查是否合法
    setResolvedTid(urlTid);
  }, [params.typeId, navigate]);

  const tid: TidLike = resolvedTid;

  // 先載入「類型清單」，若為空且可編輯 → 自動補建 Default/未分類
  useEffect(() => {
    let cancelled = false;
    if (loadingTypesRef.current) return;
    loadingTypesRef.current = true;

    (async () => {
      try {
        let list = ensureArray<ProductType>(await apiListProductTypes());

        // 完全沒有類型，而且可以編輯 → 自動建立一個預設 type
        if (list.length === 0 && canEdit) {
          try {
            await apiGetOrCreateDefaultType();
            list = ensureArray<ProductType>(await apiListProductTypes());
          } catch (e) {
            console.warn("[ProductList] auto-create default type failed", e);
          }
        }

        if (!cancelled) {
          setTypeOptions(list);
        }

        // 如果目前 URL 上的 tid 不是 "__all"，檢查一下是否在清單中
        if (!cancelled && tid !== "__all") {
          const exists = list.some((t) => getTypeDisplayId(t) === tid);
          if (!exists) {
            setResolvedTid("__all");
            if (params.typeId !== "__all") {
              navigate("/products/__all", { replace: true });
            }
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
  }, [canEdit, tid, params.typeId, navigate]);

  // ---------- 建立商品用的「類型」選擇 ----------
  const [selectedType, setSelectedType] = useState<string | "__new">("__new");
  const [newTypeName, setNewTypeName] = useState("");

  // 根據目前 tid / 類型清單，更新「新增商品」對話框裡的預設類型
  useEffect(() => {
    if (!canEdit) return;

    if (tid !== "__all") {
      setSelectedType(tid);
      return;
    }

    if (typeOptions.length) {
      const firstId = getTypeDisplayId(typeOptions[0]);
      setSelectedType(firstId || "__new");
    } else {
      setSelectedType("__new");
    }
  }, [tid, canEdit, typeOptions]);

  // ---------- 商品清單 ----------
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 依照目前 tid 載入商品清單
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // 顯示「所有商品」：把所有 type 聚合起來
        if (tid === "__all") {
          let types = typeOptions;

          if (types.length === 0 && canEdit) {
            try {
              await apiGetOrCreateDefaultType();
              types = ensureArray<ProductType>(await apiListProductTypes());
              if (!cancelled) setTypeOptions(types);
            } catch {
              /* ignore */
            }
          }

          if (types.length === 0) {
            if (!cancelled) setProducts([]);
            return;
          }

          const promises = types
            .map((t) => {
              const typeId = getTypeDisplayId(t);
              if (!typeId) return null;
              return apiListProducts(typeId).then((list) =>
                list.map(
                  (p) =>
                    ({
                      ...p,
                      _typeId: typeId,
                    } as ProductRow)
                )
              );
            })
            .filter(
              (x): x is Promise<ProductRow[]> => x !== null
            );

          if (promises.length === 0) {
            if (!cancelled) setProducts([]);
            return;
          }

          const chunks = await Promise.all(promises);
          const all = chunks.flat();
          if (!cancelled) setProducts(all);
          return;
        }

        // 指定單一類型
        const list = await apiListProducts(tid);
        if (!cancelled) {
          setProducts(
            list.map(
              (p) =>
                ({
                  ...p,
                  _typeId: tid,
                } as ProductRow)
            )
          );
        }
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

  // 重新載入商品清單（在新增 / 刪除 / 複製 / 改名後用）
  function refresh(tidOverride?: TidLike) {
    const target: TidLike = tidOverride ?? tid;
    if (!target) return;

    setLoading(true);

    if (target === "__all") {
      if (typeOptions.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const promises = typeOptions
        .map((t) => {
          const typeId = getTypeDisplayId(t);
          if (!typeId) return null;
          return apiListProducts(typeId).then((list) =>
            list.map(
              (p) =>
                ({
                  ...p,
                  _typeId: typeId,
                } as ProductRow)
            )
          );
        })
        .filter(
          (x): x is Promise<ProductRow[]> => x !== null
        );

      if (promises.length === 0) {
        setProducts([]);
        setLoading(false);
        return;
      }

      Promise.all(promises)
        .then((chunks) => setProducts(chunks.flat()))
        .finally(() => setLoading(false));
      return;
    }

    // 單一類型
    apiListProducts(target)
      .then((list) =>
        setProducts(
          list.map(
            (p) =>
              ({
                ...p,
                _typeId: target,
              } as ProductRow)
          )
        )
      )
      .finally(() => setLoading(false));
  }

  // 取得「這次新增商品要用哪個 typeId」
  async function ensureTypeIdToUse(): Promise<string> {
    // 選「新增類型…」
    if (selectedType === "__new") {
      const name = (newTypeName || "").trim();
      if (!name) throw new Error("請輸入新的分類名稱");

      // 1) 先從後端 list 一次，看有沒有同名的類型
      const list = await apiListProductTypes();
      const dup = list.find(
        (t) => (t.name || "").toLowerCase() === name.toLowerCase()
      );

      if (dup) {
        // 已經有同名，直接用這一筆，不再送 create → 不會噴 409
        const useId = dup.id;
        setTypeOptions(list);
        setSelectedType(useId);

        if (tid !== useId) {
          navigate(`/products/${encodeURIComponent(useId)}`, {
            replace: true,
          });
        }
        return useId;
      }

      // 2) 確定沒有同名才真的去建立
      const created = await apiCreateProductType({ name });
      const useId = extractTypeDisplayId(created) ?? created.id;

      const freshList = await apiListProductTypes();
      setTypeOptions(freshList);
      setSelectedType(useId);

      if (tid !== useId) {
        navigate(`/products/${encodeURIComponent(useId)}`, {
          replace: true,
        });
      }
      return useId;
    }

    // 已在對話框選好類型
    if (selectedType && selectedType !== "__new") {
      return selectedType;
    }

    // 沒特別選，就沿用目前的 tid（如果不是 __all）
    if (tid !== "__all") return tid;

    throw new Error("尚未選擇產品分類");
  }

  // ---------- CRUD handlers ----------
  const [openModal, setOpenModal] = useState<null | "new" | "edit">(null);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTypeId, setEditTypeId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const btnRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
        navigate(`/products/${encodeURIComponent(useTid)}`, {
          replace: true,
        });
      }
      refresh(useTid);
    } catch (err: any) {
      console.error("[ProductList] handleAdd failed:", err);
      const status = err?.status ?? err?.response?.status;
      const msg = String(err?.message || err);

      if (
        msg.includes("1452") ||
        /foreign key/i.test(msg) ||
        /not.*found/i.test(msg) ||
        status === 404
      ) {
        alert("新增失敗：產品分類不存在或不屬於你的組織。");
      } else if (status === 409 || /duplicate/i.test(msg)) {
        // 這裡是「商品本身」名稱或編號重複
        alert("新增失敗：名稱或編號重複，請換一個名稱再試。");
      } else {
        alert("新增失敗：" + msg);
      }
    }
  }

  async function handleDelete(p: ProductRow) {
    if (readOnly) return;
    const typeId = p._typeId ?? (tid !== "__all" ? tid : null);
    if (!typeId) {
      alert("刪除失敗：找不到商品所屬分類。");
      return;
    }
    try {
      await apiDeleteProduct(typeId, p.id as any);
      setProducts((prev) =>
        prev.filter((x) => !(x.id === p.id && x._typeId === typeId))
      );
    } catch (err: any) {
      alert("刪除失敗：" + (err?.message || err));
    }
  }

  async function handleDuplicate(p: ProductRow) {
    if (readOnly) return;
    const typeId = p._typeId ?? (tid !== "__all" ? tid : null);
    if (!typeId) {
      alert("複製失敗：找不到商品所屬分類。");
      return;
    }
    try {
      const src = await apiGetProduct(typeId, p.id as any);
      await apiCreateProduct(typeId, { name: `${src.name} (複製)` });
      refresh(typeId);
    } catch (err: any) {
      alert("複製失敗：" + (err?.message || err));
    }
  }

  async function handleRename() {
    if (readOnly || !editId || !editTypeId) return;
    const name = editName.trim();
    if (!name) return;

    try {
      await apiUpdateProduct(editTypeId, editId, { name });
      setProducts((prev) =>
        prev.map((p) =>
          p.id === editId && p._typeId === editTypeId ? { ...p, name } : p
        )
      );
      setOpenModal(null);
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      const msg = String(err?.message || err);
      if (status === 409 || /duplicate/i.test(msg)) {
        alert("改名失敗：名稱重複。");
      } else {
        alert("改名失敗：" + msg);
      }
    }
  }

  function handleCardClick(e: React.MouseEvent, id: any) {
    if (menuOpen === String(id)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    navigate(`/products/${encodeURIComponent(String(id))}/lifecycle`);
  }

  function handleCardKeyDown(e: React.KeyboardEvent, id: any) {
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
      else refresh("__all");
      return;
    }

    if (v === "__new") {
      if (!canEdit) return;
      const name = (window.prompt("輸入新類型名稱") || "").trim();
      if (!name) return;
      try {
        const created = await apiCreateProductType({ name });
        const newId = extractTypeDisplayId(created) ?? created.id;
        if (!newId) throw new Error("建立類型失敗");

        const list = await apiListProductTypes();
        setTypeOptions(list);
        setResolvedTid(newId);
        navigate(`/products/${encodeURIComponent(newId)}`, {
          replace: true,
        });
      } catch (err: any) {
        const msg = String(err?.message || err);
        alert("建立類型失敗：" + msg);
      }
      return;
    }

    // 一般切換到某個既有類型
    setResolvedTid(v as TidLike);
    if (params.typeId !== v) {
      navigate(`/products/${encodeURIComponent(v)}`);
    } else {
      refresh(v as TidLike);
    }
  }

  return (
    <S.PageWrapper>
      <S.TopBar>
        <h2>
          商品列表
          {tid === "__all" ? "" : `（type: ${tid}）`}
        </h2>

        <div
          className="actions"
          style={{ display: "flex", gap: 12, alignItems: "center" }}
        >
          {/* 類型切換器 */}
          <div
            aria-label="產品類型切換"
            style={{ display: "flex", gap: 6, alignItems: "center" }}
          >
            <span style={{ fontSize: 12, color: "#666" }}>類型</span>
            <select
              value={tid}
              onChange={handleSwitchType}
              disabled={!typeOptions.length && !canEdit}
              style={{ padding: "6px 8px" }}
            >
              <option value="__all">（所有商品）</option>
              {typeOptions.map((t, index) => {
                const typeId = getTypeDisplayId(t) || `__idx_${index}`;
                return (
                  <option key={typeId} value={typeId}>
                    {displayTypeName(
                      (t as any).name ?? (t as any).product_type_name
                    )}
                  </option>
                );
              })}
              {canEdit && <option value="__new">＋ 新增類型…</option>}
            </select>
          </div>

          <AccountMenu />
        </div>
      </S.TopBar>

      <S.Hint>
        已登入：
        {isAuthed ? account || "(未命名)" : "（未登入）"}
        （{mapRole(user?.user_type)}）
        {readOnly ? "｜檢視模式" : ""}
      </S.Hint>

      {loading ? (
        <p
          style={{
            textAlign: "center",
            color: "#888",
            marginTop: 24,
          }}
        >
          載入中…
        </p>
      ) : (
        <>
          <S.List>
            {products.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888" }}>
                {typeOptions.length === 0
                  ? canEdit
                    ? "尚未建立任何產品類型，您可以從右上角『類型』下拉新增。"
                    : "目前沒有可用的產品類型，請聯絡店主建立後再試。"
                  : tid === "__all"
                  ? "目前尚未建立任何商品。"
                  : "此類型尚無商品，請點右下角＋新增"}
              </p>
            ) : (
              products.map((p) => {
                const key = `${p._typeId ?? "x"}-${String(p.id)}`;
                const idStr = String(p.id);
                return (
                  <S.ProductCard
                    key={key}
                    onClick={(e) => handleCardClick(e, idStr)}
                    onKeyDown={(e) => handleCardKeyDown(e, idStr)}
                    role="button"
                    tabIndex={0}
                    aria-label={`商品：${p.name}`}
                  >
                    <S.Thumb />
                    <S.ProductInfo>
                      <S.ProductName>{p.name}</S.ProductName>
                      <S.ProductMeta>
                        商品編號{" "}
                        {p.serialNumber
                          ? `#${p.serialNumber}`
                          : p.id
                          ? `#${p.id}`
                          : "—"}
                      </S.ProductMeta>
                    </S.ProductInfo>

                    {/* 在 __all 也可以編輯 / 刪除，因為有 _typeId 了 */}
                    {!readOnly && (
                      <>
                        <S.MenuWrapper
                          ref={(el) => (btnRefs.current[idStr] = el)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen(
                              menuOpen === idStr ? null : idStr
                            );
                          }}
                          aria-haspopup="menu"
                          aria-expanded={menuOpen === idStr}
                          aria-label="更多操作"
                        >
                          ⋮
                        </S.MenuWrapper>

                        <DropdownMenu
                          anchorRef={{
                            current: btnRefs.current[idStr],
                          }}
                          open={menuOpen === idStr}
                          onClose={() => setMenuOpen(null)}
                        >
                          <li
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditId(idStr);
                              setEditTypeId(
                                p._typeId ?? (tid !== "__all" ? tid : null)
                              );
                              setEditName(p.name as string);
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
                              handleDuplicate(p);
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
                              handleDelete(p);
                              setMenuOpen(null);
                            }}
                          >
                            刪除
                          </li>
                        </DropdownMenu>
                      </>
                    )}
                  </S.ProductCard>
                );
              })
            )}
          </S.List>
        </>
      )}

      {/* Farmer 一律可見（就算在 __all） */}
      {!readOnly && (
        <S.Fab
          aria-label="新增商品"
          title="新增商品"
          onClick={() => setOpenModal("new")}
        >
          ＋
        </S.Fab>
      )}

      {/* 新增商品 Modal */}
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
          <div
            style={{
              display: "grid",
              gap: 8,
              marginTop: 8,
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="輸入商品名稱"
              required
            />

            <label style={{ fontSize: 12, color: "#666" }}>
              產品類型
            </label>
            <select
              value={selectedType}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "__new") setSelectedType("__new");
                else setSelectedType(v);
              }}
              required
            >
              {typeOptions.map((t, index) => {
                const typeId = getTypeDisplayId(t) || `__idx_${index}`;
                return (
                  <option key={typeId} value={typeId}>
                    {displayTypeName(
                      (t as any).name ??
                        (t as any).product_type_name
                    )}
                  </option>
                );
              })}
              {canEdit && (
                <option value="__new">＋ 新增類型…</option>
              )}
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

          <div
            className="modal-actions"
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <GhostButton
              type="button"
              onClick={() => setOpenModal(null)}
            >
              取消
            </GhostButton>
            <PrimaryButton type="submit">新增</PrimaryButton>
          </div>
        </form>
      </Modal>

      {/* 修改商品名稱 Modal */}
      <Modal
        open={!readOnly && openModal === "edit"}
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
          <div
            className="modal-actions"
            style={{
              marginTop: 12,
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
            }}
          >
            <GhostButton
              type="button"
              onClick={() => setOpenModal(null)}
            >
              取消
            </GhostButton>
            <PrimaryButton type="submit">儲存</PrimaryButton>
          </div>
        </form>
      </Modal>
    </S.PageWrapper>
  );
}
