import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTheme } from "./useTheme";

describe("useTheme", () => {
  it("starts from the theme the boot script set on <html>", () => {
    document.documentElement.dataset.theme = "dark";
    expect(renderHook(() => useTheme()).result.current.theme).toBe("dark");
  });

  it("toggle flips the theme, updates <html> and persists it", () => {
    document.documentElement.dataset.theme = "light";
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggle());
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("runway.theme")).toBe("dark");

    act(() => result.current.toggle());
    expect(result.current.theme).toBe("light");
    expect(localStorage.getItem("runway.theme")).toBe("light");
  });
});
