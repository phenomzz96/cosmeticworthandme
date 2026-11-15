-- =============================================================================
-- KIỂM THỬ MIGRATION 011 (màu chủ đạo theo logo)
--   00_local_supabase_stub.sql → migrations 001..011 → file này
-- =============================================================================
\set ON_ERROR_STOP on

\ir helpers.sql

-- Cài đặt còn màu mặc định cũ → migration đã đổi sang đỏ rượu vang, lưu bản trước và ghi nhật ký
select tests.check((select primary_color from public.site_settings where id = 1) = '#7d2232', 'Màu mặc định cũ (#79628e) được đổi sang #7d2232');
select tests.check((select count(*) from public.site_settings_history where snapshot ->> 'primary_color' = '#79628e') = 1, 'Lưu bản trước vào lịch sử (khôi phục được)');
select tests.check((select count(*) from public.audit_logs where action = 'site_settings.palette_migration') = 1, 'Ghi audit_logs');
select tests.check((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'site_settings' and column_name = 'primary_color') like '%#7d2232%', 'Giá trị mặc định của cột là #7d2232');

-- Chạy lại migration: không đổi gì thêm (an toàn khi lỡ chạy 2 lần)
\ir ../migrations/20261116000001_brand_palette.sql
select tests.check((select count(*) from public.site_settings_history) = 1 and (select count(*) from public.audit_logs where action = 'site_settings.palette_migration') = 1, 'Chạy lại: không ghi thêm lịch sử / nhật ký');

-- Admin đã tự chọn màu khác → migration không ghi đè
update public.site_settings set primary_color = '#123456' where id = 1;
\ir ../migrations/20261116000001_brand_palette.sql
select tests.check((select primary_color from public.site_settings where id = 1) = '#123456', 'Màu Admin đã chọn được giữ nguyên');

-- Quyền không đổi: khách vãng lai và người dùng thường không sửa được cài đặt
begin;
set local role anon;
select tests.throws($q$update public.site_settings set primary_color = '#000000' where id = 1$q$, '42501', 'Khách vãng lai không sửa trực tiếp cài đặt');
commit;

select * from tests.summary();
select count(*) filter (where ok) || '/' || count(*) as "KẾT QUẢ" from tests.results;
