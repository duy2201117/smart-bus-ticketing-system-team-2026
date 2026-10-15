import { useCallback, useEffect, useState } from 'react';
import { api, dateTime, money, statusLabel } from '../../lib/api';

export function useResource(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion(value => value + 1), []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api(path).then(result => { if (current) setData(result); }).catch(err => {
      if (current) { setError(err.message); setData(null); }
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [path, version]);
  return { data, loading, error, refresh };
}

export function useMutation(refresh) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  async function perform(task, message = 'Đã lưu thay đổi.') {
    if (pending) return false;
    setPending(true); setError(''); setSuccess('');
    try {
      await task();
      setSuccess(message);
      refresh?.();
      return true;
    } catch (err) {
      setError(err.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.');
      return false;
    } finally { setPending(false); }
  }
  return { pending, error, success, perform, reset: () => { setError(''); setSuccess(''); } };
}

export function Notice({ error, success }) {
  return <>{error && <div className="alert alert-error" role="alert">{error}</div>}{success && <div className="alert alert-success" role="status">{success}</div>}</>;
}

export function ResourceState({ resource, children }) {
  if (resource.loading) return <div className="ops-loading" role="status">Đang tải dữ liệu…</div>;
  if (resource.error) return <div className="alert alert-error" role="alert">{resource.error} <button type="button" className="btn btn-secondary" onClick={resource.refresh}>Thử lại</button></div>;
  return children;
}

export function Field({ label, name, value, onChange, type = 'text', required = true, options, help, ...props }) {
  return <label className="field"><span>{label}{required && ' *'}</span>{options ?
    <select className="input" name={name} value={value ?? ''} onChange={onChange} required={required} {...props}>
      <option value="">Chọn {label.toLowerCase()}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : type === 'textarea' ?
      <textarea className="input" name={name} value={value ?? ''} onChange={onChange} rows={3} required={required} {...props} /> :
      <input className="input" name={name} type={type} value={value ?? ''} onChange={onChange} required={required} {...props} />
  }{help && <small className="muted">{help}</small>}</label>;
}

export function Table({ columns, rows, empty = 'Chưa có dữ liệu.', rowKey = 'id', rowClassName }) {
  if (!rows?.length) return <div className="empty-state">{empty}</div>;
  return <div className="table-wrap"><table className="data-table"><thead><tr>{columns.map(column => <th scope="col" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row[rowKey] ?? index} className={rowClassName ? rowClassName(row, index) : ''}>{columns.map(column => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table></div>;
}

const extraLabels = { active: 'Đang hoạt động', maintenance: 'Bảo dưỡng', pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', none: 'Chưa đăng ký', open: 'Chờ xử lý', resolved: 'Đã xử lý', scheduled: 'Chưa khởi hành', running: 'Đang chạy', completed: 'Hoàn thành', cancelled: 'Đã hủy', student: 'Học sinh / sinh viên', senior: 'Người cao tuổi' };
export function Status({ value }) { return <span className={`badge ops-status-${value}`}>{extraLabels[value] || statusLabel(value)}</span>; }
export const roles = [{ value: 'admin', label: 'Quản trị viên' }, { value: 'manager', label: 'Điều hành' }, { value: 'driver', label: 'Tài xế' }, { value: 'passenger', label: 'Hành khách' }];
export const roleName = role => roles.find(item => item.value === role)?.label || role;
export const localDateTime = value => {
  const date = value ? new Date(value) : new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
export const today = () => localDateTime().slice(0, 10);
export const inputChange = setter => event => setter(form => ({ ...form, [event.target.name]: event.target.value }));
export const optionList = (items, label = 'name') => (items || []).map(item => ({ value: item.id, label: typeof label === 'function' ? label(item) : item[label] }));
const latestKey = scope => `smartbus.latest.${scope}`;
export const getLatestCreatedId = scope => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(latestKey(scope)) || '';
};
export const setLatestCreatedId = (scope, id) => {
  if (typeof window === 'undefined' || id == null) return;
  window.localStorage.setItem(latestKey(scope), String(id));
};
export const sortLatestFirst = (rows, latestId) => {
  if (!Array.isArray(rows) || !latestId) return rows || [];
  const target = String(latestId);
  const newest = [];
  const rest = [];
  for (const row of rows) (String(row?.id) === target ? newest : rest).push(row);
  return newest.concat(rest);
};
export const latestRowClass = latestId => row => String(row?.id) === String(latestId || '') ? 'ops-row-latest' : '';
export { api, dateTime, money };
