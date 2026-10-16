import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/features/passenger/ComplaintsPage.jsx'), 'utf8');

describe('ComplaintsPage - final US24 frontend completion', () => {
  it('preserves the original complaint submit and response-status flow', () => {
    expect(source).toContain("api('/complaints')");
    expect(source).toContain('Gửi phản ánh');
    expect(source).toContain('Lịch sử phản ánh');
    expect(source).toContain('Phản hồi:');
  });

  it('adds the missing 1-5 trip rating UI and integrates the existing feedback API', () => {
    expect(source).toContain("api('/feedback')");
    expect(source).toContain('Đánh giá chuyến đi');
    expect(source).toContain('Điểm đánh giá');
    expect(source).toContain('5 sao - Rất tốt');
    expect(source).toContain('1 sao - Không hài lòng');
    expect(source).toContain('Gửi đánh giá');
    expect(source).toContain('Lịch sử đánh giá');
    expect(source).toContain("['paid', 'checked_in']");
  });
});
