import React, { useEffect, useState } from "react";
import Modal from "@/ui/components/Modal";
import { PrimaryButton, GhostButton } from "@/ui/primitives/Button";
import { Field, FormActions } from "@/ui/primitives/Form";
import { Container } from "@/ui/primitives/Layout";
import * as S from "./WelcomePage.styles";
import { useNavigate } from "react-router-dom";

import { useUser } from "@/context/UserContext";
import type { BackendUserType } from "@/api/auth";

export default function WelcomePage() {
  const [open, setOpen] = useState<null | "login" | "signup">(null);
  const navigate = useNavigate();

  // 只依賴 Context 的狀態，避免用 localStorage 造成重複導頁
  const { ready, isAuthed } = useUser();

  // ✅ 初始化完成且確定登入後，導向商品頁
  useEffect(() => {
    if (ready && isAuthed) {
      navigate("/products", { replace: true });
    }
  }, [ready, isAuthed, navigate]);

  return (
    <S.Bg>
      <div className="PageShell">
        <Container max="md">
          <S.Card role="region" aria-label="歡迎頁">
            <S.Hero
              src="/images/tea_v2.png"
              srcSet="/images/tea_v2.png 960w, /images/tea_v2.png 1920w"
              sizes="(max-width: 768px) 92vw, 960px"
              alt="茶園風景"
              loading="eager"
            />

            <S.Title>茶葉商品碳足跡管理平台</S.Title>
            <S.Subtitle>
              管理並追蹤您的茶葉產品與記錄其碳足跡，讓消費者與茶行攜手打造綠色的未來。
            </S.Subtitle>
            <S.Actions>
              <PrimaryButton onClick={() => setOpen("login")}>登入</PrimaryButton>
              <GhostButton onClick={() => setOpen("signup")}>註冊</GhostButton>
            </S.Actions>
          </S.Card>

          <S.FooterHint>
            <small>© {new Date().getFullYear()} 碳足跡管理平台</small>
          </S.FooterHint>
        </Container>
      </div>

      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        ariaLabel={open === "login" ? "登入" : "註冊"}
      >
        {open === "login" ? (
          <LoginForm onDone={() => setOpen(null)} />
        ) : (
          <SignupForm onDone={() => setOpen(null)} />
        )}
      </Modal>
    </S.Bg>
  );
}

/* -------------------- 登入表單 -------------------- */
function LoginForm({ onDone }: { onDone: () => void }) {
  const [account, setAcc] = useState("");
  const [password, setPwd] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useUser();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(account, password); // 成功會寫 token + me
      onDone();                       // 關閉 Modal
      navigate("/products");          // 直接跳商品頁
    } catch (err: any) {
      setError(err?.message || "登入失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>登入</h3>
      <Field>
        <label>電子郵件</label>
        <input
          type="text"
          required
          value={account}
          onChange={(e) => setAcc(e.target.value)}
          placeholder="請輸入電子郵件"
          autoComplete="username"
        />
      </Field>
      <Field>
        <label>密碼</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="請輸入密碼"
          autoComplete="current-password"
        />
      </Field>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <FormActions>
        <GhostButton type="button" onClick={onDone} disabled={loading}>
          取消
        </GhostButton>
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "處理中..." : "登入"}
        </PrimaryButton>
      </FormActions>
    </form>
  );
}

/* -------------------- 註冊表單（後端對齊） -------------------- */
function SignupForm({ onDone }: { onDone: () => void }) {
  const [account, setAcc] = useState("");
  const [userName, setUserName] = useState(""); // 後端要求 user_name
  const [password, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [role, setRole] = useState<BackendUserType>("shop"); // "shop" | "customer"
  const [shopName, setShopName] = useState(""); // role=shop 時必填

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { register } = useUser();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPwd) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    if (!userName.trim()) {
      setError("請輸入使用者名稱");
      return;
    }
    if (role === "shop" && !shopName.trim()) {
      setError("請輸入茶行名稱");
      return;
    }

    setLoading(true);
    try {
      await register({
        account,
        password,
        role,
        user_name: userName,
        organization_name: role === "shop" ? shopName : undefined,
      });               // 成功會寫 token + me
      onDone();         // 關閉 Modal
      navigate("/products"); // 直接跳商品頁
    } catch (err: any) {
      setError(err?.message || "註冊失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>註冊</h3>

      <Field>
        <label>電子郵件</label>
        <input
          type="text"
          required
          value={account}
          onChange={(e) => setAcc(e.target.value)}
          placeholder="請輸入電子郵件"
          autoComplete="username"
        />
      </Field>

      <Field>
        <label>使用者名稱</label>
        <input
          type="text"
          required
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="請輸入使用者名稱"
        />
      </Field>

      <Field>
        <label>密碼</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="請輸入密碼"
          autoComplete="new-password"
        />
      </Field>

      <Field>
        <label>確認密碼</label>
        <input
          type="password"
          required
          value={confirmPwd}
          onChange={(e) => setConfirmPwd(e.target.value)}
          placeholder="再次輸入密碼"
          autoComplete="new-password"
        />
      </Field>

      <Field>
        <label>角色</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as BackendUserType)}
        >
          <option value="shop">茶行</option>
          <option value="customer">消費者</option>
        </select>
      </Field>

      {role === "shop" && (
        <Field>
          <label>茶行名稱</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="請輸入茶行名稱"
            required
          />
        </Field>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <FormActions>
        <GhostButton type="button" onClick={onDone} disabled={loading}>
          取消
        </GhostButton>
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? "建立中..." : "建立帳號"}
        </PrimaryButton>
      </FormActions>
    </form>
  );
}
