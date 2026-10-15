import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CancelModal from "./CancelModal";

describe("CancelModal", () => {
  it("hiển thị popup khi open = true", () => {
    render(
      <CancelModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(
      screen.getByRole("dialog", {
        name: /Bạn muốn hủy vé này/i
      })
    ).toBeInTheDocument();
  });

  it("không hiển thị popup khi open = false", () => {
    render(
      <CancelModal
        open={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(
      screen.queryByRole("dialog")
    ).not.toBeInTheDocument();
  });

  it("gọi onConfirm khi bấm Hủy vé", () => {
    const onConfirm = vi.fn();

    render(
      <CancelModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Hủy vé/i
      })
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("gọi onClose khi bấm Giữ vé", () => {
    const onClose = vi.fn();

    render(
      <CancelModal
        open={true}
        onClose={onClose}
        onConfirm={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Giữ vé/i
      })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
