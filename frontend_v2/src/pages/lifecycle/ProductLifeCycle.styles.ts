//src\pages\lifecycle\ProductLifeCycle.styles.ts
import styled from "styled-components";

export const StageContainer = styled.div`
  max-width: 560px;
  margin: 0 auto 24px;
`;

export const ModalBody = styled.div`
  padding: 16px;
`;

export const ModalTitle = styled.h3`
  margin: 0 0 8px 0;
  color: #2e7d32;
`;

export const MetaRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 2px;
`;

export const MetaLabel = styled.span`
  color: #555;
  font-size: 14px;
  min-width: 48px;
`;

export const MetaText = styled.span`
  color: #333;
  font-size: 14px;
`;

export const SuccessTip = styled.p`
  color: #2e7d32;
  background: rgba(46, 125, 50, 0.1);
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  margin: 6px 0 12px;
`;

export const Input = styled.input`
  width: 100%;
  padding: 8px 10px;
  font-size: 14px;
  border-radius: 6px;
  border: 1px solid #cfd8cf;
  margin-bottom: 10px;
  background: #ffffff;

  &:focus {
    outline: none;
    border-color: #81c784;
    box-shadow: 0 0 0 3px rgba(129, 199, 132, 0.2);
  }
`;

export const AmountRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

export const UnitText = styled.span`
  font-size: 14px;
  color: #444;
  min-width: 48px;
`;

export const EmissionText = styled.p`
  font-size: 14px;
  color: #444;
  margin: 8px 0 0;
`;

export const HistoryBox = styled.div`
  margin: 16px 0 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  max-height: 160px;
  overflow-y: auto;
  font-size: 13px;
  color: #444;
`;

export const HistoryTitle = styled.div`
  font-weight: 600;
  margin-bottom: 6px;
`;

export const EmptyHint = styled.div`
  opacity: 0.6;
`;

export const HistoryItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);

  &:last-child {
    border-bottom: none;
  }
`;

export const HistoryTime = styled.span`
  opacity: 0.6;
  font-size: 12px;
  margin-left: 6px;
`;

export const ButtonRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 12px;
`;

export const SubmitButton = styled.button`
  background: #4caf50;
  color: #ffffff;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-weight: 600;

  &:hover {
    background: #43a047;
  }
`;

export const CancelButton = styled.button`
  background: #eef3ee;
  color: #333;
  padding: 8px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;

  &:hover {
    background: #e0ece4;
  }
`;
