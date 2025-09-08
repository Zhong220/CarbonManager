import styled from "styled-components";

export const ButtonBase = styled.button`
  appearance: none;
  border: 1px solid transparent;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  min-height: 40px;
  transition: filter 120ms ease, transform 50ms ease, background 120ms ease;
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
