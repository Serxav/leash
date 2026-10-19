"use client";

import { useEffect, useRef, type ComponentProps } from "react";

/**
 * A submit button that keeps the keyboard focus while its form is saving.
 *
 * A `disabled` button loses the focus, which sends keyboard and screen
 * reader users back to the top of the page after every tap. This one is
 * only `aria-disabled` while saving: it stays focusable, looks disabled and
 * ignores a second submit. The server still refuses double answers anyway.
 */
export function SubmitButton({
  pending,
  onClick,
  className = "",
  ...props
}: Omit<ComponentProps<"button">, "type" | "disabled"> & { pending: boolean }) {
  return (
    <button
      {...props}
      type="submit"
      aria-disabled={pending}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={`${className} aria-disabled:cursor-not-allowed aria-disabled:opacity-60`}
    />
  );
}

/**
 * Moves the focus to the answer message each time a new answer arrives, for
 * forms whose button disappears after the answer (an approved purchase
 * leaves the inbox, a refunded one loses its refund button). Without it the
 * focus falls back to the top of the page.
 */
export function useFocusOnAnswer<T>(answer: T, show: boolean) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (show) ref.current?.focus();
  }, [answer, show]);
  return ref;
}
