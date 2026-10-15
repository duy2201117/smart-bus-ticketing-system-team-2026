import {
  act,
  fireEvent,
  render,
  screen
} from "@testing-library/react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";

import CountdownTimer from "./CountdownTimer";

describe("CountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    vi.spyOn(
      window,
      "alert"
    ).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("bắt đầu countdown từ 10:00", () => {
    render(
      <CountdownTimer
        seat="A01"
        onExpired={() => {}}
        onPaymentSuccess={() => {}}
      />
    );

    expect(
      screen.getByText("10:00")
    ).toBeInTheDocument();

    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() ===
            "p" &&
          element.textContent
            .replace(/\s+/g, " ")
            .trim()
            .includes("Ghế: A01")
        );
      })
    ).toBeInTheDocument();
  });

  it("countdown tự động giảm từng giây", () => {
    render(
      <CountdownTimer
        seat="A01"
        onExpired={() => {}}
        onPaymentSuccess={() => {}}
      />
    );

    expect(
      screen.getByText("10:00")
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(
      screen.getByText("9:59")
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(
      screen.getByText("9:58")
    ).toBeInTheDocument();
  });

  it("dừng countdown khi thanh toán thành công", () => {
    const onPaymentSuccess = vi.fn();

    render(
      <CountdownTimer
        seat="A01"
        onExpired={() => {}}
        onPaymentSuccess={
          onPaymentSuccess
        }
      />
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(
      screen.getByText("9:59")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Thanh toán thành công"
      })
    );

    expect(
      onPaymentSuccess
    ).toHaveBeenCalledTimes(1);

    expect(
      screen.getByText(
        "✓ Thanh toán thành công"
      )
    ).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.getByText("9:59")
    ).toBeInTheDocument();
  });

  it("chuyển trạng thái thành đã thanh toán", () => {
    render(
      <CountdownTimer
        seat="B02"
        onExpired={() => {}}
        onPaymentSuccess={() => {}}
      />
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Thanh toán thành công"
      })
    );

    expect(
      screen.getByText((content, element) => {
        return (
          element?.tagName.toLowerCase() ===
            "p" &&
          element.textContent
            .replace(/\s+/g, " ")
            .trim()
            .includes(
              "Trạng thái ghế: Đã thanh toán"
            )
        );
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Ghế B02 đã được xác nhận."
      )
    ).toBeInTheDocument();

    expect(
      window.alert
    ).toHaveBeenCalledWith(
      "Thanh toán thành công ghế B02! Countdown đã dừng."
    );
  });

  it(
    "hết 10 phút thì hủy giữ chỗ và trả ghế",
    async () => {
      const onExpired = vi.fn();

      render(
        <CountdownTimer
          seat="A03"
          onExpired={onExpired}
          onPaymentSuccess={() => {}}
        />
      );

      expect(
        screen.getByText("10:00")
      ).toBeInTheDocument();

      /*
       * useCountdown sử dụng setTimeout
       * từng giây.
       *
       * Vì vậy test chạy từng timer
       * theo đúng chu kỳ React thay vì
       * nhảy thẳng 600000ms.
       */
      for (let i = 0; i < 600; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(
            1000
          );
        });
      }

      expect(
        onExpired
      ).toHaveBeenCalledTimes(1);

      expect(
        window.alert
      ).toHaveBeenCalledWith(
        "Thời gian giữ ghế A03 đã hết. Ghế đã được trả về trạng thái trống."
      );

      expect(
        screen.getByRole("button", {
          name: "Thanh toán thành công"
        })
      ).toBeDisabled();
    },
    15000
  );
});