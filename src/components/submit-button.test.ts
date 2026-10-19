import { createElement, type MouseEvent } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SubmitButton } from "./submit-button";

const render = (pending: boolean) =>
  renderToStaticMarkup(createElement(SubmitButton, { pending, className: "btn" }, "Pay"));

const click = (pending: boolean, onClick = vi.fn()) => {
  const event = { preventDefault: vi.fn() } as unknown as MouseEvent<HTMLButtonElement>;
  SubmitButton({ pending, onClick, children: "Pay" }).props.onClick(event);
  return { event, onClick };
};

describe("SubmitButton (keyboard focus while saving)", () => {
  it("is never disabled, so it keeps the focus while saving", () => {
    expect(render(true)).toContain('aria-disabled="true"');
    expect(render(true)).not.toMatch(/\sdisabled[=\s>]/);
    expect(render(false)).toContain('aria-disabled="false"');
    expect(render(false)).toContain('type="submit"');
  });

  it("ignores a second submit while saving", () => {
    const { event, onClick } = click(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("submits normally when not saving", () => {
    const { event, onClick } = click(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledWith(event);
  });
});
