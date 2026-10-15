import {
  fireEvent,
  render,
  screen
} from "@testing-library/react";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  MemoryRouter
} from "react-router-dom";

import SelectSeat from "./SelectSeat";

describe("SelectSeat", () => {
  it("hiển thị màn hình chọn ghế", () => {
    render(
      <MemoryRouter>
        <SelectSeat />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Chọn ghế"
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Danh sách ghế")
    ).toBeInTheDocument();

    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() ===
            "p" &&
          element.textContent
            .replace(/\s+/g, " ")
            .trim()
            .includes(
              "Ghế đã chọn: Chưa chọn ghế"
            )
        );
      })
    ).toBeInTheDocument();
  });

  it("nút giữ ghế bị khóa khi chưa chọn ghế", () => {
    render(
      <MemoryRouter>
        <SelectSeat />
      </MemoryRouter>
    );

    const holdButton =
      screen.getByRole("button", {
        name:
          "Giữ ghế và tiếp tục thanh toán"
      });

    expect(
      holdButton
    ).toBeDisabled();
  });

  it("cho phép người dùng chọn ghế", () => {
    render(
      <MemoryRouter>
        <SelectSeat />
      </MemoryRouter>
    );

    const seatButton =
      screen.getByRole("button", {
        name: "A01"
      });

    fireEvent.click(seatButton);

    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() ===
            "p" &&
          element.textContent
            .replace(/\s+/g, " ")
            .trim()
            .includes(
              "Ghế đã chọn: A01"
            )
        );
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name:
          "Giữ ghế và tiếp tục thanh toán"
      })
    ).not.toBeDisabled();
  });

  it("tạo phiên giữ chỗ sau khi chọn ghế", () => {
    render(
      <MemoryRouter>
        <SelectSeat />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "A01"
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name:
          "Giữ ghế và tiếp tục thanh toán"
      })
    );

    expect(
      screen.getByText(
        "Thời gian giữ chỗ"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("10:00")
    ).toBeInTheDocument();

    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() ===
            "h3" &&
          element.textContent
            .replace(/\s+/g, " ")
            .trim()
            .includes(
              "Ghế đang giữ: A01"
            )
        );
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() ===
            "p" &&
          element.textContent
            .replace(/\s+/g, " ")
            .trim()
            .includes(
              "Trạng thái ghế: Giữ chỗ"
            )
        );
      })
    ).toBeInTheDocument();
  });

  it("hiển thị nút thanh toán sau khi tạo phiên giữ chỗ", () => {
    render(
      <MemoryRouter>
        <SelectSeat />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "A02"
      })
    );

    fireEvent.click(
      screen.getByRole("button", {
        name:
          "Giữ ghế và tiếp tục thanh toán"
      })
    );

    expect(
      screen.getByRole("button", {
        name: "Thanh toán thành công"
      })
    ).toBeInTheDocument();
  });
});