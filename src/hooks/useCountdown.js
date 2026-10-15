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
    // hoặc thời gian đã hết.
    if (!isRunning || time <= 0) {
      return;
    }

    // Dùng một interval ổn định thay vì tạo lại
    // setTimeout sau mỗi lần render. Functional update
    // giúp countdown chính xác và test fake timer có thể
    // nhảy cả khoảng thời gian dài trong một lần.
    const timer = setInterval(() => {
      setTime((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning]);

  return time;
}