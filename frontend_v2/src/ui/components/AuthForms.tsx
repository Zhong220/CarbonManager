// src/ui/components/AuthForms.tsx
import React, { useState } from "react";
import {
  createAccount,
  verifyLogin,
  setAccount,
  setRole,
  Role,
} from "../../utils/storage";

interface AuthFormsProps {
  mode: "login" | "register";
  onClose: () => void;
  onSuccess: () => void;
}

const AuthForms: React.FC<AuthFormsProps> = ({ mode, onClose, onSuccess }) => {
  const [account, setAcc] = useState("");
  const [password, setPwd] = useState("");
  const [confirmPassword, setConfirmPwd] = useState("");
  const [role, setRoleState] = useState<Role>("Farmer");
  const [error, setError] = useState("");

  function handleLogin() {
    if (!verifyLogin(account, password)) {
      setError("帳號或密碼錯誤");
      return;
    }
    setAccount(account);
    onSuccess();
    onClose();
  }

  function handleRegister() {
    if (password !== confirmPassword) {
      setError("兩次輸入的密碼不一致");
      return;
    }
    try {
      createAccount(account, password, role);
      setAccount(account);
      setRole(role);
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "註冊失敗");
    }
  }

  return (
    <div style={{ padding: "20px", width: "100%", maxWidth: "320px" }}>
      <h2 style={{ marginBottom: "16px", textAlign: "center" }}>
        {mode === "login" ? "登入" : "註冊"}
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* 帳號 */}
        <input
          type="text"
          placeholder="帳號"
          value={account}
          onChange={(e) => setAcc(e.target.value)}
        />

        {/* 密碼 */}
        <input
          type="password"
          placeholder="密碼"
          value={password}
          onChange={(e) => setPwd(e.target.value)}
        />

        {/* 註冊專屬欄位 */}
        {mode === "register" && (
          <>
            <input
              type="password"
              placeholder="確認密碼"
              value={confirmPassword}
              onChange={(e) => setConfirmPwd(e.target.value)}
            />

            <select
              value={role}
              onChange={(e) => setRoleState(e.target.value as Role)}
            >
              <option value="Farmer">茶行</option>
              <option value="Consumer">消費者</option>
            </select>
          </>
        )}

        {/* 錯誤訊息 */}
        {error && <p style={{ color: "red" }}>{error}</p>}

        {/* 按鈕 */}
        <button
          style={{
            backgroundColor: "#4CAF50",
            color: "#fff",
            padding: "10px",
            borderRadius: "6px",
            border: "none",
            fontWeight: "bold",
          }}
          onClick={mode === "login" ? handleLogin : handleRegister}
        >
          {mode === "login" ? "登入" : "註冊"}
        </button>

        <button
          style={{
            marginTop: "8px",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            background: "#f5f5f5",
          }}
          onClick={onClose}
        >
          取消
        </button>
      </div>
    </div>
  );
};

export default AuthForms;
