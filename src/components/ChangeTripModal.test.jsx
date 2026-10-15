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
  // TEST 1: Hiển thị popup khi open = true
  it("hiển thị popup khi open = true", async () => {
    render(
      <ChangeTripModal
        open={true}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(
      screen.getByText("Đổi chuyến xe")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText(/Hà Nội → Bắc Ninh/)
      ).toBeInTheDocument();
    });
  });

  // TEST 2: Không hiển thị popup khi open = false
  it("không hiển thị popup khi open = false", () => {
    render(
      <ChangeTripModal
        open={false}
        onClose={() => {}}
        onConfirm={() => {}}
      />
    );

    expect(
      screen.queryByText("Đổi chuyến xe")
    ).not.toBeInTheDocument();
  });

  // TEST 3: Chọn chuyến còn ghế và xác nhận
  it("cho phép chọn chuyến còn ghế và xác nhận", async () => {
    const onConfirm = vi.fn();

    render(
      <ChangeTripModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    );

    // Chờ danh sách chuyến tải xong
    await waitFor(() => {
      expect(
        screen.getByText(/Hà Nội → Bắc Ninh/)
      ).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");

    // Chọn chuyến còn 5 ghế
    fireEvent.change(select, {
      target: {
        value: "Hà Nội → Bắc Ninh"
      }
    });

    // Kiểm tra thông báo "Còn 5 ghế trống."
    // Dùng textContent vì số 5 nằm trong thẻ <strong>
    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() === "p" &&
          element.textContent
            .replace(/\s+/g, " ")
            .trim()
            .includes("Còn 5 ghế trống.")
        );
      })
    ).toBeInTheDocument();

    // Bấm nút xác nhận
    fireEvent.click(
      screen.getByRole("button", {
        name: "Xác nhận"
      })
    );

    // Kiểm tra đúng chuyến được gửi về onConfirm
    expect(onConfirm).toHaveBeenCalledWith(
      "Hà Nội → Bắc Ninh"
    );

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  // TEST 4: Không cho đổi sang chuyến hết ghế
  it("không cho xác nhận chuyến đã hết ghế", async () => {
    const onConfirm = vi.fn();

    render(
      <ChangeTripModal
        open={true}
        onClose={() => {}}
        onConfirm={onConfirm}
      />
    );

    // Chờ danh sách chuyến tải xong
    await waitFor(() => {
      expect(
        screen.getByText(
          /Thái Nguyên → Bắc Giang/
        )
      ).toBeInTheDocument();
    });

    const select = screen.getByRole("combobox");

    // Chọn chuyến có 0 ghế
    fireEvent.change(select, {
      target: {
        value: "Thái Nguyên → Bắc Giang"
      }
    });

    // Phải hiển thị thông báo hết ghế
    expect(
      screen.getByText(
        "Chuyến này đã hết ghế."
      )
    ).toBeInTheDocument();

    // Nút xác nhận phải bị khóa
    const confirmButton = screen.getByRole(
      "button",
      {
        name: "Xác nhận"
      }
    );

    expect(confirmButton).toBeDisabled();

    // Không được gọi onConfirm
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // TEST 5: Nút Đóng
  it("gọi onClose khi bấm nút Đóng", async () => {
    const onClose = vi.fn();

    render(
      <ChangeTripModal
        open={true}
        onClose={onClose}
        onConfirm={() => {}}
      />
    );

    // Chờ dữ liệu chuyến tải xong
    await waitFor(() => {
      expect(
        screen.getByText(/Hà Nội → Bắc Ninh/)
      ).toBeInTheDocument();
    });

    // Bấm nút Đóng
    fireEvent.click(
      screen.getByRole("button", {
        name: "Đóng"
      })
    );

    // Kiểm tra onClose được gọi đúng 1 lần
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});