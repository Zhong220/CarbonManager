
import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";

export type Step = {
  selector: string;
  title?: string;
  content: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right";
};

export function CoachmarkTour({ steps, open, onClose }: {
  steps: Step[];
  open: boolean;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const target = useMemo(
    () => (open ? document.querySelector(steps[index]?.selector) as HTMLElement | null : null),
    [open, index, steps]
  );
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    function update() {
      setRect(target ? target.getBoundingClientRect() : null);
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  if (!open) return null;

  const placement = steps[index]?.placement ?? "bottom";
  const next = () => {
    if (index < steps.length - 1) setIndex((i) => i + 1);
    else onClose();
  };

  return (
    <>
      <Mask onClick={onClose} />
      {rect ? (
        <FocusBox style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} />
      ) : null}
      <Tooltip style={computeTooltipStyle(rect, placement)} role="dialog" aria-live="polite">
        {steps[index]?.title && <Title>{steps[index].title}</Title>}
        <Content>{steps[index]?.content}</Content>
        <Footer>
          <button onClick={onClose}>跳過</button>
          <button onClick={next}>{index === steps.length - 1 ? "完成" : "下一步"}</button>
        </Footer>
      </Tooltip>
    </>
  );
}

function computeTooltipStyle(rect: DOMRect | null, placement: string) {
  const padding = 12;
  const w = 280;
  const style: React.CSSProperties = {
    position: "fixed",
    width: w,
    zIndex: 2147483647,
  };
  if (!rect) {
    style.top = "50%";
    style.left = `calc(50% - ${w / 2}px)`;
    return style;
  }
  const centerX = rect.left + rect.width / 2 - w / 2;
  if (placement === "top") {
    style.top = Math.max(8, rect.top - 110 - padding);
    style.left = Math.max(8, centerX);
  } else if (placement === "bottom") {
    style.top = rect.bottom + padding;
    style.left = Math.max(8, centerX);
  } else if (placement === "left") {
    style.top = rect.top;
    style.left = Math.max(8, rect.left - w - padding);
  } else {
    style.top = rect.top;
    style.left = rect.right + padding;
  }
  return style;
}

const Mask = styled.div`
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 2147483646;
`;

const FocusBox = styled.div`
  position: fixed;
  border: 2px solid #fff;
  box-shadow: 0 0 0 9999px rgba(0,0,0,0.45);
  border-radius: 12px;
  pointer-events: none;
  z-index: 2147483647;
`;

const Tooltip = styled.div`
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
`;

const Title = styled.div`font-weight: 700; margin-bottom: 6px;`;
const Content = styled.div`font-size: 14px; line-height: 1.5;`;
const Footer = styled.div`
  margin-top: 10px; display: flex; gap: 8px; justify-content: flex-end;
  button { padding: 6px 10px; border-radius: 8px; border: 1px solid #ddd; background: #fafafa; }
  button:last-child { background: #222; color: #fff; border-color: #222; }
`;
