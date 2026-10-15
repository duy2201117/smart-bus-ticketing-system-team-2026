import {
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";

import {
  describe,
  expect,
  it,
  vi
} from "vitest";

import ChangeTripModal from "./ChangeTripModal";

describe("ChangeTripModal", () => {
  it("hiển thị popup khi open = true", async () => {
    render(
      <ChangeTripModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: /Chọn chuyến xe mới/i
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByRole("option", {
          name: /Hà Nội → Bắc Ninh/
        })
      ).toBeInTheDocument();
    });
  });

  it("không hiển thị popup khi open = false", () => {
    render(
      <ChangeTripModal
        open={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(
      screen.queryByRole("dialog")
    ).not.toBeInTheDocument();
  });

  it("cho phép chọn chuyến còn ghế và xác nhận", async () => {
    const onConfirm = vi.fn();

    render(
      <ChangeTripModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("option", {
          name: /Hà Nội → Bắc Ninh/
        })
      ).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");

    fireEvent.change(select, {
      target: {
        value: "Hà Nội → Bắc Ninh"
      }
    });

    expect(
      screen.getByText((content, element) => {
        return (
          element?.classList.contains(
            "legacy-trip-availability"
          ) &&
          element.textContent
            .replace(/\s+/g, " ")
            .trim()
            .includes("Còn 5 ghế trống.")
        );
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Xác nhận đổi chuyến/i
      })
    );

    expect(onConfirm).toHaveBeenCalledWith(
      "Hà Nội → Bắc Ninh"
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("không cho xác nhận chuyến đã hết ghế", async () => {
    const onConfirm = vi.fn();

    render(
      <ChangeTripModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("option", {
          name: /Thái Nguyên → Bắc Giang/
        })
      ).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");

    fireEvent.change(select, {
      target: {
        value: "Thái Nguyên → Bắc Giang"
      }
    });

    expect(
      screen.getByText((content, element) => {
        return (
          element?.classList.contains(
            "legacy-trip-availability"
          ) &&
          element.textContent.includes(
            "Chuyến này đã hết ghế."
          )
        );
      })
    ).toBeInTheDocument();

    const confirmButton = screen.getByRole(
      "button",
      {
        name: /Xác nhận đổi chuyến/i
      }
    );

    expect(confirmButton).toBeDisabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("gọi onClose khi bấm nút Đóng", async () => {
    const onClose = vi.fn();

    render(
      <ChangeTripModal
        open={true}
        onClose={onClose}
        onConfirm={() => {}}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("option", {
          name: /Hà Nội → Bắc Ninh/
        })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Đóng"
      })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
