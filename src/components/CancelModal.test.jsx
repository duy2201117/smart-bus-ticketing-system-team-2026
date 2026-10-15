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
      screen.getByText("Xác nhận hủy vé?")
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
      screen.queryByText("Xác nhận hủy vé?")
    ).not.toBeInTheDocument();
  });

  it("gọi onConfirm khi bấm Đồng ý", () => {
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
        name: "Đồng ý"
      })
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("gọi onClose khi bấm Đóng", () => {
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
        name: "Đóng"
      })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});