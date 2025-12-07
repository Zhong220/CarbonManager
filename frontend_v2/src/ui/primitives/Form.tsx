import styled from "styled-components";

export const Field = styled.div`
  display: grid;
  gap: 6px;
  margin: 10px 0;
  text-align: left;

  label {
    font-size: 12px;
    color: #394736;
  }

  input {
    padding: 10px 12px;
    border: 1px solid #d9e1d6;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    background: #fff;
  }

  input:focus {
    border-color: #58b05a;
    box-shadow: 0 0 0 3px rgba(88, 176, 90, 0.15);
  }
`;

export const FormActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
`;
