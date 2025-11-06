import React, { useEffect, useMemo, useRef, useState } from "react";
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
  apiListAllProducts,
  UIProduct,
} from "@/api/products";

import {
    apiListProductTypes,
    apiCreateProductType,
    apiGetProductType,
    ProductType,
} from "@/api/productTypes";

function mapRole(userType?: "shop" | "customer" | null) {
  if (userType === "shop") return "Farmer";
  if (userType === "customer") return "Consumer";
  return "None";
}

const ALL_SENTINEL = "__all";

function pickTypeId(created: any): number | null {
  const id = created?.id ?? created?.product_type?.id ?? created?.data?.id ?? null;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function ProductListPage() {
  const { user, isAuthed } = useUser();
  const account = user?.account ?? null;
  const role = mapRole(user?.user_type as any);
  const canEdit = role === "Farmer" && isAuthed;
  const readOnly = !canEdit;

  const navigate = useNavigate();
  const { typeId } = useParams(); // /products/:typeId（可能是數字或未帶）

  // ① 載入所有類型（依後端格式）
  const [typeOptions, setTypeOptions] = useState<ProductType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTypesLoading(true);
      try {
        const list = await apiListProductTypes(); // ← 已解包 {product_types:[]}
        if (!cancelled) setTypeOptions(list);
      } catch (e) {
        if (!cancelled) setTypeOptions([]);
      } finally {
        if (!cancelled) setTypesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ② 解析當前選取的 typeId（支援「全部」）
  const tidFromParam: number | null =
    typeId && typeId !== ALL_SENTINEL ? Number(typeId) : null;

  const safeTid = useMemo(() => {
    if (typeId === ALL_SENTINEL) return ALL_SENTINEL as const;
    if (Number.isFinite(tidFromParam) && (tidFromParam as number) > 0) {
      return tidFromParam as number;
    }
    return typeOptions[0]?.id ?? null;
  }, [typeId, tidFromParam, typeOptions]);

  // ③ 商品列表（支援「全部」：把所有類型合併）
  const [products, setProducts] = useState<UIProduct[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProductsBySelection(selection: number | typeof ALL_SENTINEL | null) {
    if (!selection) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (selection === ALL_SENTINEL) {
        const ids = typeOptions.map(t => t.id);
        const all = await apiListAllProducts(ids);
        setProducts(all);
      } else {
        const list = await apiListProducts(selection);
        setProducts(list);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!typesLoading) loadProductsBySelection(safeTid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typesLoading, safeTid]);

  // ④ 新增 / 編輯 / 刪除
  const [openModal, setOpenModal] = useState<null | "new" | "edit">(null);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // 新增時的類型選擇（可以當場新增）
  const [selectedType, setSelectedType] = useState<number | "__new" | null>(null);
  const [newTypeName, setNewTypeName] = useState("");

  useEffect(() => {
    if (!canEdit) return;
    if (safeTid && safeTid !== ALL_SENTINEL && typeOptions.some(t => t.id === safeTid)) {
      setSelectedType(safeTid as number);
    } else if (typeOptions.length) {
      setSelectedType(typeOptions[0].id);
    } else {
      setSelectedType("__new");
    }
  }, [safeTid, canEdit, typeOptions]);

  async function ensureTypeForCreate(): Promise<number> {
    if (selectedType === "__new") {
      const name = (newTypeName || "").trim();
      if (!name) throw new Error("請輸入新的類型名稱");
      const created = await apiCreateProductType({ name });
      const id = pickTypeId(created);
      if (!id) throw new Error("建立類型失敗");
      const list = await apiListProductTypes();
      setTypeOptions(list);
      setSelectedType(id);
      if (safeTid !== id) navigate(`/products/${id}`, { replace: true });
      return id;
    }
    if (typeof selectedType === "number") return selectedType;
    if (safeTid && safeTid !== ALL_SENTINEL) return safeTid as number;
    // 若當前在「全部」，預設落在第一個類型
    if (typeOptions[0]) return typeOptions[0].id;
    throw new Error("尚未選擇產品類型");
  }

  async function handleAdd() {
    if (readOnly) return;
    const name = newName.trim();
    if (!name) return;
    try {
      const useTid = await ensureTypeForCreate();
      await apiCreateProduct(useTid, { name });
      setOpenModal(null);
      setNewName("");
      setNewTypeName("");
      if (safeTid === ALL_SENTINEL) {
        await loadProductsBySelection(ALL_SENTINEL);
      } else {
        if (safeTid !== useTid) navigate(`/products/${useTid}`, { replace: true });
        await loadProductsBySelection(useTid);
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes("409") || /already exists/i.test(msg)) {
        alert("新增失敗：名稱重複。");
      } else if (/organization/i.test(msg)) {
        alert("新增失敗：你沒有綁定組織或類型。");
      } else {
        alert("新增失敗：" + msg);
      }
    }
  }

  async function handleDelete(id: number) {
    if (readOnly) return;
    if (!safeTid || safeTid === ALL_SENTINEL) {
      alert("請先切換到某個類型再刪除。");
      return;
    }
    try {
      await apiDeleteProduct(safeTid as number, id);
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (e: any) {
      alert("刪除失敗：" + (e?.message || e));
    }
  }

  async function handleDuplicate(id: number) {
    if (readOnly) return;
    if (!safeTid || safeTid === ALL_SENTINEL) {
      alert("請先切換到某個類型再複製。");
      return;
    }
    try {
      const src = await apiGetProduct(safeTid as number, id);
      await apiCreateProduct(safeTid as number, { name: `${src.name} (複製)` });
      await loadProductsBySelection(safeTid as number);
    } catch (e: any) {
      alert("複製失敗：" + (e?.message || e));
    }
  }

  async function handleRename() {
    if (readOnly || !editId) return;
    const name = editName.trim();
    if (!name) return;
    if (!safeTid || safeTid === ALL_SENTINEL) {
      alert("請先切換到某個類型再重新命名。");
      return;
    }
    try {
      await apiUpdateProduct(safeTid as number, editId, { name });
      setProducts(prev => prev.map(p => (p.id === editId ? { ...p, name } : p)));
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

  // 卡片操作菜單
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const btnRefs = useRef<Record<number, HTMLDivElement | null>>({});

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
      handleCardClick(e as any, id);
    }
  }

  // 類型切換（含「全部」）
  async function handleSwitchType(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value;
    if (v === "__new") {
      if (!canEdit) return;
      const name = (window.prompt("輸入新類型名稱") || "").trim();
      if (!name) return;
      try {
        const created = await apiCreateProductType({ name });
        const newId = pickTypeId(created);
        if (!newId) throw new Error("建立類型失敗");
        const list = await apiListProductTypes();
        setTypeOptions(list);
        navigate(`/products/${newId}`, { replace: true });
      } catch (err: any) {
        alert("建立類型失敗：" + (err?.message || err));
      }
      return;
    }
    if (v === ALL_SENTINEL) {
      navigate(`/products/${ALL_SENTINEL}`);
      return;
    }
    const next = Number(v);
    if (Number.isFinite(next) && next > 0) {
      navigate(`/products/${next}`);
    }
  }

  return (
    <S.PageWrapper>
      <S.TopBar>
        <h2>商品列表{safeTid && safeTid !== ALL_SENTINEL ? `（type: ${safeTid}）` : "（全部）"}</h2>

        <div className="actions" style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div aria-label="產品類型切換" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#666" }}>類型</span>
            <select
              value={safeTid === ALL_SENTINEL ? ALL_SENTINEL : safeTid ?? ""}
              onChange={handleSwitchType}
              disabled={typesLoading && !canEdit}
              style={{ padding: "6px 8px" }}
            >
              {/* 顯示所有商品 */}
              {typeOptions.length > 0 && (
                <option value={ALL_SENTINEL}>（顯示所有商品）</option>
              )}
              {/* 個別類型 */}
              {typeOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {/* 新增類型 */}
              {canEdit && <option value="__new">＋ 新增類型…</option>}
            </select>
          </div>

          <AccountMenu />
        </div>
      </S.TopBar>

      <S.Hint>
        已登入：{isAuthed ? account || "(未命名)" : "（未登入）"}（{mapRole(user?.user_type as any)}）
        {readOnly ? "｜檢視模式" : ""}
      </S.Hint>

      {loading ? (
        <p style={{ textAlign: "center", color: "#888", marginTop: 24 }}>載入中…</p>
      ) : (
        <>
          <S.List>
            {products.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888" }}>
                {mapRole(user?.user_type as any) === "Consumer"
                  ? "目前沒有商品"
                  : "尚無商品，請點右下角＋新增"}
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

      {!readOnly && (
        <S.Fab aria-label="新增商品" title="新增商品" onClick={() => setOpenModal("new")}>
          ＋
        </S.Fab>
      )}

      {/* 新增商品 */}
      <Modal open={!readOnly && openModal === "new"} onClose={() => setOpenModal(null)} ariaLabel="新增商品">
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

      {/* 修改商品 */}
      <Modal open={!readOnly && openModal === "edit"} onClose={() => setOpenModal(null)} ariaLabel="修改商品">
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
