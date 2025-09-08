import React, { useState } from "react";
import Modal from "@/ui/components/Modal";
import { PrimaryButton, GhostButton } from "@/ui/primitives/Button";
import { Field, FormActions } from "@/ui/primitives/Form";
import { Container } from "@/ui/primitives/Layout";
import * as S from "./WelcomePage.styles";
import RoleDropdown from "@/ui/components/RoleDropdown";
import { useNavigate } from "react-router-dom";

import {
  createAccount,
  verifyLogin,
  setAccount, // ✅ 改成 setAccount
  Role,
} from "@/utils/storage";

export default function WelcomePage() {
  const [open, setOpen] = useState<null | "login" | "signup">(null);

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
              管理並追蹤您的茶葉產品與記錄其碳足跡，
              讓消費者與茶行攜手打造綠色的未來。
            </S.Subtitle>
            <S.Actions>
              <PrimaryButton onClick={() => setOpen("login")}>
                登入
              </PrimaryButton>
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

/* ---- 登入表單 ---- */
function LoginForm({ onDone }: { onDone: () => void }) {
  const [account, setAcc] = useState("");
  const [password, setPwd] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyLogin(account, password)) {
      setError("帳號或密碼錯誤");
      return;
    }
    setAccount(account); // ✅ 改成 setAccount
    onDone();
    navigate("/products");
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>登入</h3>
      <Field>
        <label>帳號</label>
        <input
          type="text"
          required
          value={account}
          onChange={(e) => setAcc(e.target.value)}
          placeholder="請輸入帳號"
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
        />
      </Field>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <FormActions>
        <GhostButton type="button" onClick={onDone}>
          取消
        </GhostButton>
        <PrimaryButton type="submit">登入</PrimaryButton>
      </FormActions>
    </form>
  );
}

/* ---- 註冊表單 ---- */
function SignupForm({ onDone }: { onDone: () => void }) {
  const [account, setAcc] = useState("");
  const [password, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [role, setRole] = useState<Role>("Farmer");
  const [shopName, setShopName] = useState(""); // 茶行名稱
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPwd) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    if (role === "Farmer" && !shopName.trim()) {
      setError("請輸入茶行名稱");
      return;
    }
    try {
      createAccount(account, password, role);
      setAccount(account); // ✅ 註冊完就設定當前帳號
      onDone();
    } catch (err: any) {
      setError(err.message || "註冊失敗");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>註冊</h3>
      <Field>
        <label>帳號</label>
        <input
          type="text"
          required
          value={account}
          onChange={(e) => setAcc(e.target.value)}
          placeholder="請輸入帳號"
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
        />
      </Field>
      <Field>
        <label>角色</label>
        <RoleDropdown value={role} onChange={(v) => setRole(v as Role)} />
      </Field>

      {role === "Farmer" && (
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

      {error && <p style={{ color: "red" }}>{error}</p>}
      <FormActions>
        <GhostButton type="button" onClick={onDone}>
          取消
        </GhostButton>
        <PrimaryButton type="submit">建立帳號</PrimaryButton>
      </FormActions>
    </form>
  );
}
