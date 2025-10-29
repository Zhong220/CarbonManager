// frontend/src/pages/NotesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import Header from "../components/Header";
import {
  getAccount,
  loadNotes,
  saveNotes,
  NoteItem,
} from "../utils/storage";

const WOOD = {
  text:   "#4C3A28",
  button: "linear-gradient(135deg,#D8C4AA 0%, #B49779 100%)",
  card:   "linear-gradient(145deg,#EFE8DF 0%, #E2D3C1 100%)",
};

export default function NotesPage() {
  const nav = useNavigate();
  const account = getAccount();

  /* 若沒登入就導回登入 */
  useEffect(() => {
    if (!account) {
      alert("請先登入");
      nav("/login", { replace: true });
    }
  }, [account, nav]);

  const [notes, setNotes] = useState<NoteItem[]>(() => loadNotes(account));
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<NoteItem | null>(null);
  const [showModal, setShowModal] = useState(false);

  /* 建立新筆記 */
  const newNote = () => {
    setEditing({
      id: crypto.randomUUID(),
      title: "",
      body: "",
      pinned: false,
      updatedAt: Date.now(),
    });
    setShowModal(true);
  };

  /* 儲存筆記 */
  const saveNote = (note: NoteItem) => {
    let next: NoteItem[];
    const idx = notes.findIndex((n) => n.id === note.id);
    if (idx === -1) next = [...notes, note];
    else {
      next = [...notes];
      next[idx] = note;
    }
    setNotes(next);
    saveNotes(account, next);
  };

  const deleteNote = (id: string) => {
    if (!window.confirm("確定刪除這則筆記？")) return;
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    saveNotes(account, next);
  };

  const togglePin = (id: string) => {
    const next = notes.map((n) =>
      n.id === id ? { ...n, pinned: !n.pinned, updatedAt: Date.now() } : n
    );
    setNotes(next);
    saveNotes(account, next);
  };

  /* 篩選＋排序（pinned 先，接著 updatedAt desc） */
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const list = s
      ? notes.filter(
          (n) =>
            n.title.toLowerCase().includes(s) ||
            n.body.toLowerCase().includes(s)
        )
      : notes;

    return list
      .slice()
      .sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.updatedAt - a.updatedAt;
      });
  }, [notes, search]);

  /* Modal 內部狀態 */
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  useEffect(() => {
    if (editing) {
      setEditTitle(editing.title);
      setEditBody(editing.body);
    }
  }, [editing]);

  const onModalClose = () => {
    setShowModal(false);
    setEditing(null);
  };

  const onModalSave = () => {
    if (!editing) return;
    const updated: NoteItem = {
      ...editing,
      title: editTitle.trim() || "（未命名）",
      body: editBody,
      updatedAt: Date.now(),
    };
    saveNote(updated);
    onModalClose();
  };

  return (
    <div className="PageWrapper">
      <Header title="記事本" />

      <div className="CenteredContent" style={{ paddingTop: 24 }}>
        {/* 搜尋列 & 新增 */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            className="InputAmount"
            placeholder="搜尋筆記…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="Button"
            style={{ background: WOOD.button }}
            onClick={newNote}
          >
            ＋ 新增
          </button>
        </div>

        {/* 列表 */}
        {filtered.length === 0 ? (
          <p style={{ color: "#7C6B55", textAlign: "center", marginTop: 32 }}>
            {search ? "沒有符合搜尋的筆記" : "還沒有任何筆記，點右邊「＋ 新增」吧！"}
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.map((n) => (
              <li key={n.id} style={{ marginBottom: 12 }}>
                <button
                  onClick={() => {
                    setEditing(n);
                    setShowModal(true);
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "14px 16px",
                    border: "none",
                    borderRadius: 14,
                    background: WOOD.card,
                    color: WOOD.text,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(0,0,0,.14)",
                    position: "relative",
                  }}
                >
                  {/* title + body snippet */}
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    {n.pinned ? "📌 " : ""}
                    {n.title || "（未命名）"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.7,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: 6,
                    }}
                  >
                    {n.body.replace(/\n+/g, " ") || "（沒有內容）"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.5,
                      textAlign: "right",
                    }}
                  >
                    {new Date(n.updatedAt).toLocaleString()}
                  </div>
                </button>

                {/* 操作列：Pin / Delete */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 10,
                    marginTop: 4,
                    padding: "0 6px",
                  }}
                >
                  <button
                    onClick={() => togglePin(n.id)}
                    style={smallLinkBtn}
                  >
                    {n.pinned ? "取消置頂" : "置頂"}
                  </button>

                  <button
                    onClick={() => deleteNote(n.id)}
                    style={{ ...smallLinkBtn, color: "#9D5F42" }}
                  >
                    刪除
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 編輯 Modal */}
      <Modal visible={showModal} onClose={onModalClose}>
        <h3 style={{ marginTop: 0 }}>編輯筆記</h3>

        <input
          className="InputAmount"
          placeholder="標題"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          style={{ marginBottom: 12 }}
        />

        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          placeholder="內容…"
          style={{
            width: "100%",
            minHeight: 160,
            resize: "vertical",
            padding: "10px 12px",
            border: "1.8px solid #D0C6BA",
            borderRadius: 6,
            fontSize: 14,
            color: WOOD.text,
            background: "#F4F1ED",
            boxSizing: "border-box",
            lineHeight: 1.5,
          }}
        />

        <div className="ButtonRow">
          <button className="SubmitButton" onClick={onModalSave}>
            儲存
          </button>
          <button className="CancelButton" onClick={onModalClose}>
            取消
          </button>
        </div>
      </Modal>
    </div>
  );
}

const smallLinkBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "4px 6px",
  fontSize: 12,
  color: "#4C3A28",
  cursor: "pointer",
  textDecoration: "underline",
};
