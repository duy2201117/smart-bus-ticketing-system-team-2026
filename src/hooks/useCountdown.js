import { useEffect, useState } from "react";

export default function useCountdown(
  minutes,
  isRunning = true
) {
  const [time, setTime] = useState(
    minutes * 60
  );

  useEffect(() => {
    // Dừng countdown nếu thanh toán thành công
    if (!isRunning) {
      return;
    }

    // Không chạy tiếp khi hết thời gian
    if (time <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setTime((prev) =>
        Math.max(prev - 1, 0)
      );
    }, 1000);

    return () => clearTimeout(timer);
  }, [time, isRunning]);

  return time;
}