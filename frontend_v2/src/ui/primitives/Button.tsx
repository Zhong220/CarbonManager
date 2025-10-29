import styled from "styled-components";

export const ButtonBase = styled.button`
  appearance: none;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 0 16px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background 120ms ease, filter 120ms ease, transform 50ms ease;
  outline: none;
  box-shadow: none;
  &:focus { outline: none; box-shadow: none; }
`;

export const WhiteButton = styled(ButtonBase)<{ $small?: boolean }>`
  height: ${({ $small }) => ($small ? "32px" : "40px")};
  padding: 0 ${({ $small }) => ($small ? "10px" : "16px")};
  background: #fff;
  color: #203319;
  border-color: #dfe6da;
  &:hover { background: #fff; filter: brightness(0.98); }
  &:active { transform: translateY(1px); }
`;



export const PrimaryButton = styled(ButtonBase)`
  background: #58b05a;
  color: #fff;
  border-color: #58b05a;
  font-weight: 700;
  &:hover {
    filter: brightness(0.98);
  }
  &:active {
    transform: translateY(1px);
  }
`;

export const GhostButton = styled(ButtonBase)`
  background: #f3f5f1;
  color: #2b3a24;
  border-color: #dfe6da;
  &:hover {
    background: #e9eee8;
  }
  &:active {
    transform: translateY(1px);
  }
`;
