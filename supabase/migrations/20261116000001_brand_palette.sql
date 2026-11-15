-- =============================================================================
-- MIGRATION 011 — Màu chủ đạo theo logo chính thức của nhóm (bộ màu "Haute Care")
-- Chạy SAU 10 migration trước. Chạy một lần.
--
-- Nhóm đã cung cấp logo (đỏ rượu vang). Đổi màu chủ đạo mặc định từ tím (#79628e) sang đỏ rượu vang (#7d2232):
--  - Cột primary_color: đổi giá trị mặc định cho cài đặt mới.
--  - Bản ghi hiện có: CHỈ đổi khi vẫn còn đúng màu mặc định cũ (#79628e), tức Admin chưa từng tự chọn màu.
--    Admin đã chọn màu khác thì giữ nguyên.
--  - Lưu bản trước vào site_settings_history (khôi phục được ở /admin/brand) và ghi audit_logs.
-- Không đổi quyền, không thêm bảng.
-- =============================================================================

alter table public.site_settings alter column primary_color set default '#7d2232';

do $$
declare
  v_before jsonb;
begin
  if exists (select 1 from public.site_settings where id = 1 and lower(primary_color) = '#79628e') then
    v_before := private.settings_snapshot();
    insert into public.site_settings_history (snapshot, changed_by) values (v_before, null);
    update public.site_settings set primary_color = '#7d2232', updated_at = now() where id = 1;
    perform private.log_action('site_settings.palette_migration', 'site_settings', '1',
      jsonb_build_object('before', v_before, 'after', private.settings_snapshot(), 'reason', 'Màu chủ đạo theo logo chính thức (migration 011)'));
  end if;
end;
$$;
